"use server";

import { recordView } from "@devsbucket/db/recent";
import { itemRefSchema } from "@devsbucket/shared/item";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveFile } from "@/lib/items";

// Called by the browser when a file opens (the editor page or a preview):
// adds it to the top of Recent. Only for a file the user may view, so
// Recent never lists one they never had access to. Nothing to report back:
// a view that isn't recorded changes nothing on the page.
export const recordFileView = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  const parsed = itemRefSchema.safeParse(input);
  if (!session || !parsed.success) return;
  const found = await resolveFile(session.user, parsed.data.itemId, "view");
  if (found.denied) return;
  await recordView(session.user.id, found.item.id);
};
