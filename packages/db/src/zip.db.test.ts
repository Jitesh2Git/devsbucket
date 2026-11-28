import { randomUUID } from "node:crypto";
import { TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { listZipEntries, zipSummary } from "./zip.ts";

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

describe("ZIP tree", () => {
  afterAll(() => pool.end());

  it("lists everything below the folder with paths, skipping trashed and pending items", () =>
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
      const project = await add("Project", null, { type: "folder", size: null });
      const other = await add("Other", null, { type: "folder", size: null });
      await add("a.txt", project);
      const src = await add("src", project, { type: "folder", size: null });
      await add("b.ts", src, { size: 20 });
      await add("empty", src, { type: "folder", size: null });
      await add("old.txt", project, { trashedAt: new Date(), trashRoot: true });
      await add("uploading.bin", project, { status: "pending" });
      await add("elsewhere.txt", other);

      expect(await zipSummary(project, tx)).toEqual({ files: 2, bytes: 30 });
      expect((await listZipEntries(project, tx)).map((entry) => [entry.type, entry.path])).toEqual([
        ["file", "a.txt"],
        ["folder", "src"],
        ["file", "src/b.ts"],
        ["folder", "src/empty"],
      ]);
      expect(await zipSummary(src, tx)).toEqual({ files: 1, bytes: 20 });
    }));

  it("starts from selected items: files at the top, folders with what's inside", () =>
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
      const notes = await add("notes.txt", null);
      const docs = await add("Docs", null, { type: "folder", size: null });
      await add("plan.md", docs, { size: 5 });
      await add("left-out.txt", null);
      const trashed = await add("old.txt", null, { trashedAt: new Date(), trashRoot: true });

      const roots = { itemIds: [notes, docs, trashed] };
      expect(await zipSummary(roots, tx)).toEqual({ files: 2, bytes: 15 });
      expect((await listZipEntries(roots, tx)).map((entry) => [entry.type, entry.path])).toEqual([
        ["folder", "Docs"],
        ["file", "Docs/plan.md"],
        ["file", "notes.txt"],
      ]);
    }));

  it("counts an empty folder as no files", () =>
    withRollback(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
        .returning({ id: users.id });
      const [folder] = await tx
        .insert(items)
        .values({ ownerId: user?.id ?? "", name: "Empty", type: "folder" })
        .returning({ id: items.id });
      expect(await zipSummary(folder?.id ?? "", tx)).toEqual({ files: 0, bytes: 0 });
      expect(await listZipEntries(folder?.id ?? "", tx)).toEqual([]);
    }));
});
