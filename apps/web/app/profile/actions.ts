"use server";

import { setUsername } from "@devsbucket/db/users";
import { setPasswordSchema } from "@devsbucket/shared/auth";
import { setUsernameSchema } from "@devsbucket/shared/user";
import { APIError } from "better-auth/api";
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

// GitHub sign-ups have no password. Better Auth's setPassword is server-only
// (no public URL), adds an email-and-password sign-in for the session's user,
// and refuses if a password already exists (that's what change password is
// for), so it can never overwrite one.
export const setPassword = async (input: unknown) => {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return { error: "You're signed out. Sign in again." };
  }

  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "PASSWORD_ALREADY_SET") {
      return { error: "You already have a password. Use Change password instead." };
    }
    throw error;
  }
  return { error: null };
};
