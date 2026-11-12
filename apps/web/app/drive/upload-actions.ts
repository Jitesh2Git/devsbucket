"use server";

import { can } from "@devsbucket/authz/can";
import { createPendingFile, deletePendingFile, getItem, markFileReady } from "@devsbucket/db/items";
import { requestUploadSchema, uploadIdSchema } from "@devsbucket/shared/item";
import { quotaMessage } from "@devsbucket/shared/limits";
import { checkUploadLimits } from "@devsbucket/storage/limits";
import { deleteObject, headObject, itemKey, presignPut } from "@devsbucket/storage/objects";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveFolder } from "@/lib/folders";

const SIGNED_OUT = "You're signed out. Sign in again.";
const FOLDER_GONE = "This folder no longer exists.";
const UPLOAD_GONE = "This upload no longer exists.";

// An upload goes request → the browser PUTs the file straight to storage →
// complete (or cancel). Each step is a public endpoint, so each checks the
// session, the input and the permission again.

// A pending upload `user` may finish or cancel, or null.
const findPendingUpload = async (user: { id: string }, input: unknown) => {
  const parsed = uploadIdSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }
  const item = await getItem(parsed.data.itemId);
  if (item?.type !== "file" || item.status !== "pending" || !can(user, "upload", item)) {
    return null;
  }
  return item;
};

export const requestUpload = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = requestUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid upload" } as const;
  }
  const { parentId, name, size, mimeType } = parsed.data;
  const parent = await resolveFolder(session.user, parentId, "upload");
  if (!parent) {
    return { error: FOLDER_GONE } as const;
  }
  // File size, the app-wide 9 GB, this month's operations.
  const limitError = await checkUploadLimits(size);
  if (limitError) {
    return { error: limitError } as const;
  }
  // The owner's quota, and the first free name (decision 0007).
  const result = await createPendingFile({
    ownerId: parent.ownerId,
    parentId,
    createdBy: session.user.id,
    name,
    mimeType,
    size,
    storageKeyFor: itemKey,
  });
  if (!result.ok) {
    return { error: quotaMessage(result.used, result.quota) } as const;
  }
  const { file } = result;
  try {
    const url = await presignPut({ key: itemKey(file.id), contentType: mimeType, size });
    return {
      error: null,
      itemId: file.id,
      name: file.name,
      renamed: file.name !== name,
      url,
      contentType: mimeType,
    } as const;
  } catch (error) {
    await deletePendingFile(file.id);
    throw error;
  }
};

// After the browser's PUT: check what actually arrived before the file
// appears in its folder.
export const completeUpload = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const file = await findPendingUpload(session.user, input);
  if (!file) {
    return { error: UPLOAD_GONE } as const;
  }
  const key = itemKey(file.id);
  const stored = await headObject(key);
  if (stored?.size !== file.size) {
    await deletePendingFile(file.id);
    await deleteObject(key);
    return { error: "The file didn't arrive complete. Try again." } as const;
  }
  // null if a cancel got there first.
  if (!(await markFileReady(file.id))) {
    return { error: UPLOAD_GONE } as const;
  }
  return { error: null } as const;
};

// The user cancelled, or the browser's PUT failed: nothing may stay behind.
export const cancelUpload = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const file = await findPendingUpload(session.user, input);
  if (file) {
    // The row first: it gives the quota back, and a late completeUpload
    // then finds nothing to mark ready.
    await deletePendingFile(file.id);
    await deleteObject(itemKey(file.id));
  }
  return { error: null } as const;
};
