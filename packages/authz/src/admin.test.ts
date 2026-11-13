import { describe, expect, it } from "vitest";
import { adminActions, canAdmin } from "./admin.ts";

const admin = { id: "admin", isAdmin: true };
const other = { id: "other" };

describe("canAdmin", () => {
  it.each(adminActions)("lets an admin %s another user", (action) => {
    expect(canAdmin(admin, action, other)).toBe(true);
  });

  it.each(adminActions)("never lets a non-admin %s", (action) => {
    expect(canAdmin({ id: "user", isAdmin: false }, action, other)).toBe(false);
    expect(canAdmin({ id: "user" }, action, other)).toBe(false);
    expect(canAdmin({ id: "user", isAdmin: null }, action)).toBe(false);
  });

  it.each([
    ["view", true],
    ["manage_invites", true],
    ["set_quota", true],
    ["reset_password", false],
    ["set_admin", false],
    ["sign_out", false],
    ["remove_user", false],
  ] as const)("on their own account, %s is %s", (action, allowed) => {
    expect(canAdmin(admin, action, admin)).toBe(allowed);
  });
});
