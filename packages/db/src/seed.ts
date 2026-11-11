import { randomBytes } from "node:crypto";
import { and, gt, isNull } from "drizzle-orm";
import { db, pool } from "./client.ts";
import { invites } from "./schema/invites.ts";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Safe to run many times: reuses an open invite instead of creating another.
const seed = async () => {
  const [open] = await db
    .select()
    .from(invites)
    .where(and(isNull(invites.usedBy), gt(invites.expiresAt, new Date())))
    .limit(1);

  if (open) {
    console.log(
      `Open invite already exists: ${open.code} (expires ${open.expiresAt.toISOString()})`,
    );
    return;
  }

  const [created] = await db
    .insert(invites)
    .values({
      code: randomBytes(12).toString("base64url"),
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create invite");
  }

  console.log(`Created invite: ${created.code} (expires ${created.expiresAt.toISOString()})`);
};

try {
  await seed();
} finally {
  await pool.end();
}
