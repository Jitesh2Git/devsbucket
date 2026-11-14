import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./client.ts";
import { invites } from "./schema/invites.ts";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// An invite that can still be used: right code, unused, not expired.
// Uses the database clock (now()) rather than `new Date()`, which Next.js
// Cache Components rejects while rendering a page.
export const findOpenInvite = async (code: string) => {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.code, code), isNull(invites.usedAt), gt(invites.expiresAt, sql`now()`)))
    .limit(1);
  return invite ?? null;
};

// A new invite, valid for 7 days. With an email, only that address can use
// it (the sign-up hook in apps/web/lib/auth.ts checks it). `createdBy` hears
// when it's used; without one (seed, admin command), every admin does.
export const createInvite = async ({
  email,
  createdBy,
}: {
  email?: string;
  createdBy?: string;
} = {}) => {
  const [invite] = await db
    .insert(invites)
    .values({
      code: randomBytes(12).toString("base64url"),
      email: email?.toLowerCase(),
      createdBy,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    })
    .returning();
  if (!invite) {
    throw new Error("Failed to create invite");
  }
  return invite;
};
