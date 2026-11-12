import { describe, expect, it } from "vitest";
import { changePasswordSchema, setPasswordSchema, signUpSchema } from "./auth.ts";

describe("signUpSchema", () => {
  const valid = { name: "Ada Lovelace", email: "ada@example.com", password: "long-enough" };

  it("accepts a valid sign-up", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name", () => {
    expect(signUpSchema.parse({ ...valid, name: "  Ada  " }).name).toBe("Ada");
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Password must be at least 8 characters");
  });

  it("rejects an invalid email", () => {
    expect(signUpSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("setPasswordSchema", () => {
  it("reports a mismatch on the confirm field", () => {
    const result = setPasswordSchema.safeParse({
      newPassword: "long-enough",
      confirmPassword: "something-else",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("changePasswordSchema", () => {
  it("requires the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "long-enough",
      confirmPassword: "long-enough",
      revokeOtherSessions: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["currentPassword"]);
  });
});
