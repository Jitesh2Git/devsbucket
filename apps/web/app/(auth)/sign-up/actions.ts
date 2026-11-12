"use server";

import { findOpenInvite } from "@devsbucket/db/invites";
import { inviteCodeSchema } from "@devsbucket/shared/auth";
import { cookies } from "next/headers";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE } from "@/lib/invite-cookie";

// Step 1 of sign-up: check the code and remember it in a cookie.
// Setting a cookie in a server action re-renders the page, which then
// shows the account form. The invite is only used up when the account
// is created (see the hook in lib/auth.ts).
export const acceptInvite = async (input: unknown) => {
  const parsed = inviteCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter your invite code" };
  }

  const invite = await findOpenInvite(parsed.data.code);
  if (!invite) {
    return { error: "This invite code is invalid, used or expired." };
  }

  const cookieStore = await cookies();
  cookieStore.set(INVITE_COOKIE, invite.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE,
  });
  return { error: null };
};
