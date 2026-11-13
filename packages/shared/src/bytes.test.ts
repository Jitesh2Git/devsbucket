import { describe, expect, it } from "vitest";
import { formatBytes, parseBytes } from "./bytes.ts";

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

describe("parseBytes", () => {
  it.each([
    ["0", 0],
    ["1073741824", 1024 ** 3],
    ["512B", 512],
    ["1.5KB", 1536],
    ["500MB", 500 * 1024 ** 2],
    ["2 GB", 2 * 1024 ** 3],
    ["2gb", 2 * 1024 ** 3],
    [" 1TB ", 1024 ** 4],
  ])("parses %s as %d", (input, expected) => {
    expect(parseBytes(input)).toBe(expected);
  });

  it.each(["", "GB", "-1GB", "1 PB", "1,5GB", "1e9", "lots"])("rejects %s", (input) => {
    expect(() => parseBytes(input)).toThrow(RangeError);
  });

  it("round-trips with formatBytes", () => {
    expect(formatBytes(parseBytes("10 MB"))).toBe("10 MB");
  });
});
