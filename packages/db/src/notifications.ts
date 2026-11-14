// Notifications (decision 0010): created by the worker from activity, read
// and marked as read by the recipient. Each new one also tells realtime, so
// the recipient's unread count changes without a reload.
import {
  batchedTypes,
  type NotificationType,
  planNotifications,
} from "@devsbucket/shared/notifications";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Executor } from "./client.ts";
import { sendEvent } from "./events.ts";
import { activities } from "./schema/activities.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { notifications } from "./schema/notifications.ts";

// The Owner, and the Editors with a grant on the item or a folder above it
// while Editors may share there: they answer access requests.
const sharersOf = async (itemId: string, tx: Executor) => {
  const result = await tx.execute<{ user_id: string }>(sql`
    with recursive chain as (
      select id, parent_id, owner_id, editors_can_share, 0 as depth
      from ${items} where id = ${itemId}
      union all
      select i.id, i.parent_id, i.owner_id, i.editors_can_share, c.depth + 1
      from ${items} i join chain c on i.id = c.parent_id
      where c.depth < 100
    )
    select owner_id as user_id from chain where depth = 0
    union
    select p.user_id from item_permissions p join chain c on c.id = p.item_id
    where p.role = 'editor' and (select bool_and(editors_can_share) from chain)
  `);
  return result.rows.map((row) => row.user_id);
};

// The notifications one activity row makes (the worker's `notify-activity`
// job). Content types are batched: an unread one of the same type, for the
// same folder and actor, from the last hour counts one more instead of
// adding a row. Returns how many people were notified.
export const notifyForActivity = async (activityId: string, tx: Executor = db) => {
  return tx.transaction(async (t) => {
    const [activity] = await t.select().from(activities).where(eq(activities.id, activityId));
    if (!activity) {
      // Gone with its item (deleted forever) before the worker got to it.
      return 0;
    }
    const [item] = await t
      .select({ id: items.id, name: items.name, ownerId: items.ownerId, parentId: items.parentId })
      .from(items)
      .where(eq(items.id, activity.itemId));
    if (!item) {
      return 0;
    }
    const sharers = activity.action === "access_requested" ? await sharersOf(item.id, t) : [];
    const planned = planNotifications(activity, item, sharers);
    for (const notification of planned) {
      const batched =
        batchedTypes.includes(notification.type) && activity.actorId !== null
          ? await t
              .update(notifications)
              .set({
                count: sql`${notifications.count} + 1`,
                payload: notification.payload,
                createdAt: sql`now()`,
              })
              .where(
                and(
                  eq(notifications.recipientId, notification.recipientId),
                  eq(notifications.type, notification.type),
                  eq(notifications.itemId, notification.itemId),
                  eq(notifications.actorId, activity.actorId),
                  isNull(notifications.readAt),
                  sql`${notifications.createdAt} > now() - interval '1 hour'`,
                ),
              )
              .returning({ id: notifications.id })
          : [];
      if (batched.length === 0) {
        await t.insert(notifications).values({ ...notification, actorId: activity.actorId });
      }
      await sendEvent(t, { kind: "notification", userId: notification.recipientId });
    }
    return planned.length;
  });
};

const actors = alias(users, "actors");

// The user's notifications, newest first, with the actor's and item's
// names. Capped: older ones go after 90 days anyway.
export const listNotifications = async (userId: string, limit = 100, tx: Executor = db) => {
  const rows = await tx
    .select({
      id: notifications.id,
      type: notifications.type,
      count: notifications.count,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      itemId: items.id,
      itemName: items.name,
      itemType: items.type,
      actorName: actors.name,
    })
    .from(notifications)
    .leftJoin(items, eq(items.id, notifications.itemId))
    .leftJoin(actors, eq(actors.id, notifications.actorId))
    .where(eq(notifications.recipientId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
  return rows.map((row) => ({ ...row, type: row.type as NotificationType }));
};

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

export const unreadCount = async (userId: string, tx: Executor = db) => {
  const [row] = await tx
    .select({ unread: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
  return row?.unread ?? 0;
};

// Marks one of the user's notifications, or all of them, as read.
export const markRead = async (userId: string, id: string | "all", tx: Executor = db) => {
  await tx
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(notifications.recipientId, userId),
        isNull(notifications.readAt),
        id === "all" ? undefined : eq(notifications.id, id),
      ),
    );
};

// The daily cleanup: notifications older than `days` (LOCKED.md: 90).
export const deleteOldNotifications = async (days: number, tx: Executor = db) => {
  const deleted = await tx
    .delete(notifications)
    .where(sql`${notifications.createdAt} < now() - make_interval(days => ${days})`)
    .returning({ id: notifications.id });
  return deleted.length;
};
