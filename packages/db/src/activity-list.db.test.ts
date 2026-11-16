import { randomUUID } from "node:crypto";
import { TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { ACTIVITY_PAGE, listActivity } from "./activity.ts";
import { db, type Executor, pool } from "./client.ts";
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

const addUser = async (tx: Executor, name: string) => {
  const [user] = await tx
    .insert(users)
    .values({ name, email: `${name}-${randomUUID()}@example.test` })
    .returning({ id: users.id });
  return user?.id ?? "";
};

const addItem = async (tx: Executor, ownerId: string, type: "file" | "folder", name: string) => {
  const [item] = await tx
    .insert(items)
    .values({ ownerId, type, name, size: type === "file" ? 1 : null })
    .returning({ id: items.id });
  return item?.id ?? "";
};

describe("listActivity", () => {
  afterAll(() => pool.end());

  it("pages newest first without skipping or repeating rows, even with equal times", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const file = await addItem(tx, ada, "file", "notes.md");
      const total = ACTIVITY_PAGE + 2;
      // Three rows share one time, so the order falls back to the id.
      const at = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, i < 3 ? 0 : i));
      await tx.insert(activities).values(
        Array.from({ length: total }, (_, i) => ({
          itemId: file,
          actorId: ada,
          action: "downloaded" as const,
          metadata: {},
          createdAt: at(i),
        })),
      );

      const first = await listActivity(file, null, tx);
      expect(first.rows).toHaveLength(ACTIVITY_PAGE);
      expect(first.rows[0]?.createdAt).toEqual(at(total - 1));
      expect(first.rows[0]?.actorName).toBe("ada");
      expect(first.next).not.toBeNull();

      const second = await listActivity(file, first.next, tx);
      expect(second.rows).toHaveLength(2);
      expect(second.next).toBeNull();
      const ids = [...first.rows, ...second.rows].map((row) => row.id);
      expect(new Set(ids).size).toBe(total);
    }));

  it("looks up the people and folders the rows point to, and only the item's own rows", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const bob = await addUser(tx, "bob");
      const docs = await addItem(tx, ada, "folder", "Docs");
      const file = await addItem(tx, ada, "file", "notes.md");
      await tx.insert(activities).values([
        { itemId: file, actorId: ada, action: "shared", metadata: { userId: bob, role: "editor" } },
        { itemId: file, actorId: ada, action: "moved", metadata: { from: null, to: docs } },
        { itemId: file, actorId: null, action: "trashed", metadata: {} },
        { itemId: docs, actorId: ada, action: "created", metadata: {} },
      ]);

      const page = await listActivity(file, null, tx);
      expect(page.rows.map((row) => row.action).sort()).toEqual(["moved", "shared", "trashed"]);
      expect(page.names).toEqual({ [bob]: "bob", [docs]: "Docs" });
      expect(page.rows.find((row) => row.action === "trashed")?.actorName).toBeNull();
      expect((await listActivity(docs, null, tx)).rows.map((row) => row.action)).toEqual([
        "created",
      ]);
    }));
});
