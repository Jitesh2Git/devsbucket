import { describe, expect, it } from "vitest";
import { usernameSchema } from "./user.ts";

describe("usernameSchema", () => {
  it("lowercases and trims", () => {
    expect(usernameSchema.parse("  Ada-L  ")).toBe("ada-l");
  });

  it.each([
    ["ab", "too short"],
    ["a".repeat(33), "too long"],
    ["-ada", "starts with a hyphen"],
    ["ada-", "ends with a hyphen"],
    ["ada_l", "has an underscore"],
    ["ada l", "has a space"],
  ])("rejects %s (%s)", (input) => {
    expect(usernameSchema.safeParse(input).success).toBe(false);
  });

  it.each(["ada", "ada-l", "a1b2", "abc-def-123"])("accepts %s", (input) => {
    expect(usernameSchema.safeParse(input).success).toBe(true);
  });
});
