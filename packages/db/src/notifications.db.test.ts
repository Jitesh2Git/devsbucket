import { randomUUID } from "node:crypto";
import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { type ActivityEntry, logActivity } from "./activity.ts";
import { db, type Executor, pool } from "./client.ts";
import { stopSender } from "./jobs.ts";
import {
  deleteOldNotifications,
  listNotifications,
  markRead,
  notifyForActivity,
  unreadCount,
} from "./notifications.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { notifications } from "./schema/notifications.ts";
import { itemPermissions } from "./schema/permissions.ts";

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
  values: { ownerId: string; parentId?: string; name: string; type?: "folder" | "file" },
) => {
  const [item] = await tx
    .insert(items)
    .values({ type: "folder", ...values })
    .returning({ id: items.id });
  return item?.id ?? "";
};

// Logs the activity, then runs what the worker's job would.
const act = async (tx: Executor, entry: ActivityEntry) =>
  notifyForActivity(await logActivity(tx, entry), tx);

// Ada owns Team / a.txt. Bob is an Editor on Team, Cy a Viewer.
const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada");
  const bob = await addUser(tx, "bob");
  const cy = await addUser(tx, "cy");
  const dee = await addUser(tx, "dee");
  const team = await addItem(tx, { ownerId: ada, name: "Team" });
  const file = await addItem(tx, { ownerId: ada, parentId: team, name: "a.txt", type: "file" });
  await tx.insert(itemPermissions).values([
    { itemId: team, userId: bob, role: "editor" },
    { itemId: team, userId: cy, role: "viewer" },
  ]);
  return { ada, bob, cy, dee, team, file };
};

const typesFor = async (tx: Executor, userId: string) =>
  (await listNotifications(userId, 100, tx)).map((n) => [n.type, n.count]);

afterAll(async () => {
  await stopSender();
  await pool.end();
});

describe("notifyForActivity", () => {
  it("tells the person a share is about, not the one who shared", async () => {
    await withRollback(async (tx) => {
      const { ada, dee, team } = await setUp(tx);
      await act(tx, {
        itemId: team,
        actorId: ada,
        action: "shared",
        metadata: { userId: dee, role: "viewer" },
      });
      expect(await listNotifications(dee, 100, tx)).toMatchObject([
        { type: "shared", actorName: "ada", itemName: "Team", payload: { role: "viewer" } },
      ]);
      expect(await unreadCount(ada, tx)).toBe(0);
    });
  });

  it("batches an Editor's uploads for the Owner until she reads them", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, file } = await setUp(tx);
      const upload = {
        itemId: file,
        actorId: bob,
        action: "uploaded",
        metadata: { size: 1 },
      } as const;
      await act(tx, upload);
      await act(tx, upload);
      await act(tx, upload);
      expect(await typesFor(tx, ada)).toEqual([["files_added", 3]]);
      await markRead(ada, "all", tx);
      expect(await unreadCount(ada, tx)).toBe(0);
      await act(tx, upload);
      expect(await typesFor(tx, ada)).toEqual([
        ["files_added", 1],
        ["files_added", 3],
      ]);
      // Her own uploads tell nobody.
      await act(tx, { ...upload, actorId: ada });
      expect(await unreadCount(ada, tx)).toBe(1);
    });
  });

  it("sends a request to the Owner and the Editors who may share", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, cy, dee, team } = await setUp(tx);
      const request = {
        itemId: team,
        actorId: dee,
        action: "access_requested",
        metadata: { role: "viewer" },
      } as const;
      expect(await act(tx, request)).toBe(2);
      expect([
        await unreadCount(ada, tx),
        await unreadCount(bob, tx),
        await unreadCount(cy, tx),
      ]).toEqual([1, 1, 0]);
      // Editors can't share any more: only the Owner.
      await tx.update(items).set({ editorsCanShare: false }).where(eq(items.id, team));
      expect(await act(tx, request)).toBe(1);
    });
  });
});

describe("deleteOldNotifications", () => {
  it("deletes only what's older than the limit", async () => {
    await withRollback(async (tx) => {
      const { ada, team } = await setUp(tx);
      await tx.insert(notifications).values([
        {
          recipientId: ada,
          type: "trashed",
          itemId: team,
          createdAt: new Date(Date.now() - 91 * 86_400_000),
        },
        { recipientId: ada, type: "trashed", itemId: team },
      ]);
      expect(await deleteOldNotifications(90, tx)).toBe(1);
      expect(await unreadCount(ada, tx)).toBe(1);
    });
  });
});
