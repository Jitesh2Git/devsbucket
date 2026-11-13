// Writing activity (decision 0010). Read it in Phase 5.
import type { ActivityMetadata, LoggedAction } from "@devsbucket/shared/activity";
import { db, type Executor } from "./client.ts";
import { type NotifyActivity, QUEUES, sendInTransaction } from "./jobs.ts";
import { activities } from "./schema/activities.ts";

export type ActivityEntry<A extends LoggedAction = LoggedAction> = {
  itemId: string;
  // null: the worker (deleting old trash).
  actorId: string | null;
  action: A;
  metadata: ActivityMetadata[A];
};

// Writes the row and queues `notify-activity`, both in `tx`: call it inside
// the action's own transaction, so the change, its activity and its job
// commit (or roll back) together.
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
  return row.id;
};

// For actions that change nothing else (a download): its own transaction.
export const recordActivity = <A extends LoggedAction>(entry: ActivityEntry<A>) =>
  db.transaction((tx) => logActivity(tx, entry));
