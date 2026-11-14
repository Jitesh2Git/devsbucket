// System notifications (decision 0010): storage and R2 thresholds, trash
// about to be emptied, an invite used. Each is created once (alert_states
// remembers what was raised) and respects the recipient's switches.
import { alertChanges, opsAlerts, storageAlerts } from "@devsbucket/shared/alerts";
import { TRASH_DAYS } from "@devsbucket/shared/limits";
import type { NotificationType } from "@devsbucket/shared/notifications";
import { eq, inArray, like, or, sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { sendEvent } from "./events.ts";
import { wantsNotification } from "./notification-settings.ts";
import { alertStates } from "./schema/alert-states.ts";
import { users } from "./schema/auth.ts";
import { invites } from "./schema/invites.ts";
import { items } from "./schema/items.ts";
import { notifications } from "./schema/notifications.ts";
import { currentMonth, getOpsThisMonth } from "./usage.ts";

// One system notification (no item), if the recipient wants it, with the
// live ping for their unread count.
const notifySystem = async (
  tx: Executor,
  {
    recipientId,
    type,
    actorId = null,
    count = 1,
  }: { recipientId: string; type: NotificationType; actorId?: string | null; count?: number },
) => {
  if (!(await wantsNotification({ recipientId, type, itemId: null }, tx))) {
    return false;
  }
  await tx.insert(notifications).values({ recipientId, type, actorId, count, itemId: null });
  await sendEvent(tx, { kind: "notification", userId: recipientId });
  return true;
};

const key = (type: NotificationType, scope: string) => `${type}:${scope}`;

// Applies alertChanges for one scope (a user, a month): stores the new
// keys, deletes the cleared ones. Returns the type to tell about, if any.
const applyAlerts = async (
  tx: Executor,
  scope: string,
  crossed: NotificationType[],
  raised: NotificationType[],
) => {
  const { raise, notify, clear } = alertChanges(crossed, raised);
  if (raise.length > 0) {
    await tx
      .insert(alertStates)
      .values(raise.map((type) => ({ key: key(type, scope) })))
      .onConflictDoNothing();
  }
  if (clear.length > 0) {
    await tx.delete(alertStates).where(
      inArray(
        alertStates.key,
        clear.map((type) => key(type, scope)),
      ),
    );
  }
  return notify;
};

// The worker's check-alerts job, part 1: each user's storage against 80%,
// 95% and full. Only users near their quota, or with an alert to clear,
// are looked at. Returns how many notifications were sent.
export const checkStorageAlerts = async (tx: Executor = db) => {
  return tx.transaction(async (t) => {
    const raisedRows = await t
      .select({ key: alertStates.key })
      .from(alertStates)
      .where(like(alertStates.key, "storage_%"));
    const raised = new Map<string, NotificationType[]>();
    for (const { key: k } of raisedRows) {
      const [type, userId] = k.split(":") as [NotificationType, string];
      raised.set(userId, [...(raised.get(userId) ?? []), type]);
    }
    const candidates = await t
      .select({ id: users.id, used: users.storageUsed, quota: users.storageQuota })
      .from(users)
      .where(
        or(
          sql`${users.storageUsed} * 5 >= ${users.storageQuota} * 4`,
          raised.size > 0 ? inArray(users.id, [...raised.keys()]) : undefined,
        ),
      );
    let sent = 0;
    for (const user of candidates) {
      const notify = await applyAlerts(
        t,
        user.id,
        storageAlerts(user.used, user.quota),
        raised.get(user.id) ?? [],
      );
      if (notify && (await notifySystem(t, { recipientId: user.id, type: notify }))) {
        sent += 1;
      }
    }
    return sent;
  });
};

// Part 2: this month's storage operations against R2's free tier, told to
// every admin. The month is in the key, so a new month starts afresh.
export const checkOpsAlerts = async (tx: Executor = db) => {
  return tx.transaction(async (t) => {
    const month = currentMonth();
    const raisedRows = await t
      .select({ key: alertStates.key })
      .from(alertStates)
      .where(like(alertStates.key, `r2_ops_%:${month}`));
    const raised = raisedRows.map((row) => row.key.split(":")[0] as NotificationType);
    const notify = await applyAlerts(t, month, opsAlerts(await getOpsThisMonth(t)), raised);
    if (!notify) {
      return 0;
    }
    const admins = await t.select({ id: users.id }).from(users).where(eq(users.isAdmin, true));
    let sent = 0;
    for (const admin of admins) {
      if (await notifySystem(t, { recipientId: admin.id, type: notify })) sent += 1;
    }
    return sent;
  });
};

// The worker's daily trash-warning job: items trashed 27 days ago or more
// (deleted forever at 30), one notification per owner with the count, once
// per item. Keys of items no longer in the trash go.
export const warnTrashEmptying = async (tx: Executor = db) => {
  return tx.transaction(async (t) => {
    const warnAfterDays = TRASH_DAYS - 3;
    const { rows } = await t.execute<{ owner_id: string; ids: string[] }>(sql`
      select owner_id, array_agg(id) as ids from ${items}
      where trash_root
        and trashed_at < now() - make_interval(days => ${warnAfterDays})
        and ('trash_emptying:' || id) not in (select key from ${alertStates})
      group by owner_id
    `);
    for (const { owner_id: ownerId, ids } of rows) {
      await t
        .insert(alertStates)
        .values(ids.map((id) => ({ key: key("trash_emptying", id) })))
        .onConflictDoNothing();
      await notifySystem(t, { recipientId: ownerId, type: "trash_emptying", count: ids.length });
    }
    await t.execute(sql`
      delete from ${alertStates}
      where key like 'trash_emptying:%'
        and substring(key from 16) not in (select id::text from ${items} where trash_root)
    `);
    return rows.length;
  });
};

// The sign-up hook: someone used an invite. Its creator hears about it, or
// every admin for invites made by the seed script or the admin command.
export const notifyInviteUsed = async (
  { code, userId }: { code: string; userId: string },
  tx: Executor = db,
) => {
  return tx.transaction(async (t) => {
    const [invite] = await t
      .select({ createdBy: invites.createdBy })
      .from(invites)
      .where(eq(invites.code, code));
    if (!invite) {
      return 0;
    }
    const recipients = invite.createdBy
      ? [invite.createdBy]
      : (await t.select({ id: users.id }).from(users).where(eq(users.isAdmin, true))).map(
          (admin) => admin.id,
        );
    let sent = 0;
    for (const recipientId of recipients.filter((id) => id !== userId)) {
      if (await notifySystem(t, { recipientId, type: "invite_used", actorId: userId })) {
        sent += 1;
      }
    }
    return sent;
  });
};
