"use server";

import { listActivity } from "@devsbucket/db/activity";
import { activityPageSchema } from "@devsbucket/shared/activity-text";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveItem } from "@/lib/items";

// One page of an item's activity for the activity panel (decision 0017):
// the Owner and Editors only (`view_activity`).
export const loadActivity = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You're signed out. Sign in again." } as const;
  }
  const parsed = activityPageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request" } as const;
  }
  const found = await resolveItem(session.user, parsed.data.itemId, "view_activity");
  if (found.denied) {
    return { error: deniedMessage(found.denied, "This item no longer exists.") } as const;
  }
  const page = await listActivity(found.item.id, parsed.data.cursor);
  return { error: null, ...page } as const;
};
