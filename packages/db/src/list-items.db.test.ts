import { randomUUID } from "node:crypto";
import { sql, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { listItems, PAGE_SIZE } from "./items.ts";
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

describe("listItems", () => {
  afterAll(() => pool.end());

  it("lists the most recently modified first, folders and files together, page after page", () =>
    withRollback(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
        .returning({ id: users.id });
      const ownerId = user?.id ?? "";
      // `minutes` before a fixed moment, plus `micros` microseconds: rows a
      // few microseconds apart (one millisecond holds them all) must still
      // page in order, so the cursor can't be a JavaScript Date.
      const add = async (name: string, type: "file" | "folder", minutes: number, micros = 0) => {
        await tx.insert(items).values({
          ownerId,
          parentId: null,
          name,
          type,
          size: type === "file" ? 1 : null,
          updatedAt: sql`timestamptz '2026-11-01 12:00:00.000000+00' - make_interval(mins => ${minutes}) + make_interval(secs => ${micros / 1_000_000})`,
        });
      };

      await add("old folder", "folder", 59);
      await add("new folder", "folder", 1);
      // Files: one a minute apart, newest first is file-00 … file-46.
      for (let i = 0; i < 47; i++) {
        await add(`file-${String(i).padStart(2, "0")}`, "file", i + 2);
      }
      // Three more, older than all of those and microseconds apart: the
      // first page ends on tie-a (49 rows before it), so the next one
      // must start exactly between it and tie-b.
      await add("tie-a", "file", 60, 3);
      await add("tie-b", "file", 60, 2);
      await add("tie-c", "file", 60, 1);

      const first = await listItems({ ownerId, parentId: null, cursor: null }, tx);
      expect(first.items).toHaveLength(PAGE_SIZE);
      expect(first.nextCursor).not.toBeNull();
      const second = await listItems({ ownerId, parentId: null, cursor: first.nextCursor }, tx);
      expect(second.nextCursor).toBeNull();

      const names = [...first.items, ...second.items].map((item) => item.name);
      expect(names).toEqual([
        "new folder",
        ...Array.from({ length: 47 }, (_, i) => `file-${String(i).padStart(2, "0")}`),
        "old folder",
        "tie-a",
        "tie-b",
        "tie-c",
      ]);
      // The cursor is the last row's time exactly as Postgres prints it.
      expect(first.items.at(-1)?.name).toBe("tie-a");
      expect(first.nextCursor?.updatedAt).toBe("2026-11-01 11:00:00.000003+00");
    }));

  it("puts a renamed file at the top (renaming is a change)", () =>
    withRollback(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
        .returning({ id: users.id });
      const ownerId = user?.id ?? "";
      const [older] = await tx
        .insert(items)
        .values({
          ownerId,
          parentId: null,
          name: "older.txt",
          type: "file",
          size: 1,
          updatedAt: sql`now() - interval '1 day'`,
        })
        .returning({ id: items.id });
      await tx
        .insert(items)
        .values({ ownerId, parentId: null, name: "newer.txt", type: "file", size: 1 });

      const before = await listItems({ ownerId, parentId: null, cursor: null }, tx);
      expect(before.items.map((item) => item.name)).toEqual(["newer.txt", "older.txt"]);

      await tx.update(items).set({ name: "renamed.txt" }).where(sql`${items.id} = ${older?.id}`);
      const after = await listItems({ ownerId, parentId: null, cursor: null }, tx);
      expect(after.items.map((item) => item.name)).toEqual(["renamed.txt", "newer.txt"]);
    }));
});
