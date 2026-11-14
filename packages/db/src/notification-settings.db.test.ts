import { randomUUID } from "node:crypto";
import { TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { type ActivityEntry, logActivity } from "./activity.ts";
import { db, type Executor, pool } from "./client.ts";
import { stopSender } from "./jobs.ts";
import { muteState, setMute, setNotificationPref } from "./notification-settings.ts";
import { notifyForActivity, unreadCount } from "./notifications.ts";
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

const act = async (tx: Executor, entry: ActivityEntry) =>
  notifyForActivity(await logActivity(tx, entry), tx);

// Ada owns Team / Web / b.txt; Bob works in it.
const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada");
  const bob = await addUser(tx, "bob");
  const team = await addItem(tx, { ownerId: ada, name: "Team" });
  const web = await addItem(tx, { ownerId: ada, parentId: team, name: "Web" });
  const file = await addItem(tx, { ownerId: ada, parentId: web, name: "b.txt", type: "file" });
  const upload = { itemId: file, actorId: bob, action: "uploaded", metadata: { size: 1 } } as const;
  return { ada, bob, team, web, file, upload };
};

afterAll(async () => {
  await stopSender();
  await pool.end();
});

describe("notification switches", () => {
  it("creates nothing for a type that's switched off, until it's on again", async () => {
    await withRollback(async (tx) => {
      const { ada, upload } = await setUp(tx);
      await setNotificationPref({ userId: ada, type: "files_added", enabled: false }, tx);
      expect(await act(tx, upload)).toBe(0);
      await setNotificationPref({ userId: ada, type: "files_added", enabled: true }, tx);
      expect(await act(tx, upload)).toBe(1);
    });
  });

  it("ignores switches and mutes for always-on types", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team } = await setUp(tx);
      await setNotificationPref({ userId: bob, type: "access_removed", enabled: false }, tx);
      await setMute({ userId: bob, itemId: team, muted: true }, tx);
      await act(tx, {
        itemId: team,
        actorId: ada,
        action: "access_removed",
        metadata: { userId: bob, role: "editor" },
      });
      expect(await unreadCount(bob, tx)).toBe(1);
    });
  });
});

describe("mutes", () => {
  it("covers everything inside a muted folder, until it's unmuted", async () => {
    await withRollback(async (tx) => {
      const { ada, team, file, upload } = await setUp(tx);
      await setMute({ userId: ada, itemId: team, muted: true }, tx);
      expect(await muteState(ada, team, tx)).toEqual({ muted: true, mutedAbove: false });
      expect(await muteState(ada, file, tx)).toEqual({ muted: false, mutedAbove: true });
      expect(await act(tx, upload)).toBe(0);
      await setMute({ userId: ada, itemId: team, muted: false }, tx);
      expect(await act(tx, upload)).toBe(1);
    });
  });
});
