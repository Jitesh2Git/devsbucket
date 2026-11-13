import { and, eq, sql } from "drizzle-orm";
import { db } from "./client.ts";
import { isUniqueViolation } from "./errors.ts";
import type { StorageCleanup } from "./jobs.ts";
import { accounts, sessions, users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";

// Usernames are unique (see schema/auth.ts), so a race between two people
// picking the same name is settled by the database, not by a lookup first.
export const setUsername = async (userId: string, username: string) => {
  try {
    await db.update(users).set({ username }).where(eq(users.id, userId));
    return { ok: true } as const;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "taken" } as const;
    }
    throw error;
  }
};

// Better Auth stores emails in lowercase.
export const findUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user ?? null;
};

// Replaces the user's password with an already hashed one and signs them
// out everywhere. A GitHub-only account gets its first password (the
// "credential" account Better Auth's email sign-up would have made).
export const setPasswordHash = async (userId: string, hash: string) => {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(accounts)
      .set({ password: hash })
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (updated.length === 0) {
      await tx
        .insert(accounts)
        .values({ userId, accountId: userId, providerId: "credential", password: hash });
    }
    const revoked = await tx
      .delete(sessions)
      .where(eq(sessions.userId, userId))
      .returning({ id: sessions.id });
    return { addedPassword: updated.length === 0, sessionsRevoked: revoked.length };
  });
};

// Signs the user out everywhere: every device's next request has no session.
export const deleteSessions = async (userId: string) => {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });
  return deleted.length;
};

export const setAdmin = async (userId: string, isAdmin: boolean) => {
  await db.update(users).set({ isAdmin }).where(eq(users.id, userId));
};

export const setQuota = async (userId: string, bytes: number) => {
  await db.update(users).set({ storageQuota: bytes }).where(eq(users.id, userId));
};

// Deletes the account and everything it owns, in one transaction: items,
// sessions and accounts go with the user row (on delete cascade). Their
// bytes leave with the row, so the app-wide total stays right. Returns what
// storage still has to delete, like deleteForever in trash.ts.
export const deleteUser = async (userId: string): Promise<StorageCleanup> => {
  return db.transaction(async (tx) => {
    // Waits for uploads, trash and moves in progress on this drive.
    await tx.execute(sql`select 1 from ${users} where id = ${userId} for update`);
    const files = await tx
      .select({ storageKey: items.storageKey, uploadId: items.uploadId })
      .from(items)
      .where(and(eq(items.ownerId, userId), sql`${items.storageKey} is not null`));
    await tx.delete(users).where(eq(users.id, userId));
    return {
      storageKeys: files.flatMap((file) => (file.storageKey ? [file.storageKey] : [])),
      uploads: files.flatMap((file) =>
        file.storageKey && file.uploadId ? [{ key: file.storageKey, uploadId: file.uploadId }] : [],
      ),
    };
  });
};
