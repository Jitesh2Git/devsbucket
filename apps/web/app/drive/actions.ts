"use server";

import { createFolder as insertFolder, listItems } from "@devsbucket/db/items";
import { createFolderSchema, listItemsSchema, nameTakenMessage } from "@devsbucket/shared/item";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveFolder } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const FOLDER_GONE = "This folder no longer exists.";

// Server actions are public HTTP endpoints: check who's calling, validate the
// input and check permissions here, whatever the page already did.

// The next page of a folder listing ("Load more").
export const loadItems = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = listItemsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const { parentId, cursor } = parsed.data;
  const folder = await resolveFolder(session.user, parentId, "view");
  if (folder.denied) {
    return { error: deniedMessage(folder.denied, FOLDER_GONE) } as const;
  }
  const page = await listItems({ ownerId: folder.item.ownerId, parentId, cursor });
  return { error: null, page } as const;
};

export const createFolder = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" } as const;
  }
  const { parentId, name } = parsed.data;
  const parent = await resolveFolder(session.user, parentId, "create_folder");
  if (parent.denied) {
    return { error: deniedMessage(parent.denied, FOLDER_GONE) } as const;
  }
  // The new folder belongs to the tree's owner, who pays for its contents
  // (decision 0002), even when an Editor creates it.
  const result = await insertFolder({
    ownerId: parent.item.ownerId,
    parentId,
    createdBy: session.user.id,
    name,
  });
  if (!result.ok) {
    return { error: nameTakenMessage(name) } as const;
  }
  return { error: null, folder: result.folder } as const;
};
