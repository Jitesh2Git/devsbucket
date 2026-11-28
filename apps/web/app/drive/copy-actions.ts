"use server";

import { copyFile as insertCopy } from "@devsbucket/db/items";
import { getUserName } from "@devsbucket/db/users";
import { itemRefSchema, itemRefsSchema } from "@devsbucket/shared/item";
import { ownerQuotaMessage, quotaMessage } from "@devsbucket/shared/limits";
import { checkUploadLimits } from "@devsbucket/storage/limits";
import { copyObject, itemKey } from "@devsbucket/storage/objects";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { eachItem } from "@/lib/each-item";
import { deniedMessage, resolveFile, resolveFolder } from "@/lib/items";

// "Make a copy" (Phase 5, decision 0017): any role may copy a file. The
// copy goes next to the original when the user may add files there (it
// then belongs to that tree's owner, like an upload), otherwise to the top
// of the user's own My Drive.
const copyOne = async (user: { id: string }, itemId: string) => {
  const found = await resolveFile(user, itemId, "copy");
  if (found.denied) {
    return { error: deniedMessage(found.denied, "This file no longer exists.") } as const;
  }
  const source = found.item;
  // The top of a drive is only its owner's to add to.
  const inPlace =
    source.parentId === null
      ? source.ownerId === user.id
      : !(await resolveFolder(user, source.parentId, "upload")).denied;
  const place = inPlace
    ? { ownerId: source.ownerId, parentId: source.parentId }
    : { ownerId: user.id, parentId: null };

  // A copy adds bytes and a storage operation: the same hard stops as an
  // upload of the same size.
  const limitError = await checkUploadLimits(source.size ?? 0);
  if (limitError) {
    return { error: limitError } as const;
  }
  const result = await insertCopy(
    { source, ...place, createdBy: user.id, storageKeyFor: itemKey },
    (key) => copyObject({ from: itemKey(source.id), to: key }),
  );
  if (!result.ok) {
    return {
      error:
        place.ownerId === user.id
          ? quotaMessage(result.used, result.quota)
          : ownerQuotaMessage((await getUserName(place.ownerId)) ?? "the owner"),
    } as const;
  }
  return { error: null, id: result.id, name: result.name, inPlace } as const;
};

export const copyFile = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You're signed out. Sign in again." } as const;
  }
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  return copyOne(session.user, parsed.data.itemId);
};

// Make a copy of several selected files (multi-select), each on its own,
// each placed like a single copy.
export const copyFiles = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You're signed out. Sign in again." } as const;
  }
  const parsed = itemRefsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const result = await eachItem(parsed.data.itemIds, (itemId) => copyOne(session.user, itemId));
  return { error: null, ...result } as const;
};
