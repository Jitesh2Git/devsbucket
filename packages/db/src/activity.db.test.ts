import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { logActivity } from "./activity.ts";
import { db, type Executor, pool } from "./client.ts";
import { QUEUES, stopSender } from "./jobs.ts";
import { activities } from "./schema/activities.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";

class Rollback extends Error {}

const addFolder = async (tx: Executor) => {
  const [user] = await tx
    .insert(users)
    .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
    .returning({ id: users.id });
  const [folder] = await tx
    .insert(items)
    .values({ ownerId: user?.id ?? "", type: "folder", name: "Projects" })
    .returning({ id: items.id });
  return { userId: user?.id ?? "", folderId: folder?.id ?? "" };
};

// The notify-activity jobs queued for one activity row.
const jobsFor = async (tx: Executor, activityId: string) => {
  const result = await tx.execute<{ count: number }>(sql`
    select count(*)::int as count from pgboss.job
    where name = ${QUEUES.notifyActivity} and data->>'activityId' = ${activityId}
  `);
  return result.rows[0]?.count ?? 0;
};

afterAll(async () => {
  await stopSender();
  await pool.end();
});

describe("logActivity", () => {
  it("commits the row and its job together", async () => {
    const { userId, folderId, activityId } = await db.transaction(async (tx) => {
      const ids = await addFolder(tx);
      const activityId = await logActivity(tx, {
        itemId: ids.folderId,
        actorId: ids.userId,
        action: "renamed",
        metadata: { from: "Old", to: "Projects" },
      });
      return { ...ids, activityId };
    });
    const [row] = await db.select().from(activities).where(eq(activities.id, activityId));
    expect(row).toMatchObject({
      itemId: folderId,
      actorId: userId,
      action: "renamed",
      metadata: { from: "Old", to: "Projects" },
    });
    expect(await jobsFor(db, activityId)).toBe(1);
    // Clean up: the user's items and their activity go with them.
    await db.delete(users).where(eq(users.id, userId));
    await db.execute(sql`delete from pgboss.job where data->>'activityId' = ${activityId}`);
  });

  it("leaves neither the row nor the job when the action rolls back", async () => {
    let activityId = "";
    await expect(
      db.transaction(async (tx) => {
        const { userId, folderId } = await addFolder(tx);
        activityId = await logActivity(tx, {
          itemId: folderId,
          actorId: userId,
          action: "trashed",
          metadata: {},
        });
        // Both are there inside the transaction...
        expect(await jobsFor(tx, activityId)).toBe(1);
        // ...until the action fails.
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    expect(await db.select().from(activities).where(eq(activities.id, activityId))).toEqual([]);
    expect(await jobsFor(db, activityId)).toBe(0);
  });

  it("refuses an action the database doesn't know", async () => {
    await expect(
      db.transaction(async (tx) => {
        const { userId, folderId } = await addFolder(tx);
        await tx.execute(
          sql`insert into activities (item_id, actor_id, action) values (${folderId}, ${userId}, 'hacked')`,
        );
      }),
    ).rejects.toThrow();
  });
});
