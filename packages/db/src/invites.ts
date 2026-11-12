import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./client.ts";
import { invites } from "./schema/invites.ts";

// An invite that can still be used: right code, unused, not expired.
export const findOpenInvite = async (code: string) => {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.code, code), isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  return invite ?? null;
};
