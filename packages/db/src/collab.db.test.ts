import { randomUUID } from "node:crypto";
import { TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { getCollabState, saveCollabState } from "./collab.ts";
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

const addFile = async (tx: Executor) => {
  const [user] = await tx
    .insert(users)
    .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
    .returning({ id: users.id });
  const [file] = await tx
    .insert(items)
    .values({ ownerId: user?.id ?? "", type: "file", name: "notes.md", size: 0 })
    .returning({ id: items.id });
  return file?.id ?? "";
};

describe("collab state", () => {
  afterAll(() => pool.end());

  it("is null until saved, then the same bytes, and a save replaces it", () =>
    withRollback(async (tx) => {
      const file = await addFile(tx);
      expect(await getCollabState(file, tx)).toBeNull();
      await saveCollabState(file, new Uint8Array([1, 2, 255]), tx);
      expect(Array.from((await getCollabState(file, tx)) ?? [])).toEqual([1, 2, 255]);
      await saveCollabState(file, new Uint8Array([7]), tx);
      expect(Array.from((await getCollabState(file, tx)) ?? [])).toEqual([7]);
    }));

  it("skips a file that no longer exists", () =>
    withRollback(async (tx) => {
      const gone = randomUUID();
      await saveCollabState(gone, new Uint8Array([1]), tx);
      expect(await getCollabState(gone, tx)).toBeNull();
    }));
});
