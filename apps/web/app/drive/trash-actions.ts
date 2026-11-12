"use server";

import { can } from "@devsbucket/authz/can";
import { getItem } from "@devsbucket/db/items";
import {
  deleteForever as deleteRows,
  getTrashRoot,
  listTrashRootIds,
  restoreItem as restoreRows,
  trashItem as trashRows,
} from "@devsbucket/db/trash";
import { itemRefSchema } from "@devsbucket/shared/item";
import { abortMultipart } from "@devsbucket/storage/multipart";
import { deleteObjects } from "@devsbucket/storage/objects";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";

// Server actions are public endpoints: each one checks the session, the
// input and the permission itself.

const getSession = async () => auth.api.getSession({ headers: await headers() });

const parseItemId = (input: unknown) => {
  const parsed = itemRefSchema.safeParse(input);
  return parsed.success ? parsed.data.itemId : null;
};

export const trashItem = async (input: unknown) => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const itemId = parseItemId(input);
  const item = itemId ? await getItem(itemId) : null;
  if (item?.status !== "ready" || item.trashedAt !== null || !can(session.user, "trash", item)) {
    return { error: ITEM_GONE } as const;
  }
  await trashRows({ id: item.id, ownerId: item.ownerId, trashedBy: session.user.id });
  return { error: null, name: item.name } as const;
};

export const restoreItem = async (input: unknown) => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const itemId = parseItemId(input);
  const root = itemId ? await getTrashRoot(itemId) : null;
  if (!root || !can(session.user, "restore", root)) {
    return { error: ITEM_GONE } as const;
  }
  const result = await restoreRows({ id: root.id, ownerId: root.ownerId });
  if (!result) {
    return { error: ITEM_GONE } as const;
  }
  return { error: null, ...result } as const;
};

// The rows are gone and the quota is back; now storage. A failure here
// can't undo that, so it's logged; the cleanup job (step 11) will retry.
const deleteFromStorage = async ({
  storageKeys,
  uploads,
}: {
  storageKeys: string[];
  uploads: { key: string; uploadId: string }[];
}) => {
  try {
    await Promise.all(uploads.map((upload) => abortMultipart(upload)));
    const failed = await deleteObjects(storageKeys);
    if (failed.length > 0) {
      console.error("Couldn't delete from storage:", failed);
    }
  } catch (error) {
    console.error("Couldn't delete from storage:", storageKeys, error);
  }
};

export const deleteForever = async (input: unknown) => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const itemId = parseItemId(input);
  const root = itemId ? await getTrashRoot(itemId) : null;
  // Owner only (decision 0007): in Phase 3 an Editor can trash, not this.
  if (!root || !can(session.user, "delete_forever", root)) {
    return { error: ITEM_GONE } as const;
  }
  const result = await deleteRows({ ids: [root.id], ownerId: root.ownerId });
  await deleteFromStorage(result);
  return { error: null } as const;
};

export const emptyTrash = async () => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  // The user's own drive: its trash is theirs to empty.
  const myDrive = { ownerId: session.user.id };
  if (!can(session.user, "delete_forever", myDrive)) {
    return { error: "You can't empty this trash." } as const;
  }
  const ids = await listTrashRootIds(myDrive.ownerId);
  const result = await deleteRows({ ids, ownerId: myDrive.ownerId });
  await deleteFromStorage(result);
  return { error: null, deleted: result.deleted } as const;
};
