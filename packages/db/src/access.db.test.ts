import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getAccess, getAccessMany } from "./access.ts";
import { db, type Executor, pool } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";

// Each test builds its own rows inside a transaction and rolls it back, so
// nothing is left behind and tests never see each other's data.
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
  if (!user) throw new Error("no user");
  return user.id;
};

const addItem = async (
  tx: Executor,
  values: { ownerId: string; parentId?: string; type?: "folder" | "file"; name: string },
) => {
  const [item] = await tx
    .insert(items)
    .values({ type: "folder", ...values })
    .returning({ id: items.id });
  if (!item) throw new Error("no item");
  return item.id;
};

const grant = (tx: Executor, itemId: string, userId: string, role: "editor" | "viewer") =>
  tx.insert(itemPermissions).values({ itemId, userId, role });

// Ada owns Projects / Web / notes.txt; Bob and Cy are other users.
const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada");
  const bob = await addUser(tx, "bob");
  const cy = await addUser(tx, "cy");
  const projects = await addItem(tx, { ownerId: ada, name: "Projects" });
  const web = await addItem(tx, { ownerId: ada, parentId: projects, name: "Web" });
  const notes = await addItem(tx, { ownerId: ada, parentId: web, type: "file", name: "notes.txt" });
  return { ada, bob, cy, projects, web, notes };
};

const roleOf = async (tx: Executor, userId: string, itemId: string) =>
  (await getAccess(userId, itemId, tx))?.role;

afterAll(async () => {
  await pool.end();
});

describe("item_access", () => {
  it("returns nothing for an item that doesn't exist", async () => {
    await withRollback(async (tx) => {
      const { ada } = await setUp(tx);
      expect(await getAccess(ada, randomUUID(), tx)).toBeNull();
    });
  });

  it("makes the tree's owner Owner everywhere in it, with settings on", async () => {
    await withRollback(async (tx) => {
      const { ada, projects, notes } = await setUp(tx);
      expect(await getAccess(ada, projects, tx)).toEqual({
        role: "owner",
        editorsCanShare: true,
        trashed: false,
      });
      expect(await roleOf(tx, ada, notes)).toBe("owner");
    });
  });

  it("gives someone without a grant no role, but says the item exists", async () => {
    await withRollback(async (tx) => {
      const { bob, notes } = await setUp(tx);
      expect(await getAccess(bob, notes, tx)).toMatchObject({ role: null });
    });
  });

  it("passes a folder's grant down to everything inside it", async () => {
    await withRollback(async (tx) => {
      const { bob, projects, web, notes } = await setUp(tx);
      await grant(tx, projects, bob, "viewer");
      expect(await roleOf(tx, bob, projects)).toBe("viewer");
      expect(await roleOf(tx, bob, web)).toBe("viewer");
      expect(await roleOf(tx, bob, notes)).toBe("viewer");
    });
  });

  it("never passes a grant up to the folders above", async () => {
    await withRollback(async (tx) => {
      const { bob, web, notes } = await setUp(tx);
      await grant(tx, notes, bob, "editor");
      expect(await roleOf(tx, bob, notes)).toBe("editor");
      expect(await roleOf(tx, bob, web)).toBeNull();
    });
  });

  it("uses the highest role on the chain", async () => {
    await withRollback(async (tx) => {
      const { bob, cy, projects, web, notes } = await setUp(tx);
      // Viewer above, Editor below: Editor from there down.
      await grant(tx, projects, bob, "viewer");
      await grant(tx, web, bob, "editor");
      expect(await roleOf(tx, bob, projects)).toBe("viewer");
      expect(await roleOf(tx, bob, notes)).toBe("editor");
      // Editor above, Viewer below: the Viewer grant changes nothing.
      await grant(tx, projects, cy, "editor");
      await grant(tx, notes, cy, "viewer");
      expect(await roleOf(tx, cy, notes)).toBe("editor");
    });
  });

  it("ignores other people's grants", async () => {
    await withRollback(async (tx) => {
      const { bob, cy, projects, notes } = await setUp(tx);
      await grant(tx, projects, bob, "editor");
      expect(await roleOf(tx, cy, notes)).toBeNull();
    });
  });

  it("turns sharing off for everything below a folder that turns it off", async () => {
    await withRollback(async (tx) => {
      const { bob, projects, web, notes } = await setUp(tx);
      await grant(tx, projects, bob, "editor");
      await tx.update(items).set({ editorsCanShare: false }).where(eq(items.id, web));
      expect(await getAccess(bob, projects, tx)).toMatchObject({ editorsCanShare: true });
      expect(await getAccess(bob, web, tx)).toMatchObject({ editorsCanShare: false });
      expect(await getAccess(bob, notes, tx)).toMatchObject({ editorsCanShare: false });
    });
  });

  it("says when the item is in the trash", async () => {
    await withRollback(async (tx) => {
      const { ada, notes } = await setUp(tx);
      await tx.update(items).set({ trashedAt: new Date() }).where(eq(items.id, notes));
      expect(await getAccess(ada, notes, tx)).toMatchObject({ role: "owner", trashed: true });
    });
  });
});

describe("getAccessMany", () => {
  it("resolves many items in one query, leaving out missing ones", async () => {
    await withRollback(async (tx) => {
      const { bob, projects, web, notes } = await setUp(tx);
      await grant(tx, web, bob, "editor");
      const missing = randomUUID();
      const access = await getAccessMany(bob, [projects, web, notes, missing], tx);
      expect(access.get(projects)?.role).toBeNull();
      expect(access.get(web)?.role).toBe("editor");
      expect(access.get(notes)?.role).toBe("editor");
      expect(access.has(missing)).toBe(false);
      expect(await getAccessMany(bob, [], tx)).toEqual(new Map());
    });
  });
});
