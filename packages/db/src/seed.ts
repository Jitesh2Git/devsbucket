import { and, gt, isNull } from "drizzle-orm";
import { db, pool } from "./client.ts";
import { createInvite } from "./invites.ts";
import { invites } from "./schema/invites.ts";

// Safe to run many times: reuses an open invite instead of creating another.
const seed = async () => {
  const [open] = await db
    .select()
    .from(invites)
    .where(and(isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
    .limit(1);

  if (open) {
    console.log(
      `Open invite already exists: ${open.code} (expires ${open.expiresAt.toISOString()})`,
    );
    return;
  }

  const created = await createInvite();
  console.log(`Created invite: ${created.code} (expires ${created.expiresAt.toISOString()})`);
};

try {
  await seed();
} finally {
  await pool.end();
}
