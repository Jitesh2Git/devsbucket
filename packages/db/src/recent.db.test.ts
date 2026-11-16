import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { listRecent, RECENT_KEPT, recordView } from "./recent.ts";
import { users } from "./schema/auth.ts";
import { itemViews } from "./schema/item-views.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";

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

const addUser = async (tx: Executor, name: string) => {
  const [user] = await tx
    .insert(users)
    .values({ name, email: `${name}-${randomUUID()}@example.test` })
    .returning({ id: users.id });
  return user?.id ?? "";
};

const addFiles = async (tx: Executor, ownerId: string, names: string[]) => {
  const rows = await tx
    .insert(items)
    .values(names.map((name) => ({ ownerId, type: "file" as const, name, size: 1 })))
    .returning({ id: items.id });
  return rows.map((row) => row.id);
};

const names = async (userId: string, tx: Executor) =>
  (await listRecent(userId, tx)).map((item) => item.name);

describe("recent", () => {
  afterAll(() => pool.end());

  it("lists opened files newest first, and opening one again moves it to the top", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const [a, b] = await addFiles(tx, ada, ["a.md", "b.md"]);
      expect(await names(ada, tx)).toEqual([]);
      await recordView(ada, a ?? "", tx);
      await recordView(ada, b ?? "", tx);
      expect(await names(ada, tx)).toEqual(["b.md", "a.md"]);
      await recordView(ada, a ?? "", tx);
      expect(await names(ada, tx)).toEqual(["a.md", "b.md"]);
    }));

  it("hides trashed files and files no longer shared, and shows them again when shared", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const bob = await addUser(tx, "bob");
      const [trashed, shared] = await addFiles(tx, ada, ["old.md", "team.md"]);
      await tx
        .insert(itemPermissions)
        .values({ itemId: shared ?? "", userId: bob, role: "viewer" });
      await recordView(bob, shared ?? "", tx);
      await recordView(ada, trashed ?? "", tx);
      expect(await names(bob, tx)).toEqual(["team.md"]);
      expect((await listRecent(bob, tx))[0]?.ownerName).toBe("ada");

      await tx
        .update(items)
        .set({ trashedAt: new Date(), trashRoot: true })
        .where(eq(items.id, trashed ?? ""));
      expect(await names(ada, tx)).toEqual([]);

      await tx.delete(itemPermissions).where(eq(itemPermissions.itemId, shared ?? ""));
      expect(await names(bob, tx)).toEqual([]);
      await tx
        .insert(itemPermissions)
        .values({ itemId: shared ?? "", userId: bob, role: "editor" });
      expect(await names(bob, tx)).toEqual(["team.md"]);
    }));

  it(`keeps the newest ${RECENT_KEPT} views per person`, () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const bob = await addUser(tx, "bob");
      const files = await addFiles(
        tx,
        ada,
        Array.from({ length: RECENT_KEPT + 1 }, (_, i) => `f${i}.md`),
      );
      await recordView(bob, files[0] ?? "", tx);
      for (const file of files) {
        await recordView(ada, file, tx);
      }
      const kept = await tx.select().from(itemViews).where(eq(itemViews.userId, ada));
      expect(kept).toHaveLength(RECENT_KEPT);
      expect(kept.some((row) => row.itemId === files[0])).toBe(false);
      // Someone else's views aren't touched.
      expect(await tx.select().from(itemViews).where(eq(itemViews.userId, bob))).toHaveLength(1);
    }));
});
