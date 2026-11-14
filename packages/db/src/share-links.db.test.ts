import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getAccess } from "./access.ts";
import { db, type Executor, pool } from "./client.ts";
import { getBreadcrumbs } from "./items.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";
import { shareLinks, shareLinkVisits } from "./schema/share-links.ts";
import { listSharedWithMe } from "./shared-with-me.ts";

// Links are made with SQL here; creating and opening them through the app
// is in e2e/share-links.spec.ts.
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

const addFolder = async (tx: Executor, ownerId: string, name: string, parentId?: string) => {
  const [item] = await tx
    .insert(items)
    .values({ ownerId, parentId, type: "folder", name })
    .returning({ id: items.id });
  return item?.id ?? "";
};

const addLink = async (tx: Executor, itemId: string, role: "editor" | "viewer") => {
  const [link] = await tx
    .insert(shareLinks)
    .values({ itemId, role, token: randomUUID() })
    .returning({ id: shareLinks.id });
  return link?.id ?? "";
};

const visit = (tx: Executor, linkId: string, userId: string) =>
  tx.insert(shareLinkVisits).values({ linkId, userId });

// Ada owns Team / Web; Bob opened a Viewer link on Team.
const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada");
  const bob = await addUser(tx, "bob");
  const team = await addFolder(tx, ada, "Team");
  const web = await addFolder(tx, ada, "Web", team);
  const link = await addLink(tx, team, "viewer");
  await visit(tx, link, bob);
  return { ada, bob, team, web, link };
};

const roleOf = async (tx: Executor, userId: string, itemId: string) =>
  (await getAccess(userId, itemId, tx))?.role;

afterAll(async () => {
  await pool.end();
});

describe("item_access with share links", () => {
  it("gives a visitor the link's role, on the item and inside it", async () => {
    await withRollback(async (tx) => {
      const { bob, team, web } = await setUp(tx);
      expect(await roleOf(tx, bob, team)).toBe("viewer");
      expect(await roleOf(tx, bob, web)).toBe("viewer");
    });
  });

  it("follows the link's role when it changes", async () => {
    await withRollback(async (tx) => {
      const { bob, web, link } = await setUp(tx);
      await tx.update(shareLinks).set({ role: "editor" }).where(eq(shareLinks.id, link));
      expect(await roleOf(tx, bob, web)).toBe("editor");
    });
  });

  it("stops when the link is disabled or expires", async () => {
    await withRollback(async (tx) => {
      const { bob, team, link } = await setUp(tx);
      await tx
        .update(shareLinks)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(shareLinks.id, link));
      expect(await roleOf(tx, bob, team)).toBeNull();
      await tx
        .update(shareLinks)
        .set({ expiresAt: null, disabledAt: new Date() })
        .where(eq(shareLinks.id, link));
      expect(await roleOf(tx, bob, team)).toBeNull();
    });
  });

  it("uses the higher of a grant and a link", async () => {
    await withRollback(async (tx) => {
      const { bob, team, web } = await setUp(tx);
      await tx.insert(itemPermissions).values({ itemId: web, userId: bob, role: "editor" });
      expect(await roleOf(tx, bob, team)).toBe("viewer");
      expect(await roleOf(tx, bob, web)).toBe("editor");
    });
  });
});

describe("Shared with me and breadcrumbs with share links", () => {
  it("lists the linked item once, top-most, with the higher role", async () => {
    await withRollback(async (tx) => {
      const { bob, team, web } = await setUp(tx);
      await tx.insert(itemPermissions).values([
        { itemId: team, userId: bob, role: "editor" },
        // Inside Team: not listed on its own.
        { itemId: web, userId: bob, role: "viewer" },
      ]);
      const shared = await listSharedWithMe(bob, tx);
      expect(shared.map((item) => [item.name, item.role])).toEqual([["Team", "editor"]]);
    });
  });

  it("drops the item when the link stops working", async () => {
    await withRollback(async (tx) => {
      const { bob, link } = await setUp(tx);
      expect(await listSharedWithMe(bob, tx)).toHaveLength(1);
      await tx.update(shareLinks).set({ disabledAt: new Date() }).where(eq(shareLinks.id, link));
      expect(await listSharedWithMe(bob, tx)).toEqual([]);
    });
  });

  it("starts the breadcrumbs at the linked folder", async () => {
    await withRollback(async (tx) => {
      const { bob, web } = await setUp(tx);
      expect(await getBreadcrumbs(web, bob, tx)).toMatchObject({
        root: "shared",
        folders: [{ name: "Team" }, { name: "Web" }],
      });
    });
  });
});
