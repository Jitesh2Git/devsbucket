// Notification switches and mutes (decision 0010). The worker asks
// `wantsNotification` before creating each one.
import { alwaysOnTypes, type NotificationType } from "@devsbucket/shared/notifications";
import { and, eq, sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { items } from "./schema/items.ts";
import { itemMutes, notificationPrefs } from "./schema/notification-settings.ts";

// The items above `itemId` and the item itself that the user muted.
const mutedOnChain = (userId: string, itemId: string) => sql`
  with recursive chain as (
    select id, parent_id, 0 as depth from ${items} where id = ${itemId}
    union all
    select i.id, i.parent_id, c.depth + 1 from ${items} i join chain c on i.id = c.parent_id
    where c.depth < 100
  )
  select chain.id, chain.depth from chain
  join ${itemMutes} m on m.item_id = chain.id and m.user_id = ${userId}
`;

// Whether the recipient wants this notification: always-on types always;
// otherwise their switch for the type is on (no row = on), and neither the
// item nor a folder above it is muted by them.
export const wantsNotification = async (
  {
    recipientId,
    type,
    itemId,
  }: { recipientId: string; type: NotificationType; itemId: string | null },
  tx: Executor = db,
) => {
  if (alwaysOnTypes.includes(type)) {
    return true;
  }
  const [pref] = await tx
    .select({ enabled: notificationPrefs.enabled })
    .from(notificationPrefs)
    .where(and(eq(notificationPrefs.userId, recipientId), eq(notificationPrefs.type, type)));
  if (pref && !pref.enabled) {
    return false;
  }
  if (itemId === null) {
    return true;
  }
  const muted = await tx.execute(mutedOnChain(recipientId, itemId));
  return muted.rows.length === 0;
};

// The user's switches that differ from "on".
export const listNotificationPrefs = async (userId: string, tx: Executor = db) => {
  const rows = await tx
    .select({ type: notificationPrefs.type, enabled: notificationPrefs.enabled })
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId));
  return Object.fromEntries(rows.map((row) => [row.type, row.enabled])) as Partial<
    Record<NotificationType, boolean>
  >;
};

export const setNotificationPref = async (
  { userId, type, enabled }: { userId: string; type: NotificationType; enabled: boolean },
  tx: Executor = db,
) => {
  await tx
    .insert(notificationPrefs)
    .values({ userId, type, enabled })
    .onConflictDoUpdate({
      target: [notificationPrefs.userId, notificationPrefs.type],
      set: { enabled },
    });
};

// Whether the user muted the item itself, or a folder above it.
export const muteState = async (userId: string, itemId: string, tx: Executor = db) => {
  const { rows } = await tx.execute<{ depth: number }>(mutedOnChain(userId, itemId));
  return {
    muted: rows.some((row) => row.depth === 0),
    mutedAbove: rows.some((row) => row.depth > 0),
  };
};

export const setMute = async (
  { userId, itemId, muted }: { userId: string; itemId: string; muted: boolean },
  tx: Executor = db,
) => {
  if (muted) {
    await tx.insert(itemMutes).values({ userId, itemId }).onConflictDoNothing();
  } else {
    await tx
      .delete(itemMutes)
      .where(and(eq(itemMutes.userId, userId), eq(itemMutes.itemId, itemId)));
  }
};
