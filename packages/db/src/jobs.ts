// Background jobs with pg-boss (LOCKED.md): a queue that lives in Postgres,
// in its own `pgboss` schema (drizzle-kit only manages `public`). The worker
// (apps/worker) runs the jobs; the web app only adds them.
import { PgBoss } from "pg-boss";

export const QUEUES = {
  // Uploads still pending after an hour: a closed tab, a crash.
  cleanupUploads: "cleanup-pending-uploads",
  // Trash older than 30 days (decision 0007).
  emptyOldTrash: "empty-old-trash",
  // Storage deletes that failed after the rows were already gone.
  deleteStorage: "delete-storage-objects",
} as const;

export type StorageCleanup = {
  storageKeys: string[];
  uploads: { key: string; uploadId: string }[];
};

const databaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
};

// A pg-boss instance for this database. The worker's runs the jobs and the
// schedules; the web app's only sends.
export const createBoss = (options: { worker: boolean }) => {
  const boss = new PgBoss({
    connectionString: databaseUrl(),
    schema: "pgboss",
    // Maintenance and cron belong to the worker alone.
    supervise: options.worker,
    schedule: options.worker,
    max: options.worker ? 4 : 2,
  });
  boss.on("error", (error) => console.error("pg-boss:", error));
  return boss;
};

// Queues must exist before jobs are sent to them. Safe to call every start.
export const createQueues = async (boss: PgBoss) => {
  await boss.createQueue(QUEUES.cleanupUploads, { policy: "singleton" });
  await boss.createQueue(QUEUES.emptyOldTrash, { policy: "singleton" });
  // Retried with growing delays (1 min, 2, 4, …) when storage is down.
  await boss.createQueue(QUEUES.deleteStorage, {
    retryLimit: 10,
    retryDelay: 60,
    retryBackoff: true,
  });
};

// One sending instance per web server process (kept across Next.js dev
// reloads, like the database pool).
const globalForBoss = globalThis as unknown as { sender?: Promise<PgBoss> };

const sender = () => {
  globalForBoss.sender ??= (async () => {
    const boss = createBoss({ worker: false });
    await boss.start();
    await createQueues(boss);
    return boss;
  })();
  return globalForBoss.sender;
};

// Hands storage deletes that failed to the worker, which retries them.
export const queueStorageCleanup = async (cleanup: StorageCleanup) => {
  const boss = await sender();
  await boss.send(QUEUES.deleteStorage, cleanup);
};
