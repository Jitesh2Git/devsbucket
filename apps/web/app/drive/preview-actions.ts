"use server";

import { uploadIdSchema } from "@devsbucket/shared/item";
import { looksLikeText, TEXT_PREVIEW_BYTES } from "@devsbucket/shared/preview";
import { getRange, itemKey } from "@devsbucket/storage/objects";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveFile } from "@/lib/files";

// The first megabyte of a text file, read on the server, for the preview
// dialog. Read here rather than in the browser so the bytes can be checked
// (no NUL = text) and decoded once.
export const loadTextPreview = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You're signed out. Sign in again." } as const;
  }
  const parsed = uploadIdSchema.safeParse(input);
  const file = parsed.success ? await resolveFile(session.user, parsed.data.itemId, "view") : null;
  if (!file) {
    return { error: "This file no longer exists." } as const;
  }
  const size = file.size ?? 0;
  const bytes = size > 0 ? await getRange(itemKey(file.id), TEXT_PREVIEW_BYTES) : new Uint8Array();
  if (!looksLikeText(bytes)) {
    return { error: null, binary: true } as const;
  }
  return {
    error: null,
    binary: false,
    // Cutting at 1 MB can split a character; it shows as one "�".
    text: new TextDecoder().decode(bytes),
    truncated: size > TEXT_PREVIEW_BYTES,
  } as const;
};
