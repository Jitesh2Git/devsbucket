import { describe, expect, it } from "vitest";
import {
  APP_STORAGE_LIMIT,
  FREE_OPS,
  MAX_FILE_SIZE,
  opsLevel,
  ownerQuotaMessage,
  PART_SIZE,
  partSizes,
  quotaMessage,
  trashDaysLeft,
  uploadLimitError,
  ZIP_MAX_BYTES,
  ZIP_MAX_FILES,
  zipLimitError,
} from "./limits.ts";

const noOps = { classA: 0, classB: 0 };
const ok = { size: 1024, appStorageUsed: 0, ops: noOps };

describe("opsLevel", () => {
  it("is ok below 70% of both classes", () => {
    expect(opsLevel(noOps)).toBe("ok");
    expect(opsLevel({ classA: 699_999, classB: 6_999_999 })).toBe("ok");
  });

  it("warns from 70% of either class", () => {
    expect(opsLevel({ classA: 700_000, classB: 0 })).toBe("warn");
    expect(opsLevel({ classA: 0, classB: 7_000_000 })).toBe("warn");
  });

  it("blocks from 90% of either class", () => {
    expect(opsLevel({ classA: 900_000, classB: 0 })).toBe("block");
    expect(opsLevel({ classA: 0, classB: FREE_OPS.classB })).toBe("block");
  });
});

describe("uploadLimitError", () => {
  it("allows a normal upload", () => {
    expect(uploadLimitError(ok)).toBeNull();
  });

  it("allows exactly 100 MB and refuses one byte more", () => {
    expect(uploadLimitError({ ...ok, size: MAX_FILE_SIZE })).toBeNull();
    expect(uploadLimitError({ ...ok, size: MAX_FILE_SIZE + 1 })).toBe("Files can be up to 100 MB.");
  });

  it("refuses sizes that aren't a byte count", () => {
    expect(uploadLimitError({ ...ok, size: -1 })).toBe("Invalid file size.");
    expect(uploadLimitError({ ...ok, size: 1.5 })).toBe("Invalid file size.");
    expect(uploadLimitError({ ...ok, size: Number.NaN })).toBe("Invalid file size.");
  });

  it("stops at the app-wide 9 GB", () => {
    expect(uploadLimitError({ ...ok, appStorageUsed: APP_STORAGE_LIMIT - 1024 })).toBeNull();
    expect(uploadLimitError({ ...ok, appStorageUsed: APP_STORAGE_LIMIT - 1023 })).toBe(
      "Uploads are paused: the app's storage is full.",
    );
  });

  it("stops at 90% of the monthly operations", () => {
    expect(uploadLimitError({ ...ok, ops: { classA: 900_000, classB: 0 } })).toMatch(
      /^Uploads are paused until next month/,
    );
  });

  it("checks size before anything else", () => {
    expect(
      uploadLimitError({
        size: MAX_FILE_SIZE + 1,
        appStorageUsed: APP_STORAGE_LIMIT,
        ops: { classA: FREE_OPS.classA, classB: 0 },
      }),
    ).toBe("Files can be up to 100 MB.");
  });
});

describe("zipLimitError", () => {
  it("allows a folder up to the caps", () => {
    expect(zipLimitError({ files: ZIP_MAX_FILES, bytes: ZIP_MAX_BYTES, ops: noOps })).toBeNull();
  });

  it("refuses an empty folder, one over a cap, and blocked operations", () => {
    expect(zipLimitError({ files: 0, bytes: 0, ops: noOps })).toBe(
      "This folder has no files to download.",
    );
    expect(zipLimitError({ files: ZIP_MAX_FILES + 1, bytes: 10, ops: noOps })).toMatch(
      /^This folder is too big to download as a ZIP \(1001 files, 10 B\)/,
    );
    expect(zipLimitError({ files: 1, bytes: ZIP_MAX_BYTES + 1, ops: noOps })).toMatch(/too big/);
    expect(
      zipLimitError({ files: 1, bytes: 1, ops: { classA: 0, classB: FREE_OPS.classB } }),
    ).toMatch(/paused until next month/);
  });
});

describe("zipLimitError for selected items", () => {
  it("says these items instead of this folder", () => {
    expect(zipLimitError({ files: 0, bytes: 0, ops: noOps, selection: true })).toBe(
      "These items have no files to download.",
    );
    expect(
      zipLimitError({ files: ZIP_MAX_FILES + 1, bytes: 10, ops: noOps, selection: true }),
    ).toMatch(/^These items are too big to download as a ZIP .*download fewer items\.$/);
  });
});

describe("quotaMessage", () => {
  it("shows used and quota in readable units", () => {
    expect(quotaMessage(512 * 1024 ** 2, 1024 ** 3)).toBe("Not enough space: 512 MB of 1 GB used.");
  });

  it("names the owner, without their numbers, in someone else's folder", () => {
    expect(ownerQuotaMessage("Ada")).toBe("Not enough space in Ada's drive.");
  });
});

describe("partSizes", () => {
  it("cuts a file into 10 MB parts and a smaller last part", () => {
    const MiB = 1024 ** 2;
    expect(partSizes(25 * MiB)).toEqual([10 * MiB, 10 * MiB, 5 * MiB]);
    expect(partSizes(50 * MiB + 1)).toEqual([10 * MiB, 10 * MiB, 10 * MiB, 10 * MiB, 10 * MiB, 1]);
  });

  it("never needs more than 10 parts", () => {
    expect(partSizes(MAX_FILE_SIZE)).toHaveLength(10);
    expect(partSizes(MAX_FILE_SIZE).every((size) => size === PART_SIZE)).toBe(true);
  });
});

describe("trashDaysLeft", () => {
  const trashedAt = new Date("2026-11-01T12:00:00Z");
  const daysLater = (days: number) => new Date(trashedAt.getTime() + days * 24 * 60 * 60 * 1000);

  it("counts down from 30 whole days", () => {
    expect(trashDaysLeft(trashedAt, trashedAt)).toBe(30);
    expect(trashDaysLeft(trashedAt, daysLater(0.5))).toBe(30);
    expect(trashDaysLeft(trashedAt, daysLater(1))).toBe(29);
    expect(trashDaysLeft(trashedAt, daysLater(29.5))).toBe(1);
  });

  it("never goes below 0", () => {
    expect(trashDaysLeft(trashedAt, daysLater(30))).toBe(0);
    expect(trashDaysLeft(trashedAt, daysLater(45))).toBe(0);
  });
});
