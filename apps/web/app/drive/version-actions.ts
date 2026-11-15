"use server";

import { getVersion, listVersions } from "@devsbucket/db/versions";
import { versionRefSchema } from "@devsbucket/shared/editing";
import { itemRefSchema } from "@devsbucket/shared/item";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveFile } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const FILE_GONE = "This file no longer exists.";

// The history panel (Editors and Owners, `view_versions`): the list, then
// one version's text when it's shown. Restoring goes through realtime,
// which holds the live text.
export const loadVersions = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = itemRefSchema.safeParse(input);
  const found = parsed.success
    ? await resolveFile(session.user, parsed.data.itemId, "view_versions")
    : ({ denied: "missing" } as const);
  if (found.denied) {
    return { error: deniedMessage(found.denied, FILE_GONE) } as const;
  }
  return { error: null, versions: await listVersions(found.item.id) } as const;
};

export const loadVersionText = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = versionRefSchema.safeParse(input);
  const found = parsed.success
    ? await resolveFile(session.user, parsed.data.itemId, "view_versions")
    : ({ denied: "missing" } as const);
  if (found.denied || !parsed.success) {
    return { error: deniedMessage(found.denied ?? "missing", FILE_GONE) } as const;
  }
  const version = await getVersion(found.item.id, parsed.data.versionId);
  if (!version) {
    return { error: "That version no longer exists." } as const;
  }
  return { error: null, content: version.content } as const;
};
