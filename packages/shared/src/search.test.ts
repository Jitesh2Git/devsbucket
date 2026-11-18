import { describe, expect, it } from "vitest";
import { containsPattern, searchSchema } from "./search.ts";

describe("searchSchema", () => {
  it("trims, and wants 2 to 100 characters", () => {
    expect(searchSchema.parse({ query: "  notes " })).toEqual({ query: "notes" });
    expect(searchSchema.safeParse({ query: " n " }).success).toBe(false);
    expect(searchSchema.safeParse({ query: "x".repeat(101) }).success).toBe(false);
  });
});

describe("containsPattern", () => {
  it("lowercases, and matches %, _ and \\ as themselves", () => {
    expect(containsPattern("Notes")).toBe("%notes%");
    expect(containsPattern("100%_done\\x")).toBe("%100\\%\\_done\\\\x%");
  });
});
