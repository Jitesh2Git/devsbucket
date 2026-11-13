import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, type Executor, pool } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";
import { listSharing } from "./sharing.ts";

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

afterAll(async () => {
  await pool.end();
});

describe("listSharing", () => {
  it("lists the owner, direct and inherited grants, the higher one winning", async () => {
    await withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const bob = await addUser(tx, "bob");
      const cy = await addUser(tx, "cy");
      const dee = await addUser(tx, "dee");
      const team = await addFolder(tx, ada, "Team");
      const web = await addFolder(tx, ada, "Web", team);
      await tx.insert(itemPermissions).values([
        // Bob: Editor from Team, Viewer here: Editor wins, from Team.
        { itemId: team, userId: bob, role: "editor" },
        { itemId: web, userId: bob, role: "viewer" },
        // Cy: only here.
        { itemId: web, userId: cy, role: "editor" },
        // Dee: only from above.
        { itemId: team, userId: dee, role: "viewer" },
      ]);
      const sharing = await listSharing(web, tx);
      expect(sharing?.owner.userId).toBe(ada);
      expect(
        sharing?.people.map((person) => [
          person.name,
          person.role,
          person.direct,
          person.inherited?.name ?? null,
        ]),
      ).toEqual([
        ["bob", "editor", "viewer", "Team"],
        ["cy", "editor", "editor", null],
        ["dee", "viewer", null, "Team"],
      ]);
    });
  });

  it("gives the item's own setting and the one in force from above", async () => {
    await withRollback(async (tx) => {
      const ada = await addUser(tx, "ada");
      const team = await addFolder(tx, ada, "Team");
      const web = await addFolder(tx, ada, "Web", team);
      await tx.update(items).set({ editorsCanShare: false }).where(eq(items.id, team));
      expect((await listSharing(web, tx))?.settings).toEqual({
        own: { editorsCanShare: true },
        effective: { editorsCanShare: false },
      });
    });
  });

  it("returns null for a missing item", async () => {
    expect(await listSharing(randomUUID())).toBeNull();
  });
});
