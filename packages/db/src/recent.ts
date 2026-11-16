// Recent (Phase 5, decision 0017): the files a person opened, newest first.
// Opening a file (the editor page or a preview) records a view; the Recent
// page lists the newest ones the person can still open.
import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { users } from "./schema/auth.ts";
import { itemViews } from "./schema/item-views.ts";
import { items } from "./schema/items.ts";

// Rows kept per person, and how many the Recent page shows. Kept is larger
// so files that were trashed or unshared don't empty the list.
export const RECENT_KEPT = 100;
export const RECENT_LIMIT = 50;

// Opening a file again moves it to the top. Rows beyond the newest
// RECENT_KEPT are deleted in the same go, like the cap on versions. The
// caller has checked the person may view the file. clock_timestamp(), not
// now(): now() is the start of the transaction, so several views in one
// transaction (the database tests) would all get the same time.
export const recordView = async (userId: string, itemId: string, tx: Executor = db) => {
  const at = sql`clock_timestamp()`;
  await tx
    .insert(itemViews)
    .values({ userId, itemId, lastOpenedAt: at })
    .onConflictDoUpdate({
      target: [itemViews.userId, itemViews.itemId],
      set: { lastOpenedAt: at },
    });
  await tx.execute(sql`
    delete from ${itemViews}
    where user_id = ${userId}
      and item_id in (
        select item_id from ${itemViews}
        where user_id = ${userId}
        order by last_opened_at desc
        offset ${RECENT_KEPT}
      )
  `);
};

// The newest files the person opened that they can still open: not
// trashed, and item_access() still gives them a role (a file unshared
// since then drops out, and comes back if it's shared again).
export const listRecent = async (userId: string, tx: Executor = db) => {
  const result = await tx.execute<{
    id: string;
    type: "folder" | "file";
    name: string;
    mime_type: string | null;
    size: string | null;
    owner_id: string;
    owner_name: string;
    opened_at: Date;
  }>(sql`
    select i.id, i.type, i.name, i.mime_type, i.size, i.owner_id,
      u.name as owner_name, v.last_opened_at as opened_at
    from ${itemViews} v
    join ${items} i on i.id = v.item_id
    join ${users} u on u.id = i.owner_id
    cross join lateral item_access(${userId}, i.id) a
    where v.user_id = ${userId}
      and i.trashed_at is null
      and i.status = 'ready'
      and a.role is not null
    order by v.last_opened_at desc
    limit ${RECENT_LIMIT}
  `);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size === null ? null : Number(row.size),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    openedAt: new Date(row.opened_at),
  }));
};

export type RecentItem = Awaited<ReturnType<typeof listRecent>>[number];
