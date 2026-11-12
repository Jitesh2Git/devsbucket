import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./client.ts";
import { invites } from "./schema/invites.ts";

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
