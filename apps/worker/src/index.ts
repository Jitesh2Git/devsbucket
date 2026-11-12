import { pool } from "@devsbucket/db/client";
import { createBoss, createQueues, QUEUES, type StorageCleanup } from "@devsbucket/db/jobs";
import { cleanupPendingUploads } from "./jobs/cleanup-pending-uploads.ts";
import { deleteStorageObjects } from "./jobs/delete-storage-objects.ts";
import { emptyOldTrash } from "./jobs/empty-old-trash.ts";
import { log } from "./log.ts";

// The background worker: pg-boss runs the scheduled jobs (cron, UTC) and
// the jobs the web app queues. Started by `pnpm dev`, and as its own
// container in prod (Phase 6).
const boss = createBoss({ worker: true });
await boss.start();
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

await boss.work<StorageCleanup>(QUEUES.deleteStorage, async (jobs) => {
  for (const job of jobs) {
    await deleteStorageObjects(job.data);
    log(`deleted ${job.data.storageKeys.length} objects from storage (retry)`);
  }
});

log("started: cleanup every 15 minutes, old trash daily at 03:00 UTC");

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
