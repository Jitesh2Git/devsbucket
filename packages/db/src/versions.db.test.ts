import { randomUUID } from "node:crypto";
import { MAX_AUTO_VERSIONS } from "@devsbucket/shared/editing";
import { and, asc, eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { activities } from "./schema/activities.ts";
import { users } from "./schema/auth.ts";
import { itemVersions } from "./schema/collab.ts";
import { items } from "./schema/items.ts";
import { getVersion, listVersions, saveVersion } from "./versions.ts";

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

// Ada owns notes.md, 5 bytes ("hello"), counted in her used storage.
const setUp = async (tx: Executor) => {
  const [ada] = await tx
    .insert(users)
    .values({ name: "ada", email: `ada-${randomUUID()}@example.test`, storageUsed: 5 })
    .returning({ id: users.id });
  const adaId = ada?.id ?? "";
  const [file] = await tx
    .insert(items)
    .values({ ownerId: adaId, type: "file", name: "notes.md", size: 5 })
    .returning({ id: items.id });
  return { ada: adaId, file: file?.id ?? "" };
};

const auto = (itemId: string, text: string, authors: string[]) => ({
  itemId,
  text,
  firstText: async () => "hello",
  kind: "auto" as const,
  authors,
});

const versionsOf = (tx: Executor, itemId: string) =>
  tx
    .select({ number: itemVersions.number, kind: itemVersions.kind, content: itemVersions.content })
    .from(itemVersions)
    .where(eq(itemVersions.itemId, itemId))
    .orderBy(asc(itemVersions.number));

const actionsOn = async (tx: Executor, itemId: string) =>
  (
    await tx
      .select({ action: activities.action })
      .from(activities)
      .where(eq(activities.itemId, itemId))
  ).map((row) => row.action);

describe("saveVersion", () => {
  afterAll(() => pool.end());

  it("saves version 1 from the stored text first, then the new text", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      const result = await saveVersion(auto(file, "hello world", [ada]), tx);
      expect(result).toEqual({ saved: true, number: 2 });
      expect(await versionsOf(tx, file)).toEqual([
        { number: 1, kind: "auto", content: "hello" },
        { number: 2, kind: "auto", content: "hello world" },
      ]);
      expect(await actionsOn(tx, file)).toEqual(["edited"]);
    }));

  it("moves the file's size and the owner's used storage by the difference", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      await saveVersion(auto(file, "hello world", [ada]), tx);
      const [row] = await tx.select({ size: items.size }).from(items).where(eq(items.id, file));
      const [owner] = await tx
        .select({ used: users.storageUsed })
        .from(users)
        .where(eq(users.id, ada));
      expect(row?.size).toBe(11);
      expect(owner?.used).toBe(11);
    }));

  it("saves nothing when the text didn't change, but still logs the edit", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      await saveVersion(auto(file, "hello world", [ada]), tx);
      const again = await saveVersion(auto(file, "hello world", [ada]), tx);
      expect(again).toEqual({ saved: false, number: 2 });
      expect(await versionsOf(tx, file)).toHaveLength(2);
      expect(await actionsOn(tx, file)).toEqual(["edited", "edited"]);
    }));

  it("names a version with its message, logged as version_saved", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      const result = await saveVersion(
        { ...auto(file, "draft", [ada]), kind: "named", message: "First draft", savedBy: ada },
        tx,
      );
      expect(result).toEqual({ saved: true, number: 2 });
      const [named] = await tx
        .select({ message: itemVersions.message, createdBy: itemVersions.createdBy })
        .from(itemVersions)
        .where(and(eq(itemVersions.itemId, file), eq(itemVersions.number, 2)));
      expect(named).toEqual({ message: "First draft", createdBy: ada });
      expect(await actionsOn(tx, file)).toEqual(["version_saved"]);
    }));

  it("keeps the newest automatic versions (MAX_AUTO_VERSIONS), version 1 and named ones", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      await saveVersion(
        { ...auto(file, "named", [ada]), kind: "named", message: "keep", savedBy: ada },
        tx,
      );
      for (let i = 0; i < MAX_AUTO_VERSIONS + 3; i++) {
        await saveVersion(auto(file, `text ${i}`, [ada]), tx);
      }
      const versions = await versionsOf(tx, file);
      const autos = versions.filter((v) => v.kind === "auto" && v.number > 1);
      expect(autos).toHaveLength(MAX_AUTO_VERSIONS);
      expect(autos[0]?.content).toBe("text 3");
      expect(versions[0]).toEqual({ number: 1, kind: "auto", content: "hello" });
      expect(versions.some((v) => v.kind === "named")).toBe(true);
      expect(versions.at(-1)?.number).toBe(MAX_AUTO_VERSIONS + 5);
    }));

  it("restores a version as a new one, logged as version_restored", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      await saveVersion(auto(file, "second", [ada]), tx);
      const [first] = await tx
        .select({ id: itemVersions.id })
        .from(itemVersions)
        .where(and(eq(itemVersions.itemId, file), eq(itemVersions.number, 1)));
      const result = await saveVersion(
        {
          ...auto(file, "hello", []),
          kind: "restore",
          savedBy: ada,
          restoredFrom: { id: first?.id ?? "", number: 1 },
        },
        tx,
      );
      expect(result).toEqual({ saved: true, number: 3 });
      expect(await actionsOn(tx, file)).toEqual(["edited", "version_restored"]);
      const [latest] = await listVersions(file, tx);
      expect(latest).toMatchObject({ number: 3, kind: "restore", restoredFromNumber: 1 });
    }));

  it("lists versions newest first, with names, and reads one only for its file", () =>
    withRollback(async (tx) => {
      const { ada, file } = await setUp(tx);
      const gone = randomUUID();
      await saveVersion(auto(file, "edited", [ada, gone]), tx);
      await saveVersion(
        { ...auto(file, "named", [ada]), kind: "named", message: "Done", savedBy: ada },
        tx,
      );
      const versions = await listVersions(file, tx);
      expect(versions.map((v) => v.number)).toEqual([3, 2, 1]);
      expect(versions[0]).toMatchObject({ kind: "named", message: "Done", savedBy: "ada" });
      expect(versions[1]?.authors).toEqual(["ada", "Deleted user"]);
      const id = versions[1]?.id ?? "";
      expect((await getVersion(file, id, tx))?.content).toBe("edited");
      expect(await getVersion(randomUUID(), id, tx)).toBeNull();
    }));

  it("does nothing for a file that no longer exists", () =>
    withRollback(async (tx) => {
      const result = await saveVersion(auto(randomUUID(), "x", []), tx);
      expect(result).toEqual({ saved: false, number: null });
    }));
});
