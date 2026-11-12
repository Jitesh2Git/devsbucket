import { describe, expect, it } from "vitest";
import {
  APP_STORAGE_LIMIT,
  FREE_OPS,
  MAX_FILE_SIZE,
  opsLevel,
  PART_SIZE,
  partSizes,
  quotaMessage,
  uploadLimitError,
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

describe("quotaMessage", () => {
  it("shows used and quota in readable units", () => {
    expect(quotaMessage(512 * 1024 ** 2, 1024 ** 3)).toBe("Not enough space: 512 MB of 1 GB used.");
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
