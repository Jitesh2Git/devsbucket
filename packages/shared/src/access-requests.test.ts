import { describe, expect, it } from "vitest";
import { REQUEST_MESSAGE_MAX, requestFormSchema } from "./access-requests.ts";

describe("requestFormSchema", () => {
  it("accepts a role and trims the message", () => {
    expect(requestFormSchema.parse({ role: "editor", message: "  please  " })).toEqual({
      role: "editor",
      message: "please",
    });
    expect(requestFormSchema.parse({ role: "viewer", message: "" }).message).toBe("");
  });

  it("refuses the owner role and long messages", () => {
    expect(requestFormSchema.safeParse({ role: "owner", message: "" }).success).toBe(false);
    expect(
      requestFormSchema.safeParse({
        role: "viewer",
        message: "a".repeat(REQUEST_MESSAGE_MAX + 1),
      }).success,
    ).toBe(false);
  });
});
