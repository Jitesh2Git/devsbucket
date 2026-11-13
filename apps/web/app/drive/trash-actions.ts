"use server";

import { can, MY_DRIVE } from "@devsbucket/authz/can";
import { queueStorageCleanup, type StorageCleanup } from "@devsbucket/db/jobs";
import {
  deleteForever as deleteRows,
  listTrashRootIds,
  restoreItem as restoreRows,
  trashItem as trashRows,
} from "@devsbucket/db/trash";
import { itemRefSchema } from "@devsbucket/shared/item";
import { deleteStoredFiles, isComplete } from "@devsbucket/storage/cleanup";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveItem } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";

// Server actions are public endpoints: each one checks the session, the
// input and the permission itself.

const getSession = async () => auth.api.getSession({ headers: await headers() });

const parseItemId = (input: unknown) => {
  const parsed = itemRefSchema.safeParse(input);
  return parsed.success ? parsed.data.itemId : null;
};

// A Trash view row (an item the user trashed directly) they may act on.
const findTrashRoot = async (
  user: { id: string },
  itemId: string | null,
  action: "restore" | "delete_forever",
) => {
  const found = itemId ? await resolveItem(user, itemId, action, { trashed: true }) : null;
  if (!found) {
    return { denied: "missing" } as const;
  }
  if (found.denied === null && !found.item.trashRoot) {
    return { denied: "missing" } as const;
  }
  return found;
};

export const trashItem = async (input: unknown) => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const itemId = parseItemId(input);
  // Editors can trash too (inside the owner's tree); only the Owner deletes
  // forever.
  const found = itemId
    ? await resolveItem(session.user, itemId, "trash", { trashed: false })
    : ({ denied: "missing" } as const);
  if (found.denied) {
    return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  }
  const { item } = found;
  await trashRows({ id: item.id, ownerId: item.ownerId, trashedBy: session.user.id });
  return { error: null, name: item.name } as const;
};

export const restoreItem = async (input: unknown) => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const found = await findTrashRoot(session.user, parseItemId(input), "restore");
  if (found.denied) {
    return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  }
  const root = found.item;
  const result = await restoreRows({ id: root.id, ownerId: root.ownerId });
  if (!result) {
    return { error: ITEM_GONE } as const;
  }
  return { error: null, ...result } as const;
};

// The rows are gone and the quota is back; now storage. Whatever storage
// can't delete right now goes to the worker, which retries (step 11).
const deleteFromStorage = async (cleanup: StorageCleanup) => {
  const failed = await deleteStoredFiles(cleanup);
  if (!isComplete(failed)) {
    await queueStorageCleanup(failed);
  }
};

export const deleteForever = async (input: unknown) => {
  const session = await getSession();
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  // Owner only (decisions 0007, 0008): an Editor can trash, not this.
  const found = await findTrashRoot(session.user, parseItemId(input), "delete_forever");
  if (found.denied) {
    return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  }
  const root = found.item;
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
  if (!can(MY_DRIVE, "delete_forever")) {
    return { error: "You can't empty this trash." } as const;
  }
  const ids = await listTrashRootIds(session.user.id);
  const result = await deleteRows({ ids, ownerId: session.user.id });
  await deleteFromStorage(result);
  return { error: null, deleted: result.deleted } as const;
};
