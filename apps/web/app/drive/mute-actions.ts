"use server";

import { muteState, setMute } from "@devsbucket/db/notification-settings";
import { itemRefSchema } from "@devsbucket/shared/item";
import { muteSchema } from "@devsbucket/shared/notifications";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveItem } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";

// Muting changes only the caller's own notifications, but still needs a
// role on the item (`view`), so nobody learns about items they can't see.
const getSession = async () => auth.api.getSession({ headers: await headers() });

export const getMuteState = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request" } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "view");
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  return { error: null, ...(await muteState(session.user.id, found.item.id)) } as const;
};

export const setItemMute = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = muteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request" } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "view");
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  await setMute({ userId: session.user.id, ...parsed.data });
  return { error: null } as const;
};
