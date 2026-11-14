// Shared with me (decision 0008): the top-most items shared with a user,
// by a grant or by a share link they opened. A folder and a file inside it
// both shared with you list only the folder; the file is reached by
// browsing it.
import type { GrantRole } from "@devsbucket/shared/sharing";
import { sql } from "drizzle-orm";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";
import { shareLinks, shareLinkVisits } from "./schema/share-links.ts";

export const SHARED_LIMIT = 200;

// Every item that gives `userId` a role of its own: their grants, and the
// items of active share links they opened (item_access() uses the same
// rule). Columns: item_id, role, at.
export const accessRoots = (userId: string) => sql`
  select p.item_id, p.role, p.created_at as at
  from ${itemPermissions} p
  where p.user_id = ${userId}
  union all
  select l.item_id, l.role, v.first_opened_at as at
  from ${shareLinkVisits} v
  join ${shareLinks} l on l.id = v.link_id
  where v.user_id = ${userId}
    and l.disabled_at is null
    and (l.expires_at is null or l.expires_at > now())
`;

// Newest share first. Capped like the Trash: a list that long isn't
// browsed by scrolling anyway. A grant and a link on the same item make
// one row, with the higher role.
export const listSharedWithMe = async (userId: string, tx: Executor = db) => {
  const result = await tx.execute<{
    id: string;
    type: "folder" | "file" | "note";
    name: string;
    mime_type: string | null;
    size: string | null;
    role: GrantRole;
    shared_at: Date;
    owner_name: string;
  }>(sql`
    with roots as (${accessRoots(userId)}),
    per_item as (
      select item_id,
        case when bool_or(role = 'editor') then 'editor' else 'viewer' end as role,
        min(at) as shared_at
      from roots group by item_id
    )
    select i.id, i.type, i.name, i.mime_type, i.size, r.role, r.shared_at,
      u.name as owner_name
    from per_item r
    join ${items} i on i.id = r.item_id
    join ${users} u on u.id = i.owner_id
    where i.owner_id <> ${userId}
      and i.trashed_at is null
      and i.status = 'ready'
      -- Top-most: nothing gives this user a role on a folder above it.
      and not exists (
        with recursive above as (
          select a.id, a.parent_id, 1 as depth from ${items} a where a.id = i.parent_id
          union all
          select a.id, a.parent_id, x.depth + 1
          from ${items} a join above x on a.id = x.parent_id
          where x.depth < 100
        )
        select 1 from above join roots q on q.item_id = above.id
      )
    order by r.shared_at desc, i.id
    limit ${SHARED_LIMIT}
  `);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size === null ? null : Number(row.size),
    role: row.role,
    sharedAt: new Date(row.shared_at),
    ownerName: row.owner_name,
  }));
};

export type SharedItem = Awaited<ReturnType<typeof listSharedWithMe>>[number];

// "Remove from Shared with me": the user's own grant on the item and their
// visits to its links go, in one transaction, logged as access_removed
// with the higher role they had. False if there was nothing to remove.
// Opening an active link again brings it back.
export const leaveSharedItem = async ({ itemId, userId }: { itemId: string; userId: string }) => {
  return db.transaction(async (tx) => {
    const grants = await tx.execute<{ role: GrantRole }>(sql`
      delete from ${itemPermissions}
      where item_id = ${itemId} and user_id = ${userId}
      returning role
    `);
    const visits = await tx.execute<{ role: GrantRole }>(sql`
      delete from ${shareLinkVisits} v
      using ${shareLinks} l
      where l.id = v.link_id and l.item_id = ${itemId} and v.user_id = ${userId}
      returning l.role
    `);
    const removed = [...grants.rows, ...visits.rows].map((row) => row.role);
    if (removed.length === 0) {
      return false;
    }
    await logActivity(tx, {
      itemId,
      actorId: userId,
      action: "access_removed",
      metadata: { userId, role: removed.includes("editor") ? "editor" : "viewer" },
    });
    return true;
  });
};
