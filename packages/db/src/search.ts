// Cmd+K search (Phase 5, decision 0017): files and folders the user can
// open, by name. pg_trgm does the matching: a name that contains the query
// (`like '%…%'`), or one close to it (`<%`, word similarity: a missing or
// extra letter still matches). Both use the trigram index on lower(name);
// item_access() then keeps only what the user has a role on.
import { containsPattern, SEARCH_LIMIT } from "@devsbucket/shared/search";
import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";

// How close a name must be for `<%` (0 to 1; pg_trgm's default is 0.6,
// which misses most typos; lower matches unrelated names).
const SIMILARITY = 0.45;

export const searchItems = async (userId: string, query: string, executor: Executor = db) => {
  const q = query.toLowerCase();
  // set_config(…, true) lasts until the end of the transaction.
  const result = await executor.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('pg_trgm.word_similarity_threshold', ${String(SIMILARITY)}, true)`,
    );
    return tx.execute<{
      id: string;
      type: "folder" | "file";
      name: string;
      mime_type: string | null;
      size: string | null;
      owner_id: string;
      owner_name: string;
      parent_id: string | null;
      parent_name: string | null;
      parent_visible: boolean;
    }>(sql`
      select i.id, i.type, i.name, i.mime_type, i.size, i.owner_id, u.name as owner_name,
        i.parent_id, p.name as parent_name, pa.role is not null as parent_visible
      from ${items} i
      join ${users} u on u.id = i.owner_id
      left join ${items} p on p.id = i.parent_id
      cross join lateral item_access(${userId}, i.id) a
      left join lateral item_access(${userId}, i.parent_id) pa on i.parent_id is not null
      where (lower(i.name) like ${containsPattern(query)} or ${q} <% lower(i.name))
        and i.trashed_at is null
        and i.status = 'ready'
        and a.role is not null
      order by
        starts_with(lower(i.name), ${q}) desc,
        strpos(lower(i.name), ${q}) > 0 desc,
        word_similarity(${q}, lower(i.name)) desc,
        lower(i.name),
        i.id
      limit ${SEARCH_LIMIT}
    `);
  });
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size === null ? null : Number(row.size),
    // Where it is, as the user sees it: its folder if they can open that,
    // the top of their drive, or Shared with me (shared on its own).
    location:
      row.parent_id === null
        ? row.owner_id === userId
          ? "My Drive"
          : "Shared with me"
        : row.parent_visible
          ? (row.parent_name ?? "")
          : "Shared with me",
    ownerName: row.owner_id === userId ? null : row.owner_name,
  }));
};

export type SearchResult = Awaited<ReturnType<typeof searchItems>>[number];
