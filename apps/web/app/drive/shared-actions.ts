"use server";

import { leaveSharedItem as leaveRows } from "@devsbucket/db/shared-with-me";
import { itemRefSchema } from "@devsbucket/shared/item";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const SIGNED_OUT = "You're signed out. Sign in again.";

// "Remove from Shared with me": anyone may drop their own access (decision
// 0008), whatever their role, so this needs no can() check. It only ever
// touches the caller's own grant and link visits.
export const leaveSharedItem = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request" } as const;
  const removed = await leaveRows({ itemId: parsed.data.itemId, userId: session.user.id });
  if (!removed) return { error: "It's no longer shared with you." } as const;
  return { error: null } as const;
};
