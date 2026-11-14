import { randomUUID } from "node:crypto";
import { and, eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { activities } from "./schema/activities.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { ownershipTransfers } from "./schema/ownership-transfers.ts";
import { itemPermissions } from "./schema/permissions.ts";
import {
  acceptTransfer,
  cancelTransfer,
  declineTransfer,
  getPendingTransfer,
  offerTransfer,
} from "./transfers.ts";

const withRollback = async (fn: (tx: Executor) => Promise<void>) => {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
};

const addUser = async (tx: Executor, name: string, storageUsed = 0) => {
  const [user] = await tx
    .insert(users)
    .values({ name, email: `${name}-${randomUUID()}@example.test`, storageUsed })
    .returning({ id: users.id });
  return user?.id ?? "";
};

const addItem = async (
  tx: Executor,
  values: { ownerId: string; parentId?: string; name: string; size?: number },
) => {
  const [item] = await tx
    .insert(items)
    .values({ type: values.size === undefined ? "folder" : "file", ...values })
    .returning({ id: items.id });
  return item?.id ?? "";
};

// Ada owns Projects / Team / {plan.txt (5 B), Web / b.txt (7 B)}: 12 bytes
// in Team. Bob is a Viewer on Team and an Editor on Web, and already has a
// "Team" of his own at the top of his drive.
const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada", 12);
  const bob = await addUser(tx, "bob");
  const projects = await addItem(tx, { ownerId: ada, name: "Projects" });
  const team = await addItem(tx, { ownerId: ada, parentId: projects, name: "Team" });
  const plan = await addItem(tx, { ownerId: ada, parentId: team, name: "plan.txt", size: 5 });
  const web = await addItem(tx, { ownerId: ada, parentId: team, name: "Web" });
  const b = await addItem(tx, { ownerId: ada, parentId: web, name: "b.txt", size: 7 });
  await addItem(tx, { ownerId: bob, name: "Team" });
  await tx.insert(itemPermissions).values([
    { itemId: team, userId: bob, role: "viewer" },
    { itemId: web, userId: bob, role: "editor" },
  ]);
  await offerTransfer({ itemId: team, fromUserId: ada, toUserId: bob }, tx);
  const transfer = await getPendingTransfer(team, tx);
  return { ada, bob, projects, team, plan, web, b, transferId: transfer?.id ?? "" };
};

const used = async (tx: Executor, userId: string) =>
  (await tx.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)))[0]?.used;

afterAll(async () => {
  await pool.end();
});

describe("acceptTransfer", () => {
  it("moves the whole tree to the top of the recipient's drive, with its bytes", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team, plan, b, transferId } = await setUp(tx);
      expect(await acceptTransfer({ transferId, itemId: team, userId: bob }, tx)).toEqual({
        ok: true,
        itemId: team,
        name: "Team (1)",
      });
      const [moved] = await tx.select().from(items).where(eq(items.id, team));
      expect(moved).toMatchObject({ ownerId: bob, parentId: null, name: "Team (1)" });
      for (const id of [plan, b]) {
        const [inside] = await tx
          .select({ ownerId: items.ownerId })
          .from(items)
          .where(eq(items.id, id));
        expect(inside?.ownerId).toBe(bob);
      }
      expect([await used(tx, ada), await used(tx, bob)]).toEqual([0, 12]);
      const grants = await tx
        .select({ userId: itemPermissions.userId, role: itemPermissions.role })
        .from(itemPermissions)
        .where(eq(itemPermissions.itemId, team));
      // The old owner is an Editor; Bob's own grants inside are gone.
      expect(grants).toEqual([{ userId: ada, role: "editor" }]);
      expect(
        await tx.select().from(itemPermissions).where(eq(itemPermissions.userId, bob)),
      ).toEqual([]);
      expect(await getPendingTransfer(team, tx)).toBeNull();
      const logged = await tx
        .select({ action: activities.action })
        .from(activities)
        .where(eq(activities.itemId, team));
      expect(logged.map((row) => row.action)).toEqual([
        "ownership_offered",
        "ownership_transferred",
      ]);
    });
  });

  it("refuses when the recipient's quota can't take it, and changes nothing", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team, transferId } = await setUp(tx);
      await tx.update(users).set({ storageQuota: 10 }).where(eq(users.id, bob));
      expect(await acceptTransfer({ transferId, itemId: team, userId: bob }, tx)).toEqual({
        ok: false,
        reason: "quota",
        used: 0,
        quota: 10,
      });
      const [item] = await tx
        .select({ ownerId: items.ownerId })
        .from(items)
        .where(eq(items.id, team));
      expect(item?.ownerId).toBe(ada);
      expect([await used(tx, ada), await used(tx, bob)]).toEqual([12, 0]);
      expect(await getPendingTransfer(team, tx)).not.toBeNull();
    });
  });

  it("is blocked by something inside in the trash, or a pending upload", async () => {
    await withRollback(async (tx) => {
      const { bob, team, b, plan, transferId } = await setUp(tx);
      await tx.update(items).set({ trashedAt: new Date(), trashRoot: true }).where(eq(items.id, b));
      expect(await acceptTransfer({ transferId, itemId: team, userId: bob }, tx)).toMatchObject({
        reason: "trashed",
      });
      await tx.update(items).set({ trashedAt: null, trashRoot: false }).where(eq(items.id, b));
      await tx.update(items).set({ status: "pending" }).where(eq(items.id, plan));
      expect(await acceptTransfer({ transferId, itemId: team, userId: bob }, tx)).toMatchObject({
        reason: "upload",
      });
    });
  });

  it("only works for the recipient, once", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team, transferId } = await setUp(tx);
      expect(await acceptTransfer({ transferId, itemId: team, userId: ada }, tx)).toMatchObject({
        reason: "gone",
      });
      expect(await acceptTransfer({ transferId, itemId: team, userId: bob }, tx)).toMatchObject({
        ok: true,
      });
      expect(await acceptTransfer({ transferId, itemId: team, userId: bob }, tx)).toMatchObject({
        reason: "gone",
      });
    });
  });
});

describe("offers", () => {
  it("allows one pending offer per item; it can be cancelled or declined", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team, transferId } = await setUp(tx);
      expect(await offerTransfer({ itemId: team, fromUserId: ada, toUserId: bob }, tx)).toBe(false);
      expect(await declineTransfer({ transferId, userId: ada }, tx)).toBe(false);
      expect(await cancelTransfer(team, tx)).toBe(true);
      expect(await getPendingTransfer(team, tx)).toBeNull();
      await offerTransfer({ itemId: team, fromUserId: ada, toUserId: bob }, tx);
      const again = await getPendingTransfer(team, tx);
      expect(await declineTransfer({ transferId: again?.id ?? "", userId: bob }, tx)).toBe(true);
      const statuses = await tx
        .select({ status: ownershipTransfers.status })
        .from(ownershipTransfers)
        .where(and(eq(ownershipTransfers.itemId, team)));
      expect(statuses.map((row) => row.status).sort()).toEqual(["cancelled", "declined"]);
    });
  });
});
