// Roles come from one SQL function, item_access() (migration
// 0004_item_access.sql), so web, worker and realtime resolve them the same way.
import type { Access, Role } from "@devsbucket/shared/access";
import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";

type Row = {
  role: Role | null;
  editors_can_share: boolean;
  trashed: boolean;
};

const toAccess = (row: Row): Access => ({
  role: row.role,
  editorsCanShare: row.editors_can_share,
  trashed: row.trashed,
});

// One user's access to one item, or null if the item doesn't exist.
export const getAccess = async (
  userId: string,
  itemId: string,
  tx: Executor = db,
): Promise<Access | null> => {
  const result = await tx.execute<Row>(sql`select * from item_access(${userId}, ${itemId})`);
  const [row] = result.rows;
  return row ? toAccess(row) : null;
};

// The same for many items at once (a folder listing), in one query. Items
// that don't exist are missing from the map.
export const getAccessMany = async (
  userId: string,
  itemIds: string[],
  tx: Executor = db,
): Promise<Map<string, Access>> => {
  if (itemIds.length === 0) {
    return new Map();
  }
  const result = await tx.execute<Row & { item_id: string }>(sql`
    select ids.item_id, a.*
    from unnest(${sql.param(itemIds)}::uuid[]) as ids(item_id)
    cross join lateral item_access(${userId}, ids.item_id) a
  `);
  return new Map(result.rows.map((row) => [row.item_id, toAccess(row)]));
};
