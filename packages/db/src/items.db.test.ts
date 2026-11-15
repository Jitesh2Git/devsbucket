import { randomUUID } from "node:crypto";
import { and, eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { createTextFile } from "./items.ts";
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

const addUser = async (tx: Executor) => {
  const [user] = await tx
    .insert(users)
    .values({ name: "ada", email: `ada-${randomUUID()}@example.test` })
    .returning({ id: users.id });
  return user?.id ?? "";
};

const newFile = (ownerId: string, name: string) => ({
  ownerId,
  parentId: null,
  createdBy: ownerId,
  name,
  storageKeyFor: (id: string) => `items/${id}`,
});

const filesNamed = (tx: Executor, ownerId: string, name: string) =>
  tx
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), eq(items.name, name)));

describe("createTextFile", () => {
  afterAll(() => pool.end());

  it("makes an empty ready file, stores its object and logs created", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx);
      const stored: string[] = [];
      const result = await createTextFile(
        newFile(ada, "notes.md"),
        async (key) => {
          stored.push(key);
        },
        tx,
      );
      expect(result.ok).toBe(true);
      const [file] = await filesNamed(tx, ada, "notes.md");
      expect(file).toMatchObject({
        type: "file",
        status: "ready",
        size: 0,
        mimeType: "text/plain",
        storageKey: `items/${file?.id}`,
      });
      expect(stored).toEqual([`items/${file?.id}`]);
      const logged = await tx
        .select({ action: activities.action, actorId: activities.actorId })
        .from(activities)
        .where(eq(activities.itemId, file?.id ?? ""));
      expect(logged).toEqual([{ action: "created", actorId: ada }]);
    }));

  it("says name-taken for a name in use, ignoring case", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx);
      const store = async () => {};
      await createTextFile(newFile(ada, "notes.md"), store, tx);
      const again = await createTextFile(newFile(ada, "NOTES.md"), store, tx);
      expect(again).toEqual({ ok: false, reason: "name-taken" });
    }));

  it("leaves no row when storage fails", () =>
    withRollback(async (tx) => {
      const ada = await addUser(tx);
      const failing = async () => {
        throw new Error("storage is down");
      };
      await expect(createTextFile(newFile(ada, "notes.md"), failing, tx)).rejects.toThrow(
        "storage is down",
      );
      expect(await filesNamed(tx, ada, "notes.md")).toEqual([]);
    }));
});
