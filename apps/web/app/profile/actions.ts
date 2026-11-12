"use server";

import { setUsername } from "@devsbucket/db/users";
import { setUsernameSchema } from "@devsbucket/shared/user";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Server actions are public HTTP endpoints: check who's calling and validate
// the input here, whatever the form already did.
export const updateUsername = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You're signed out. Sign in again." };
  }

  const parsed = setUsernameSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid username" };
  }

  // Only ever the signed-in user's own row: the id comes from the session,
  // never from the client.
  const result = await setUsername(session.user.id, parsed.data.username);
  if (!result.ok) {
    return { error: "That username is taken." };
  }
  return { error: null, username: parsed.data.username };
};
