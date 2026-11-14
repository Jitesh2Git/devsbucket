import { randomUUID } from "node:crypto";
import { eq, like, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkOpsAlerts,
  checkStorageAlerts,
  notifyInviteUsed,
  warnTrashEmptying,
} from "./alerts.ts";
import { db, type Executor, pool } from "./client.ts";
import { alertStates } from "./schema/alert-states.ts";
import { users } from "./schema/auth.ts";
import { invites } from "./schema/invites.ts";
import { items } from "./schema/items.ts";
import { notifications } from "./schema/notifications.ts";
import { usageCounters } from "./schema/usage.ts";
import { currentMonth } from "./usage.ts";

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

const addUser = async (
  tx: Executor,
  name: string,
  values: Partial<typeof users.$inferInsert> = {},
) => {
  const [user] = await tx
    .insert(users)
    .values({ name, email: `${name}-${randomUUID()}@example.test`, ...values })
    .returning({ id: users.id });
  return user?.id ?? "";
};

const typesFor = async (tx: Executor, userId: string) =>
  (
    await tx
      .select({ type: notifications.type, count: notifications.count })
      .from(notifications)
      .where(eq(notifications.recipientId, userId))
      .orderBy(notifications.createdAt, notifications.id)
  ).map((n) => (n.count > 1 ? `${n.type} ×${n.count}` : n.type));

const setUsed = (tx: Executor, userId: string, storageUsed: number) =>
  tx.update(users).set({ storageUsed }).where(eq(users.id, userId));

afterAll(async () => {
  await pool.end();
});

describe("checkStorageAlerts", () => {
  it("tells once per threshold, and again only after usage dropped back", async () => {
    await withRollback(async (tx) => {
      const ada = await addUser(tx, "ada", { storageQuota: 100, storageUsed: 85 });
      await checkStorageAlerts(tx);
      await checkStorageAlerts(tx);
      expect(await typesFor(tx, ada)).toEqual(["storage_80"]);
      await setUsed(tx, ada, 100);
      await checkStorageAlerts(tx);
      expect(await typesFor(tx, ada)).toEqual(["storage_80", "storage_full"]);
      await setUsed(tx, ada, 50);
      await checkStorageAlerts(tx);
      await setUsed(tx, ada, 85);
      await checkStorageAlerts(tx);
      expect(await typesFor(tx, ada)).toEqual(["storage_80", "storage_full", "storage_80"]);
    });
  });

  it("tells only the highest threshold crossed at once", async () => {
    await withRollback(async (tx) => {
      const bob = await addUser(tx, "bob", { storageQuota: 100, storageUsed: 96 });
      await checkStorageAlerts(tx);
      expect(await typesFor(tx, bob)).toEqual(["storage_95"]);
    });
  });
});

describe("checkOpsAlerts", () => {
  it("tells admins only, once a month", async () => {
    await withRollback(async (tx) => {
      // This month's alerts may be left in the shared test database by an
      // e2e run; start from none (rolled back with the rest).
      await tx.delete(alertStates).where(like(alertStates.key, "r2_ops_%"));
      const admin = await addUser(tx, "admin", { isAdmin: true });
      const member = await addUser(tx, "member");
      await tx
        .insert(usageCounters)
        .values({ month: currentMonth(), classAOps: 750_000, classBOps: 0 })
        .onConflictDoUpdate({ target: usageCounters.month, set: { classAOps: 750_000 } });
      await checkOpsAlerts(tx);
      await checkOpsAlerts(tx);
      expect(await typesFor(tx, admin)).toEqual(["r2_ops_70"]);
      expect(await typesFor(tx, member)).toEqual([]);
    });
  });
});

describe("warnTrashEmptying", () => {
  it("warns each owner once per item, with how many", async () => {
    await withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const old = new Date(Date.now() - 28 * 86_400_000);
      const trashed = { ownerId: ada, type: "folder" as const, trashRoot: true, trashedAt: old };
      await tx.insert(items).values([
        { ...trashed, name: "a" },
        { ...trashed, name: "b" },
        // Trashed recently: not yet.
        { ...trashed, name: "c", trashedAt: new Date() },
      ]);
      await warnTrashEmptying(tx);
      await warnTrashEmptying(tx);
      expect(await typesFor(tx, ada)).toEqual(["trash_emptying ×2"]);
    });
  });
});

describe("notifyInviteUsed", () => {
  it("tells whoever made the invite, or every admin", async () => {
    await withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const admin = await addUser(tx, "admin", { isAdmin: true });
      const newcomer = await addUser(tx, "newcomer");
      const expiresAt = new Date(Date.now() + 86_400_000);
      await tx.insert(invites).values([
        { code: `by-ada-${randomUUID()}`, createdBy: ada, expiresAt },
        { code: `by-seed-${randomUUID()}`, expiresAt },
      ]);
      const [byAda, bySeed] = await tx
        .select({ code: invites.code })
        .from(invites)
        .where(eq(invites.expiresAt, expiresAt))
        .orderBy(invites.code);
      await notifyInviteUsed({ code: byAda?.code ?? "", userId: newcomer }, tx);
      expect(await typesFor(tx, ada)).toEqual(["invite_used"]);
      expect(await typesFor(tx, admin)).toEqual([]);
      await notifyInviteUsed({ code: bySeed?.code ?? "", userId: newcomer }, tx);
      expect(await typesFor(tx, admin)).toEqual(["invite_used"]);
    });
  });
});
