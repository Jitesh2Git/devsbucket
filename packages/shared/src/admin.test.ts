import { describe, expect, it } from "vitest";
import { createInviteSchema, setQuotaSchema } from "./admin.ts";

const userId = "0198c5a0-0000-7000-8000-000000000000";

describe("setQuotaSchema", () => {
  it.each(["5GB", " 500 MB ", "1073741824"])("accepts %s", (size) => {
    expect(setQuotaSchema.safeParse({ userId, size }).success).toBe(true);
  });

  it.each(["", "lots", "-1GB", "5 PB"])("rejects %s", (size) => {
    const result = setQuotaSchema.safeParse({ userId, size });
    expect(result.success).toBe(false);
  });

  it("rejects a user id that isn't a uuid", () => {
    expect(setQuotaSchema.safeParse({ userId: "1", size: "5GB" }).success).toBe(false);
  });
});

describe("createInviteSchema", () => {
  it.each(["", "ada@example.com"])("accepts %j", (email) => {
    expect(createInviteSchema.safeParse({ email }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(createInviteSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
