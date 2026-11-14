import { describe, expect, it } from "vitest";
import { changeLinkSchema, expiresAtFor, isLinkActive, linkTokenSchema } from "./share-links.ts";

const now = new Date("2026-11-14T12:00:00Z");

describe("expiresAtFor", () => {
  it("adds whole days, or never expires", () => {
    expect(expiresAtFor("never", now)).toBeNull();
    expect(expiresAtFor("1d", now)?.toISOString()).toBe("2026-11-15T12:00:00.000Z");
    expect(expiresAtFor("30d", now)?.toISOString()).toBe("2026-12-14T12:00:00.000Z");
  });
});

describe("isLinkActive", () => {
  const later = new Date("2026-11-15T00:00:00Z");
  const earlier = new Date("2026-11-13T00:00:00Z");

  it("works until it's disabled or expires", () => {
    expect(isLinkActive({ disabledAt: null, expiresAt: null }, now)).toBe(true);
    expect(isLinkActive({ disabledAt: null, expiresAt: later }, now)).toBe(true);
    expect(isLinkActive({ disabledAt: null, expiresAt: earlier }, now)).toBe(false);
    expect(isLinkActive({ disabledAt: earlier, expiresAt: null }, now)).toBe(false);
  });

  it("stops at the exact moment it expires", () => {
    expect(isLinkActive({ disabledAt: null, expiresAt: now }, now)).toBe(false);
  });
});

describe("linkTokenSchema", () => {
  it("accepts 43 base64url characters only", () => {
    expect(linkTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(linkTokenSchema.safeParse("A-_9".padEnd(43, "x")).success).toBe(true);
    expect(linkTokenSchema.safeParse("a".repeat(42)).success).toBe(false);
    expect(linkTokenSchema.safeParse(`${"a".repeat(42)}/`).success).toBe(false);
  });
});

describe("changeLinkSchema", () => {
  const itemId = "0198c5a0-0000-7000-8000-000000000000";

  it("needs a role or an expiry", () => {
    expect(changeLinkSchema.safeParse({ itemId, role: "editor" }).success).toBe(true);
    expect(changeLinkSchema.safeParse({ itemId, expiry: "7d" }).success).toBe(true);
    expect(changeLinkSchema.safeParse({ itemId }).success).toBe(false);
  });
});
