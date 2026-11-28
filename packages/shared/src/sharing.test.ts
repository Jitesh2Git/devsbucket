import { describe, expect, it } from "vitest";
import {
  personRefSchema,
  roleLabel,
  shareFormSchema,
  shareItemsSchema,
  shareOutcome,
  sharingSettingSchema,
} from "./sharing.ts";

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

describe("shareOutcome", () => {
  it("adds, changes or leaves a grant", () => {
    expect(shareOutcome(null, "viewer")).toBe("added");
    expect(shareOutcome("viewer", "viewer")).toBe("unchanged");
    expect(shareOutcome("viewer", "editor")).toBe("changed");
    expect(shareOutcome("editor", "viewer")).toBe("changed");
  });

  it("never lowers an Editor when sharing several items", () => {
    expect(shareOutcome("editor", "viewer", true)).toBe("unchanged");
    expect(shareOutcome("viewer", "editor", true)).toBe("changed");
  });
});

describe("shareItemsSchema", () => {
  it("takes ids, a person and a role", () => {
    const itemId = "0190a4b8-7e00-7000-8000-000000000001";
    const parsed = shareItemsSchema.parse({ itemIds: [itemId], person: "@ada", role: "editor" });
    expect(parsed.person).toEqual({ by: "username", username: "ada" });
    expect(
      shareItemsSchema.safeParse({ itemIds: [], person: "@ada", role: "editor" }).success,
    ).toBe(false);
  });
});
