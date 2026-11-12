"use server";

import { can } from "@devsbucket/authz/can";
import {
  getItem,
  listFolders as listFolderRows,
  moveItem as moveItemRow,
  renameItem as renameItemRow,
} from "@devsbucket/db/items";
import {
  listFoldersSchema,
  moveItemSchema,
  nameTakenMessage,
  renameItemSchema,
} from "@devsbucket/shared/item";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveFolder } from "@/lib/folders";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";
const FOLDER_GONE = "That folder no longer exists.";

// Server actions are public endpoints: each one checks the session, the
// input and the permission itself, whatever the dialog already did.

// A folder or a finished file outside the trash that `user` may `action`.
const findItem = async (user: { id: string }, itemId: string, action: "rename" | "move") => {
  const item = await getItem(itemId);
  if (item?.status !== "ready" || item.trashedAt !== null || !can(user, action, item)) {
    return null;
  }
  return item;
};

export const renameItem = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = renameItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" } as const;
  }
  const { itemId, name } = parsed.data;
  const item = await findItem(session.user, itemId, "rename");
  if (!item) {
    return { error: ITEM_GONE } as const;
  }
  const result = await renameItemRow(item.id, name);
  if (!result.ok) {
    return { error: result.reason === "name-taken" ? nameTakenMessage(name) : ITEM_GONE } as const;
  }
  return { error: null, item: result.item } as const;
};

export const moveItem = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = moveItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const { itemId, parentId } = parsed.data;
  const item = await findItem(session.user, itemId, "move");
  if (!item) {
    return { error: ITEM_GONE } as const;
  }
  const target = await resolveFolder(session.user, parentId, "move");
  if (!target) {
    return { error: FOLDER_GONE } as const;
  }
  // Ownership follows the tree (decision 0002): moving between two people's
  // trees would move quota too. Phase 2 has one owner, so it never happens.
  if (target.ownerId !== item.ownerId) {
    return { error: "Items can only move within the same drive." } as const;
  }
  if (item.parentId === parentId) {
    return { error: null, item } as const;
  }
  const result = await moveItemRow({ id: item.id, ownerId: item.ownerId, parentId });
  if (!result.ok) {
    const error = {
      "into-itself": "A folder can't be moved into itself or one of its own folders.",
      "name-taken": nameTakenMessage(item.name),
      gone: ITEM_GONE,
    }[result.reason];
    return { error } as const;
  }
  return { error: null, item: result.item } as const;
};

// The folders in one folder, for the Move dialog.
export const listFolders = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = listFoldersSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const folder = await resolveFolder(session.user, parsed.data.parentId, "view");
  if (!folder) {
    return { error: FOLDER_GONE } as const;
  }
  const folders = await listFolderRows({
    ownerId: folder.ownerId,
    parentId: parsed.data.parentId,
  });
  return { error: null, folders } as const;
};
