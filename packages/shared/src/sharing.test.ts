import { describe, expect, it } from "vitest";
import { personRefSchema, roleLabel, shareFormSchema, sharingSettingSchema } from "./sharing.ts";

describe("shareFormSchema", () => {
  it.each(["ada@example.com", "@ada", "ada"])("accepts %s and a role", (person) => {
    expect(shareFormSchema.parse({ person, role: "editor" })).toEqual({ person, role: "editor" });
  });

  it.each([
    { person: "", role: "viewer" },
    { person: "not an email", role: "viewer" },
    { person: "ada@", role: "viewer" },
    { person: "@a", role: "viewer" },
    { person: "ada@example.com", role: "owner" },
    { person: "ada@example.com", role: "admin" },
  ])("rejects %j", (input) => {
    expect(shareFormSchema.safeParse(input).success).toBe(false);
  });
});

describe("personRefSchema", () => {
  it.each([
    ["Ada@Example.com", { by: "email", email: "ada@example.com" }],
    ["@Ada-Lovelace", { by: "username", username: "ada-lovelace" }],
    ["  ada  ", { by: "username", username: "ada" }],
  ])("reads %s", (input, expected) => {
    expect(personRefSchema.parse(input)).toEqual(expected);
  });

  it.each(["@", "@-ada", "ada smith", "@ada@example.com"])("rejects %s", (input) => {
    expect(personRefSchema.safeParse(input).success).toBe(false);
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
