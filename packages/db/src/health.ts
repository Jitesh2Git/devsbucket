import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";

// For GET /api/health (Phase 6): whether the database answers a trivial
// query in time. Never throws and reads no data, so the health check can be
// public. A database that hangs counts as down after `timeoutMs`.
export const databaseIsUp = async (tx: Executor = db, timeoutMs = 3000) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), timeoutMs);
  });
  try {
    await Promise.race([tx.execute(sql`select 1`), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
