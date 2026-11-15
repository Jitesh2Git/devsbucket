// The live Yjs document of each file being edited (Phase 4, decision 0013),
// read and written by realtime (Hocuspocus).
import { eq, sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { collabStates } from "./schema/collab.ts";
import { items } from "./schema/items.ts";

// The document as one Yjs update, or null if the file was never opened.
export const getCollabState = async (itemId: string, tx: Executor = db) => {
  const [row] = await tx
    .select({ state: collabStates.state })
    .from(collabStates)
    .where(eq(collabStates.itemId, itemId));
  return row?.state ?? null;
};

// Saves the document. Skipped when the file was deleted forever meanwhile
// (its row is gone, and the last save comes as everyone is disconnected).
export const saveCollabState = async (itemId: string, state: Uint8Array, tx: Executor = db) => {
  await tx.execute(sql`
    insert into ${collabStates} (item_id, state)
    select ${itemId}, ${Buffer.from(state)}
    where exists (select 1 from ${items} where ${items.id} = ${itemId})
    on conflict (item_id) do update set state = excluded.state, updated_at = now()
  `);
};
