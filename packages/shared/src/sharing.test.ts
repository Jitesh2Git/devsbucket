import { describe, expect, it } from "vitest";
import { roleLabel, shareFormSchema, sharingSettingSchema } from "./sharing.ts";

describe("shareFormSchema", () => {
  it("accepts an email and a role", () => {
    expect(shareFormSchema.parse({ email: "ada@example.com", role: "editor" })).toEqual({
      email: "ada@example.com",
      role: "editor",
    });
  });

  it.each([
    { email: "not-an-email", role: "viewer" },
    { email: "ada@example.com", role: "owner" },
    { email: "ada@example.com", role: "admin" },
  ])("rejects %j", (input) => {
    expect(shareFormSchema.safeParse(input).success).toBe(false);
  });
});

describe("sharingSettingSchema", () => {
  const itemId = "0198c5a0-0000-7000-8000-000000000000";

  it("accepts Editors can share", () => {
    expect(
      sharingSettingSchema.safeParse({ itemId, setting: "editorsCanShare", value: false }).success,
    ).toBe(true);
  });

  it.each(["viewersCanDownload", "ownerId"])("rejects %s", (setting) => {
    expect(sharingSettingSchema.safeParse({ itemId, setting, value: true }).success).toBe(false);
  });
});

describe("roleLabel", () => {
  it("names each role", () => {
    expect(["owner", "editor", "viewer"].map((role) => roleLabel(role as "owner"))).toEqual([
      "Owner",
      "Editor",
      "Viewer",
    ]);
  });
});
