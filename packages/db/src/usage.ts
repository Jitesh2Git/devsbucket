import type { OpsCount } from "@devsbucket/shared/limits";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./client.ts";
import { users } from "./schema/auth.ts";
import { usageCounters } from "./schema/usage.ts";

// "2026-11" (UTC): R2 resets its free operations each calendar month.
export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

// Adds operations to this month's counters. One statement, so two requests
// at once both count (no read-then-write).
export const countOps = async ({ classA = 0, classB = 0 }: Partial<OpsCount>) => {
  await db
    .insert(usageCounters)
    .values({ month: currentMonth(), classAOps: classA, classBOps: classB })
    .onConflictDoUpdate({
      target: usageCounters.month,
      set: {
        classAOps: sql`${usageCounters.classAOps} + excluded.class_a_ops`,
        classBOps: sql`${usageCounters.classBOps} + excluded.class_b_ops`,
      },
    });
};

export const getOpsThisMonth = async (): Promise<OpsCount> => {
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.month, currentMonth()));
  return { classA: row?.classAOps ?? 0, classB: row?.classBOps ?? 0 };
};

// Bytes stored by everyone, reservations for uploads in progress included.
export const getAppStorageUsed = async () => {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${users.storageUsed}), 0)`.mapWith(Number) })
    .from(users);
  return row?.total ?? 0;
};

// Takes `bytes` from the user's quota before an upload starts. The check and
// the update are one statement, so two uploads at once can't both squeeze
// into the last free megabytes.
export const reserveStorage = async (userId: string, bytes: number) => {
  const [reserved] = await db
    .update(users)
    .set({ storageUsed: sql`${users.storageUsed} + ${bytes}` })
    .where(and(eq(users.id, userId), sql`${users.storageUsed} + ${bytes} <= ${users.storageQuota}`))
    .returning({ storageUsed: users.storageUsed });
  if (reserved) {
    return { ok: true } as const;
  }
  const [user] = await db
    .select({ storageUsed: users.storageUsed, storageQuota: users.storageQuota })
    .from(users)
    .where(eq(users.id, userId));
  return { ok: false, used: user?.storageUsed ?? 0, quota: user?.storageQuota ?? 0 } as const;
};

// Gives bytes back (cancelled upload, deleted file). Never below zero.
export const releaseStorage = async (userId: string, bytes: number) => {
  await db
    .update(users)
    .set({ storageUsed: sql`greatest(${users.storageUsed} - ${bytes}, 0)` })
    .where(eq(users.id, userId));
};
