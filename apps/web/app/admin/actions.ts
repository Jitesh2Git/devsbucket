"use server";

import { type AdminAction, canAdmin } from "@devsbucket/authz/admin";
import { getUserById, revokeInvite as revokeInviteRow } from "@devsbucket/db/admin";
import { createInvite as createInviteRow } from "@devsbucket/db/invites";
import { deleteSessions, setAdmin, setPasswordHash, setQuota } from "@devsbucket/db/users";
import {
  createInviteSchema,
  inviteRefSchema,
  setAdminSchema,
  setQuotaSchema,
  userRefSchema,
} from "@devsbucket/shared/admin";
import { formatBytes, parseBytes } from "@devsbucket/shared/bytes";
import { removeUser as removeUserForever } from "@devsbucket/storage/cleanup";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const NOT_ALLOWED = "You can't do that.";
const INVALID = "Invalid input.";
const USER_GONE = "This user no longer exists.";

// Server actions are public endpoints: each one checks the session and
// canAdmin() itself. Being on /admin proves nothing.
const getAdmin = async (action: AdminAction, target?: { id: string }) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdmin(session.user, action, target)) {
    return null;
  }
  return session.user;
};

// The user an action is about, if the caller may do it to them: some
// actions can't be done to yourself (canAdmin).
const targetUser = async (userId: string, action: AdminAction) => {
  if (!(await getAdmin(action, { id: userId }))) {
    return { error: NOT_ALLOWED } as const;
  }
  const user = await getUserById(userId);
  return user ? ({ error: null, user } as const) : ({ error: USER_GONE } as const);
};

// A new random password, shown to the admin once; their sessions end.
export const resetPassword = async (input: unknown) => {
  const parsed = userRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const target = await targetUser(parsed.data.userId, "reset_password");
  if (target.error !== null) return target;
  // 20 characters from 62: about 119 bits, within the 8–128 sign-up rule.
  const password = generateRandomString(20, "a-z", "A-Z", "0-9");
  await setPasswordHash(target.user.id, await hashPassword(password));
  return { error: null, password } as const;
};

export const updateQuota = async (input: unknown) => {
  const parsed = setQuotaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? INVALID } as const;
  const target = await targetUser(parsed.data.userId, "set_quota");
  if (target.error !== null) return target;
  const bytes = parseBytes(parsed.data.size);
  await setQuota(target.user.id, bytes);
  return { error: null, quota: formatBytes(bytes) } as const;
};

export const updateAdmin = async (input: unknown) => {
  const parsed = setAdminSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const target = await targetUser(parsed.data.userId, "set_admin");
  if (target.error !== null) return target;
  await setAdmin(target.user.id, parsed.data.isAdmin);
  return { error: null } as const;
};

export const signOutUser = async (input: unknown) => {
  const parsed = userRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const target = await targetUser(parsed.data.userId, "sign_out");
  if (target.error !== null) return target;
  return { error: null, sessions: await deleteSessions(target.user.id) } as const;
};

// Their account and every file they own, forever (the same path as
// `pnpm admin remove-user`).
export const removeUser = async (input: unknown) => {
  const parsed = userRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const target = await targetUser(parsed.data.userId, "remove_user");
  if (target.error !== null) return target;
  const { files } = await removeUserForever(target.user.id);
  return { error: null, files } as const;
};

export const createInvite = async (input: unknown) => {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? INVALID } as const;
  }
  if (!(await getAdmin("manage_invites"))) {
    return { error: NOT_ALLOWED } as const;
  }
  const invite = await createInviteRow({ email: parsed.data.email || undefined });
  return { error: null, code: invite.code } as const;
};

export const revokeInvite = async (input: unknown) => {
  const parsed = inviteRefSchema.safeParse(input);
  if (!parsed.success) {
    return { error: INVALID } as const;
  }
  if (!(await getAdmin("manage_invites"))) {
    return { error: NOT_ALLOWED } as const;
  }
  if (!(await revokeInviteRow(parsed.data.inviteId))) {
    return { error: "This invite was used or already revoked." } as const;
  }
  return { error: null } as const;
};
