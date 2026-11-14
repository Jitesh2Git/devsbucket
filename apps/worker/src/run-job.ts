import { checkOpsAlerts, checkStorageAlerts, warnTrashEmptying } from "@devsbucket/db/alerts";
import { pool } from "@devsbucket/db/client";
import { queueStorageCleanup } from "@devsbucket/db/jobs";
import { deleteOldNotifications } from "@devsbucket/db/notifications";
import { NOTIFICATION_DAYS } from "@devsbucket/shared/limits";
import { cleanupPendingUploads } from "./jobs/cleanup-pending-uploads.ts";
import { emptyOldTrash } from "./jobs/empty-old-trash.ts";

// Runs one job now, without waiting for its schedule:
//   pnpm --filter worker job cleanup-uploads
//   pnpm --filter worker job empty-trash
//   pnpm --filter worker job cleanup-notifications
//   pnpm --filter worker job check-alerts
//   pnpm --filter worker job trash-warning
const jobs: Record<string, () => Promise<number>> = {
  "cleanup-uploads": cleanupPendingUploads,
  "empty-trash": () => emptyOldTrash(queueStorageCleanup),
  "cleanup-notifications": () => deleteOldNotifications(NOTIFICATION_DAYS),
  "check-alerts": async () => (await checkStorageAlerts()) + (await checkOpsAlerts()),
  "trash-warning": warnTrashEmptying,
};

const name = process.argv[2] ?? "";
const job = jobs[name];
if (!job) {
  console.error(`Usage: pnpm --filter worker job <${Object.keys(jobs).join(" | ")}>`);
  process.exit(1);
}
console.log(`${name}: ${await job()} done`);
await pool.end();
// The retry queue's connection (if a delete failed) would keep Node alive.
process.exit(0);
