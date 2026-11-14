// Live events (decision 0010): sent on one Postgres channel inside the
// action's transaction (Postgres delivers them only if it commits), and
// listened to by apps/realtime.
import { type ChannelEvent, EVENTS_CHANNEL } from "@devsbucket/shared/realtime";
import { eq, sql } from "drizzle-orm";
import { db, type Executor, pool } from "./client.ts";
import { items } from "./schema/items.ts";
import { shareLinks, shareLinkVisits } from "./schema/share-links.ts";

export const sendEvent = async (tx: Executor, event: ChannelEvent) => {
  await tx.execute(sql`select pg_notify(${EVENTS_CHANNEL}, ${JSON.stringify(event)})`);
};

// One connection, kept for as long as the process runs, that receives every
// event. `stop` gives it back (with the error, if it broke, so the pool
// throws it away instead of reusing it).
export const listenForEvents = async (onEvent: (event: ChannelEvent) => void) => {
  const client = await pool.connect();
  client.on("notification", (message) => {
    if (message.channel === EVENTS_CHANNEL && message.payload) {
      onEvent(JSON.parse(message.payload) as ChannelEvent);
    }
  });
  await client.query(`listen ${EVENTS_CHANNEL}`);
  return { client, stop: (error?: Error) => client.release(error) };
};

// Where an item is now: its folder (null = the top of the owner's drive).
export const itemPlace = async (itemId: string, tx: Executor = db) => {
  const [item] = await tx
    .select({ parentId: items.parentId, ownerId: items.ownerId })
    .from(items)
    .where(eq(items.id, itemId));
  return item ?? null;
};

// Everyone who opened one of the item's share links.
export const linkVisitors = async (itemId: string, tx: Executor = db) => {
  const rows = await tx
    .selectDistinct({ userId: shareLinkVisits.userId })
    .from(shareLinkVisits)
    .innerJoin(shareLinks, eq(shareLinks.id, shareLinkVisits.linkId))
    .where(eq(shareLinks.itemId, itemId));
  return rows.map((row) => row.userId);
};
