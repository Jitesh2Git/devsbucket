import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect.ts";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/s/abc")).toBe("/s/abc");
    expect(safeNextPath("/drive/folders/1?x=1")).toBe("/drive/folders/1?x=1");
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\tevil",
    "drive",
    `/${"a".repeat(600)}`,
  ])("refuses %j", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});
