import { randomUUID } from "node:crypto";
import { TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";
import { searchItems } from "./search.ts";

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

// Ada's drive: notes.md, meeting-notes.txt, solo.md (shared with Bob on its
// own), a trashed old-notes.md, and Team/ (shared with Bob) holding
// team-notes.md and package.json. Carol has a notes-secret.md of her own.
const setUp = async (tx: Executor) => {
  const addUser = async (name: string) => {
    const [user] = await tx
      .insert(users)
      .values({ name, email: `${name}-${randomUUID()}@example.test` })
      .returning({ id: users.id });
    return user?.id ?? "";
  };
  const [ada, bob, carol] = [await addUser("ada"), await addUser("bob"), await addUser("carol")];
  const add = async (
    ownerId: string,
    name: string,
    parentId: string | null = null,
    extra: Partial<typeof items.$inferInsert> = {},
  ) => {
    const [item] = await tx
      .insert(items)
      .values({ ownerId, parentId, name, type: "file", size: 1, ...extra })
      .returning({ id: items.id });
    return item?.id ?? "";
  };
  await add(ada, "notes.md");
  await add(ada, "meeting-notes.txt");
  const solo = await add(ada, "solo.md");
  await add(ada, "old-notes.md", null, { trashedAt: new Date(), trashRoot: true });
  const team = await add(ada, "Team", null, { type: "folder", size: null });
  await add(ada, "team-notes.md", team);
  await add(ada, "package.json", team);
  await add(carol, "notes-secret.md");
  await tx.insert(itemPermissions).values([
    { itemId: team, userId: bob, role: "viewer" },
    { itemId: solo, userId: bob, role: "viewer" },
  ]);
  return { ada, bob };
};

const names = async (userId: string, query: string, tx: Executor) =>
  (await searchItems(userId, query, tx)).map((result) => result.name);

describe("searchItems", () => {
  afterAll(() => pool.end());

  it("finds the user's own items, names starting with the query first, never trashed ones or someone else's", () =>
    withRollback(async (tx) => {
      const { ada } = await setUp(tx);
      expect(await names(ada, "NOTES", tx)).toEqual([
        "notes.md",
        "meeting-notes.txt",
        "team-notes.md",
      ]);
      const [first] = await searchItems(ada, "notes", tx);
      expect(first).toMatchObject({ location: "My Drive", ownerName: null });
    }));

  it("finds what's shared with the user, inside shared folders too, and says where it is", () =>
    withRollback(async (tx) => {
      const { bob } = await setUp(tx);
      expect(await names(bob, "notes", tx)).toEqual(["team-notes.md"]);
      expect((await searchItems(bob, "team-notes", tx))[0]).toMatchObject({
        location: "Team",
        ownerName: "ada",
      });
      expect((await searchItems(bob, "solo", tx))[0]).toMatchObject({
        location: "Shared with me",
      });
      expect(await names(bob, "secret", tx)).toEqual([]);
    }));

  it("still matches with a letter missing, and a typed % isn't a wildcard", () =>
    withRollback(async (tx) => {
      const { bob, ada } = await setUp(tx);
      expect(await names(bob, "pakage", tx)).toEqual(["package.json"]);
      expect(await names(ada, "%%", tx)).toEqual([]);
    }));
});
