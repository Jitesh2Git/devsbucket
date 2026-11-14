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

await boss.work<StorageCleanup>(QUEUES.deleteStorage, async (jobs) => {
  for (const job of jobs) {
    await deleteStorageObjects(job.data);
    log(`deleted ${job.data.storageKeys.length} objects from storage (retry)`);
  }
});

// Activity → notifications (decision 0010), one job per activity row.
await boss.work<NotifyActivity>(QUEUES.notifyActivity, async (jobs) => {
  for (const job of jobs) {
    await notifyForActivity(job.data.activityId);
  }
});

await boss.work(QUEUES.cleanupNotifications, async () => {
  const deleted = await deleteOldNotifications(NOTIFICATION_DAYS);
  if (deleted > 0) log(`deleted ${deleted} notifications older than ${NOTIFICATION_DAYS} days`);
});

log(
  "started: cleanup every 15 minutes, old trash daily at 03:00 UTC, old notifications at 03:30 UTC",
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
