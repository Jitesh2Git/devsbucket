// Writing activity (decision 0010), and reading one item's log for the
// activity panel (Phase 5, decision 0017).
import type { ActivityMetadata, LoggedAction } from "@devsbucket/shared/activity";
import {
  type ActivityCursor,
  type ActivityLine,
  activityNameIds,
} from "@devsbucket/shared/activity-text";
import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { sendEvent } from "./events.ts";
import { type NotifyActivity, QUEUES, sendInTransaction } from "./jobs.ts";
import { activities } from "./schema/activities.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";

export type ActivityEntry<A extends LoggedAction = LoggedAction> = {
  itemId: string;
  // null: the worker (deleting old trash).
  actorId: string | null;
  action: A;
  metadata: ActivityMetadata[A];
};

// Writes the row, queues `notify-activity` and sends the live event, all in
// `tx`: call it inside the action's own transaction, so the change, its
// activity, its job and its event commit (or roll back) together.
export const logActivity = async <A extends LoggedAction>(
  tx: Executor,
  entry: ActivityEntry<A>,
) => {
  const [row] = await tx.insert(activities).values(entry).returning({ id: activities.id });
  if (!row) {
    throw new Error("Insert returned no row");
  }
  const job: NotifyActivity = { activityId: row.id };
  await sendInTransaction(tx, QUEUES.notifyActivity, job);
  await sendEvent(tx, {
    kind: "activity",
    itemId: entry.itemId,
    action: entry.action,
    actorId: entry.actorId,
    metadata: entry.metadata,
  });
  return row.id;
};

// For actions that change nothing else (a download): its own transaction.
export const recordActivity = <A extends LoggedAction>(entry: ActivityEntry<A>) =>
  db.transaction((tx) => logActivity(tx, entry));

// Rows per page of the activity panel.
export const ACTIVITY_PAGE = 50;

export type ActivityRow = ActivityLine & {
  id: string;
  // null: the worker did it, or the account was removed since.
  actorName: string | null;
  createdAt: Date;
};

// One item's activity, newest first, ACTIVITY_PAGE rows at a time: the
// rows, the names of the people and folders their metadata points to, and
// the cursor of the next page (null on the last one). Only the item's own
// rows: a folder's log doesn't include what happened inside it.
export const listActivity = async (
  itemId: string,
  cursor: ActivityCursor | null,
  tx: Executor = db,
) => {
  const result = await tx.execute<{
    id: string;
    action: LoggedAction;
    metadata: Record<string, unknown>;
    actor_id: string | null;
    actor_name: string | null;
    created_at: Date;
    at: string;
  }>(sql`
    select a.id, a.action, a.metadata, a.actor_id, u.name as actor_name, a.created_at,
      a.created_at::text as at
    from ${activities} a
    left join ${users} u on u.id = a.actor_id
    where a.item_id = ${itemId}
      ${cursor ? sql`and (a.created_at, a.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``}
    order by a.created_at desc, a.id desc
    limit ${ACTIVITY_PAGE + 1}
  `);
  const page = result.rows.slice(0, ACTIVITY_PAGE);
  const rows = page.map(
    (row) =>
      ({
        id: row.id,
        action: row.action,
        actorId: row.actor_id,
        metadata: row.metadata,
        actorName: row.actor_name,
        createdAt: new Date(row.created_at),
      }) as ActivityRow,
  );

  const people = new Set<string>();
  const folders = new Set<string>();
  for (const row of rows) {
    const ids = activityNameIds(row);
    for (const id of ids.people) people.add(id);
    for (const id of ids.folders) folders.add(id);
  }
  const named =
    people.size + folders.size === 0
      ? { rows: [] }
      : await tx.execute<{ id: string; name: string }>(sql`
          select id, name from ${users} where id = any(${sql.param([...people])}::uuid[])
          union all
          select id, name from ${items} where id = any(${sql.param([...folders])}::uuid[])
        `);

  const last = page.at(-1);
  return {
    rows,
    names: Object.fromEntries(named.rows.map((row) => [row.id, row.name])),
    next:
      result.rows.length > ACTIVITY_PAGE && last
        ? ({ at: last.at, id: last.id } satisfies ActivityCursor)
        : null,
  };
};

export type ActivityPage = Awaited<ReturnType<typeof listActivity>>;
