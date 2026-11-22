import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { sizeOrFolderSize } from "./folder-size.ts";
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

describe("sizeOrFolderSize", () => {
  afterAll(() => pool.end());

  it("adds up the ready files below a folder in the same state as it", () =>
    withRollback(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
        .returning({ id: users.id });
      const ownerId = user?.id ?? "";
      const add = async (
        name: string,
        parentId: string | null,
        extra: Partial<typeof items.$inferInsert> = {},
      ) => {
        const [item] = await tx
          .insert(items)
          .values({ ownerId, parentId, name, type: "file", size: 10, ...extra })
          .returning({ id: items.id });
        return item?.id ?? "";
      };
      const sizeOf = async (id: string) => {
        const [row] = await tx
          .select({ size: sizeOrFolderSize("items") })
          .from(items)
          .where(eq(items.id, id));
        return row?.size;
      };

      const project = await add("Project", null, { type: "folder", size: null });
      const file = await add("a.txt", project);
      const src = await add("src", project, { type: "folder", size: null });
      await add("b.ts", src, { size: 20 });
      const empty = await add("empty", src, { type: "folder", size: null });
      await add("old.txt", project, { trashedAt: new Date(), trashRoot: true });
      await add("uploading.bin", project, { status: "pending" });

      expect(await sizeOf(file)).toBe(10);
      expect(await sizeOf(project)).toBe(30);
      expect(await sizeOf(src)).toBe(20);
      expect(await sizeOf(empty)).toBe(0);

      // Trashed with its contents (one timestamp, like trashItem): the
      // folder in the Trash still counts them; a file trashed before doesn't.
      const trashedAt = new Date("2026-01-01T00:00:00Z");
      const box = await add("Box", null, {
        type: "folder",
        size: null,
        trashedAt,
        trashRoot: true,
      });
      await add("c.txt", box, { size: 5, trashedAt });
      await add("d.txt", box, { size: 7, trashedAt: new Date("2025-12-01T00:00:00Z") });
      expect(await sizeOf(box)).toBe(5);
    }));
});
