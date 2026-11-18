"use server";

import { getOpsThisMonth } from "@devsbucket/db/usage";
import { zipSummary } from "@devsbucket/db/zip";
import { itemRefSchema } from "@devsbucket/shared/item";
import { zipLimitError } from "@devsbucket/shared/limits";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveFolder } from "@/lib/items";

// Asked before a ZIP download starts: whether the folder fits the caps
// (decision 0017), so a refusal is a message on the page rather than a
// failed download. The download route checks again.
export const checkZip = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You're signed out. Sign in again." } as const;
  }
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const found = await resolveFolder(session.user, parsed.data.itemId, "download");
  if (found.denied) {
    return { error: deniedMessage(found.denied, "This folder no longer exists.") } as const;
  }
  const [summary, ops] = await Promise.all([zipSummary(parsed.data.itemId), getOpsThisMonth()]);
  const refused = zipLimitError({ ...summary, ops });
  if (refused) {
    return { error: refused } as const;
  }
  return { error: null, ...summary } as const;
};
