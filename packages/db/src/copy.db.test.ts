import { randomUUID } from "node:crypto";
import { and, eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { copyFile } from "./items.ts";
import { activities } from "./schema/activities.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";

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

// A user with a 1000-byte quota and a 300-byte notes.md at the top of
// their drive (its bytes already counted).
const setUp = async (tx: Executor) => {
  const [user] = await tx
    .insert(users)
    .values({
      name: "ada",
      email: `ada-${randomUUID()}@example.test`,
      storageQuota: 1000,
      storageUsed: 300,
    })
    .returning({ id: users.id });
  const ada = user?.id ?? "";
  const [file] = await tx
    .insert(items)
    .values({ ownerId: ada, type: "file", name: "notes.md", mimeType: "text/markdown", size: 300 })
    .returning();
  if (!file) throw new Error("no file");
  return { ada, source: file };
};

const copyOf = (ada: string, source: Awaited<ReturnType<typeof setUp>>["source"]) => ({
  source,
  ownerId: ada,
  parentId: null,
  createdBy: ada,
  storageKeyFor: (id: string) => `items/${id}`,
});

const used = async (tx: Executor, userId: string) =>
  (await tx.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)))[0]?.used;

describe("copyFile", () => {
  afterAll(() => pool.end());

  it("makes a ready copy with the same type and size, counts it, logs copied and copies the object", () =>
    withRollback(async (tx) => {
      const { ada, source } = await setUp(tx);
      const copied: string[] = [];
      const result = await copyFile(
        copyOf(ada, source),
        async (key) => {
          copied.push(key);
        },
        tx,
      );
      expect(result).toMatchObject({ ok: true, name: "notes (copy).md" });
      const [copy] = await tx
        .select()
        .from(items)
        .where(and(eq(items.ownerId, ada), eq(items.name, "notes (copy).md")));
      expect(copy).toMatchObject({
        type: "file",
        status: "ready",
        mimeType: "text/markdown",
        size: 300,
        createdBy: ada,
        storageKey: `items/${copy?.id}`,
      });
      expect(copied).toEqual([`items/${copy?.id}`]);
      expect(await used(tx, ada)).toBe(600);
      const logged = await tx
        .select({ action: activities.action, metadata: activities.metadata })
        .from(activities)
        .where(eq(activities.itemId, copy?.id ?? ""));
      expect(logged).toEqual([
        { action: "copied", metadata: { fromId: source.id, fromName: "notes.md" } },
      ]);

      const again = await copyFile(copyOf(ada, source), async () => {}, tx);
      expect(again).toMatchObject({ ok: true, name: "notes (copy) (1).md" });
    }));

  it("refuses a copy that doesn't fit in the quota, and changes nothing", () =>
    withRollback(async (tx) => {
      const { ada, source } = await setUp(tx);
      await tx.update(users).set({ storageUsed: 800 }).where(eq(users.id, ada));
      let called = false;
      const result = await copyFile(
        copyOf(ada, source),
        async () => {
          called = true;
        },
        tx,
      );
      expect(result).toEqual({ ok: false, reason: "quota", used: 800, quota: 1000 });
      expect(called).toBe(false);
      expect(await used(tx, ada)).toBe(800);
    }));

  it("leaves no row and gives the space back when storage fails", () =>
    withRollback(async (tx) => {
      const { ada, source } = await setUp(tx);
      const failing = async () => {
        throw new Error("storage is down");
      };
      await expect(copyFile(copyOf(ada, source), failing, tx)).rejects.toThrow("storage is down");
      expect(await tx.select().from(items).where(eq(items.ownerId, ada))).toHaveLength(1);
      expect(await used(tx, ada)).toBe(300);
    }));
});
