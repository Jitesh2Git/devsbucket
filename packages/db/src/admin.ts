// What the admin page (apps/web/app/admin) reads, and the changes that only
// it makes. The changes it shares with `pnpm admin` live in users.ts and
// invites.ts.
import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./client.ts";
import { sessions, users } from "./schema/auth.ts";
import { invites } from "./schema/invites.ts";

// Every account, oldest first, with how many sessions are still valid.
// Capped: a $0 app has a handful of users; a search can come later.
export const listUsers = async () => {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      storageUsed: users.storageUsed,
      storageQuota: users.storageQuota,
      createdAt: users.createdAt,
      sessions: count(sessions.id),
    })
    .from(users)
    .leftJoin(sessions, and(eq(sessions.userId, users.id), gt(sessions.expiresAt, sql`now()`)))
    .groupBy(users.id)
    .orderBy(users.createdAt)
    .limit(500);
};

export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

export const getUserById = async (id: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
};

const usedBy = alias(users, "used_by");

// The newest invites first, with who used each one. `expired` is decided by
// Postgres's clock, like the sign-up check.
export const listInvites = async () => {
  return db
    .select({
      id: invites.id,
      code: invites.code,
      email: invites.email,
      usedAt: invites.usedAt,
      usedByEmail: usedBy.email,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
      expired: sql<boolean>`${invites.expiresAt} <= now()`,
    })
    .from(invites)
    .leftJoin(usedBy, eq(usedBy.id, invites.usedBy))
    .orderBy(desc(invites.createdAt))
    .limit(100);
};

export type AdminInvite = Awaited<ReturnType<typeof listInvites>>[number];

// Deletes an invite nobody has used yet. Returns false if it was used (or
// gone) meanwhile: a used invite stays, as the record of who invited whom.
export const revokeInvite = async (id: string) => {
  const deleted = await db
    .delete(invites)
    .where(and(eq(invites.id, id), isNull(invites.usedAt)))
    .returning({ id: invites.id });
  return deleted.length > 0;
};
