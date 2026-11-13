import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { getBreadcrumbs } from "./items.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";
import { listSharedWithMe } from "./shared-with-me.ts";
import { listTrash } from "./trash.ts";

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

const addItem = async (
  tx: Executor,
  values: { ownerId: string; parentId?: string; type?: "folder" | "file"; name: string },
) => {
  const [item] = await tx
    .insert(items)
    .values({ type: "folder", ...values })
    .returning({ id: items.id });
  return item?.id ?? "";
};

const grant = (tx: Executor, itemId: string, userId: string, role: "editor" | "viewer") =>
  tx.insert(itemPermissions).values({ itemId, userId, role });

// Ada owns Projects / Team / Web and Projects / Team / plan.txt, and
// Projects / notes.txt. Bob is the one things are shared with.
const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada");
  const bob = await addUser(tx, "bob");
  const projects = await addItem(tx, { ownerId: ada, name: "Projects" });
  const team = await addItem(tx, { ownerId: ada, parentId: projects, name: "Team" });
  const web = await addItem(tx, { ownerId: ada, parentId: team, name: "Web" });
  const plan = await addItem(tx, { ownerId: ada, parentId: team, type: "file", name: "plan.txt" });
  const notes = await addItem(tx, {
    ownerId: ada,
    parentId: projects,
    type: "file",
    name: "notes.txt",
  });
  return { ada, bob, projects, team, web, plan, notes };
};

afterAll(async () => {
  await pool.end();
});

describe("listSharedWithMe", () => {
  it("lists only the top-most shared items, not what's inside them", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team, plan, notes } = await setUp(tx);
      await grant(tx, team, bob, "viewer");
      // Inside Team, which is shared already: reached by browsing Team.
      await grant(tx, plan, bob, "editor");
      // Outside it: listed on its own.
      await grant(tx, notes, bob, "viewer");
      const shared = await listSharedWithMe(bob, tx);
      expect(shared.map((item) => [item.name, item.role, item.ownerName]).sort()).toEqual([
        ["Team", "viewer", "ada"],
        ["notes.txt", "viewer", "ada"],
      ]);
      // Ada shared them; nothing is shared with her.
      expect(await listSharedWithMe(ada, tx)).toEqual([]);
    });
  });

  it("lists what's inside once the folder above stops being shared", async () => {
    await withRollback(async (tx) => {
      const { bob, team, plan } = await setUp(tx);
      await grant(tx, team, bob, "viewer");
      await grant(tx, plan, bob, "editor");
      await tx.delete(itemPermissions).where(eq(itemPermissions.itemId, team));
      expect((await listSharedWithMe(bob, tx)).map((item) => item.name)).toEqual(["plan.txt"]);
    });
  });

  it("leaves out trashed items", async () => {
    await withRollback(async (tx) => {
      const { bob, team } = await setUp(tx);
      await grant(tx, team, bob, "viewer");
      await tx.update(items).set({ trashedAt: new Date() }).where(eq(items.id, team));
      expect(await listSharedWithMe(bob, tx)).toEqual([]);
    });
  });
});

describe("getBreadcrumbs", () => {
  it("starts at My Drive for the owner", async () => {
    await withRollback(async (tx) => {
      const { ada, web } = await setUp(tx);
      expect(await getBreadcrumbs(web, ada, tx)).toMatchObject({
        root: "my-drive",
        folders: [{ name: "Projects" }, { name: "Team" }, { name: "Web" }],
      });
    });
  });

  it("starts at the top-most shared folder for someone it's shared with", async () => {
    await withRollback(async (tx) => {
      const { bob, team, web } = await setUp(tx);
      await grant(tx, team, bob, "viewer");
      await grant(tx, web, bob, "editor");
      expect(await getBreadcrumbs(web, bob, tx)).toMatchObject({
        root: "shared",
        folders: [{ name: "Team" }, { name: "Web" }],
      });
    });
  });
});

describe("listTrash", () => {
  it("shows an Editor what they trashed in someone else's tree, while they're an Editor", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team, plan } = await setUp(tx);
      await grant(tx, team, bob, "editor");
      await tx
        .update(items)
        .set({ trashedAt: new Date(), trashedBy: bob, trashRoot: true })
        .where(eq(items.id, plan));
      // The owner sees it too, with who trashed it.
      expect(await listTrash(ada, tx)).toMatchObject([{ name: "plan.txt", trashedByName: "bob" }]);
      expect((await listTrash(bob, tx)).map((item) => item.name)).toEqual(["plan.txt"]);
      // A Viewer now: no longer theirs to restore.
      await tx
        .update(itemPermissions)
        .set({ role: "viewer" })
        .where(eq(itemPermissions.itemId, team));
      expect(await listTrash(bob, tx)).toEqual([]);
    });
  });
});
