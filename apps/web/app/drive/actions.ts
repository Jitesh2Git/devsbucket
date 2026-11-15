"use server";

import {
  createFolder as insertFolder,
  createTextFile as insertTextFile,
  listItems,
} from "@devsbucket/db/items";
import { createTextFileSchema } from "@devsbucket/shared/editing";
import { createFolderSchema, listItemsSchema, nameTakenMessage } from "@devsbucket/shared/item";
import { checkUploadLimits } from "@devsbucket/storage/limits";
import { itemKey, putObject } from "@devsbucket/storage/objects";
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

// "New file" (Phase 4): an empty text file, opened in the editor next.
export const createTextFile = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = createTextFileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" } as const;
  }
  const { parentId, name } = parsed.data;
  const parent = await resolveFolder(session.user, parentId, "upload");
  if (parent.denied) {
    return { error: deniedMessage(parent.denied, FOLDER_GONE) } as const;
  }
  // Writing the empty object is a storage operation: the same hard stops
  // as an upload of 0 bytes.
  const limitError = await checkUploadLimits(0);
  if (limitError) {
    return { error: limitError } as const;
  }
  const result = await insertTextFile(
    {
      // The tree's owner owns it (decision 0002), even when an Editor makes it.
      ownerId: parent.item.ownerId,
      parentId,
      createdBy: session.user.id,
      name,
      storageKeyFor: itemKey,
    },
    (key) => putObject({ key, body: new Uint8Array(), contentType: "text/plain" }),
  );
  if (!result.ok) {
    return { error: nameTakenMessage(name) } as const;
  }
  return { error: null, id: result.id } as const;
};
