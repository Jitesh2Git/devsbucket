import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes.ts";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [15 * 1024 + 300, "15 KB"],
    [10 * 1024 * 1024, "10 MB"],
    [100 * 1024 * 1024, "100 MB"],
    [1024 ** 3, "1 GB"],
    [9 * 1024 ** 3, "9 GB"],
  ])("formats %d as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects %d", (bytes) => {
    expect(() => formatBytes(bytes)).toThrow(RangeError);
  });
});
