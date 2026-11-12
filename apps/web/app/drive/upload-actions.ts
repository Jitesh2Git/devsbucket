"use server";

import { can } from "@devsbucket/authz/can";
import { createPendingFile, getItem, markFileReady, setUploadId } from "@devsbucket/db/items";
import { completeUploadSchema, requestUploadSchema, uploadIdSchema } from "@devsbucket/shared/item";
import { MULTIPART_THRESHOLD, partSizes, quotaMessage } from "@devsbucket/shared/limits";
import { discardUpload } from "@devsbucket/storage/cleanup";
import { checkUploadLimits } from "@devsbucket/storage/limits";
import { completeMultipart, createMultipart, presignParts } from "@devsbucket/storage/multipart";
import { headObject, itemKey, presignPut } from "@devsbucket/storage/objects";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveFolder } from "@/lib/folders";

const SIGNED_OUT = "You're signed out. Sign in again.";
const FOLDER_GONE = "This folder no longer exists.";
const UPLOAD_GONE = "This upload no longer exists.";
const INCOMPLETE = "The file didn't arrive complete. Try again.";

// An upload goes request → the browser PUTs the file (or its parts) straight
// to storage → complete (or cancel). Each step is a public endpoint, so each
// checks the session, the input and the permission again.

// A pending upload `user` may finish or cancel, or null.
const findPendingUpload = async (user: { id: string }, itemId: string) => {
  const item = await getItem(itemId);
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
  const key = itemKey(file.id);
  const saved = { error: null, itemId: file.id, name: file.name, renamed: file.name !== name };
  let uploadId: string | null = null;
  try {
    if (size > MULTIPART_THRESHOLD) {
      uploadId = await createMultipart({ key, contentType: mimeType });
      await setUploadId(file.id, uploadId);
      const parts = await presignParts({ key, uploadId, size });
      return { ...saved, upload: { kind: "multipart", parts } } as const;
    }
    const url = await presignPut({ key, contentType: mimeType, size });
    return { ...saved, upload: { kind: "single", url, contentType: mimeType } } as const;
  } catch (error) {
    await discardUpload({ id: file.id, uploadId });
    throw error;
  }
};

// After the browser's PUTs: join the parts (multipart), then check what
// actually arrived before the file appears in its folder.
export const completeUpload = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = completeUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const file = await findPendingUpload(session.user, parsed.data.itemId);
  if (!file) {
    return { error: UPLOAD_GONE } as const;
  }
  const key = itemKey(file.id);
  if (file.uploadId) {
    // Every part, numbered 1, 2, 3… in order, or the file can't be whole.
    const parts = parsed.data.parts ?? [];
    const expected = partSizes(file.size ?? 0).length;
    const inOrder = parts.every((part, index) => part.partNumber === index + 1);
    if (parts.length !== expected || !inOrder) {
      await discardUpload(file);
      return { error: INCOMPLETE } as const;
    }
    try {
      await completeMultipart({ key, uploadId: file.uploadId, parts });
    } catch {
      await discardUpload(file);
      return { error: INCOMPLETE } as const;
    }
  }
  const stored = await headObject(key);
  if (stored?.size !== file.size) {
    await discardUpload(file);
    return { error: INCOMPLETE } as const;
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
  const parsed = uploadIdSchema.safeParse(input);
  const file = parsed.success ? await findPendingUpload(session.user, parsed.data.itemId) : null;
  if (file) {
    // The row goes first: it gives the quota back, and a late
    // completeUpload then finds nothing to mark ready.
    await discardUpload(file);
  }
  return { error: null } as const;
};
