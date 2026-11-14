import { checkOpsAlerts, checkStorageAlerts, warnTrashEmptying } from "@devsbucket/db/alerts";
import { pool } from "@devsbucket/db/client";
import {
  createBoss,
  createQueues,
  type NotifyActivity,
  QUEUES,
  type StorageCleanup,
} from "@devsbucket/db/jobs";
import { deleteOldNotifications, notifyForActivity } from "@devsbucket/db/notifications";
import { NOTIFICATION_DAYS } from "@devsbucket/shared/limits";
import { cleanupPendingUploads } from "./jobs/cleanup-pending-uploads.ts";
import { deleteStorageObjects } from "./jobs/delete-storage-objects.ts";
import { emptyOldTrash } from "./jobs/empty-old-trash.ts";
import { log } from "./log.ts";

// The background worker: pg-boss runs the scheduled jobs (cron, UTC) and
// the jobs the web app queues. Started by `pnpm dev`, and as its own
// container in prod (Phase 6).
// The database may not be up yet (containers starting together, or a fresh
// machine's e2e run): try again every second instead of crashing.
const startBoss = async () => {
  for (;;) {
    const boss = createBoss({ worker: true });
    try {
      await boss.start();
      return boss;
    } catch (error) {
      log(`database not ready (${(error as Error).message}), trying again`);
      await boss.stop({ graceful: false, close: true }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};
const boss = await startBoss();
await createQueues(boss);

const send = async (cleanup: StorageCleanup) => {
  await boss.send(QUEUES.deleteStorage, cleanup);
};

await boss.schedule(QUEUES.cleanupUploads, "*/15 * * * *");
await boss.schedule(QUEUES.emptyOldTrash, "0 3 * * *");

await boss.work(QUEUES.cleanupUploads, async () => {
  const cleaned = await cleanupPendingUploads();
  if (cleaned > 0) log(`cleaned up ${cleaned} abandoned uploads`);
});

await boss.work(QUEUES.emptyOldTrash, async () => {
  const deleted = await emptyOldTrash(send);
  if (deleted > 0) log(`deleted ${deleted} items from the trash forever`);
});

await boss.schedule(QUEUES.cleanupNotifications, "30 3 * * *");

await boss.schedule(QUEUES.checkAlerts, "*/15 * * * *");
await boss.schedule(QUEUES.trashWarning, "0 4 * * *");

await boss.work<StorageCleanup>(QUEUES.deleteStorage, async (jobs) => {
  for (const job of jobs) {
    await deleteStorageObjects(job.data);
    log(`deleted ${job.data.storageKeys.length} objects from storage (retry)`);
  }
});

// Activity → notifications (decision 0010), one job per activity row. By
// default pg-boss takes one job and then waits 2 s before the next fetch,
// even with a backlog: take up to 20 at a time, and keep going while
// batches come back full.
await boss.work<NotifyActivity>(
  QUEUES.notifyActivity,
  { batchSize: 20, burstWhenBatchFull: true },
  async (jobs) => {
    for (const job of jobs) {
      await notifyForActivity(job.data.activityId);
    }
  },
);

await boss.work(QUEUES.cleanupNotifications, async () => {
  const deleted = await deleteOldNotifications(NOTIFICATION_DAYS);
  if (deleted > 0) log(`deleted ${deleted} notifications older than ${NOTIFICATION_DAYS} days`);
});

// System notifications (decision 0010): thresholds every 15 minutes, the
// trash warning once a day.
await boss.work(QUEUES.checkAlerts, async () => {
  const sent = (await checkStorageAlerts()) + (await checkOpsAlerts());
  if (sent > 0) log(`sent ${sent} storage alerts`);
});

await boss.work(QUEUES.trashWarning, async () => {
  const owners = await warnTrashEmptying();
  if (owners > 0) log(`warned ${owners} people about trash being emptied`);
});

log(
  "started: cleanup and alerts every 15 minutes; daily old trash 03:00, old notifications 03:30, trash warning 04:00 UTC",
);

// Ctrl+C, `node --watch` restarts and container stops: let running jobs
// finish, then close the connections.
const shutdown = async () => {
  log("stopping");
  await boss.stop({ graceful: true, timeout: 30_000 });
  await pool.end();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
