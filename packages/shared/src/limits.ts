import { formatBytes } from "./bytes.ts";

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;

// LOCKED.md "Limits".
export const MAX_FILE_SIZE = 100 * MiB;
// Files above this upload in parts (step 7).
export const MULTIPART_THRESHOLD = 50 * MiB;
// The whole app stops taking uploads here, below R2's free 10 GB.
export const APP_STORAGE_LIMIT = 9 * GiB;

// R2's free tier per month: class A = writes and lists, class B = reads.
export const FREE_OPS = { classA: 1_000_000, classB: 10_000_000 } as const;
export const OPS_WARN_AT = 0.7;
export const OPS_BLOCK_AT = 0.9;

export type OpsCount = { classA: number; classB: number };

// How close this month's operations are to the free tier, by the fuller class.
export const opsLevel = (ops: OpsCount): "ok" | "warn" | "block" => {
  const used = Math.max(ops.classA / FREE_OPS.classA, ops.classB / FREE_OPS.classB);
  if (used >= OPS_BLOCK_AT) return "block";
  if (used >= OPS_WARN_AT) return "warn";
  return "ok";
};

export const quotaMessage = (used: number, quota: number) =>
  `Not enough space: ${formatBytes(used)} of ${formatBytes(quota)} used.`;

// The app-wide checks before an upload, as the message the user sees, or
// null when it may go ahead. The user's own quota is checked separately,
// atomically in SQL (`reserveStorage`).
export const uploadLimitError = (input: {
  size: number;
  appStorageUsed: number;
  ops: OpsCount;
}): string | null => {
  if (!Number.isSafeInteger(input.size) || input.size < 0) {
    return "Invalid file size.";
  }
  if (input.size > MAX_FILE_SIZE) {
    return `Files can be up to ${formatBytes(MAX_FILE_SIZE)}.`;
  }
  if (input.appStorageUsed + input.size > APP_STORAGE_LIMIT) {
    return "Uploads are paused: the app's storage is full.";
  }
  if (opsLevel(input.ops) === "block") {
    return "Uploads are paused until next month: the app reached its storage limit for this month.";
  }
  return null;
};

// Multipart uploads: 10 MB parts, so a 100 MB file is at most 10 of them.
export const PART_SIZE = 10 * MiB;

// The size of each part, in order: full parts, then the rest.
export const partSizes = (size: number) => {
  const sizes: number[] = [];
  for (let offset = 0; offset < size; offset += PART_SIZE) {
    sizes.push(Math.min(PART_SIZE, size - offset));
  }
  return sizes;
};

// What the browser reports back for each uploaded part.
export type Part = { partNumber: number; etag: string };

// Trash: items are deleted forever this many days after being trashed
// (decision 0007; the worker does it, step 11).
export const TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days until a trashed item is deleted forever: 30 right after
// trashing, 1 on its last day, never below 0.
export const trashDaysLeft = (trashedAt: Date, now: Date) =>
  Math.max(0, Math.ceil((trashedAt.getTime() + TRASH_DAYS * DAY_MS - now.getTime()) / DAY_MS));
