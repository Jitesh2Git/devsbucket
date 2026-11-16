import { describe, expect, it } from "vitest";
import { type ActivityMetadata, activityActions, type LoggedAction } from "./activity.ts";
import {
  type ActivityLine,
  activityCursorSchema,
  activityNameIds,
  activityText,
} from "./activity-text.ts";

const ADA = "0190a000-0000-7000-8000-000000000001";
const BOB = "0190a000-0000-7000-8000-000000000002";
const DOCS = "0190a000-0000-7000-8000-000000000003";
const names = { [ADA]: "Ada", [BOB]: "Bob", [DOCS]: "Docs" };

// One example of every action's metadata: a new action without one fails
// the typecheck here, and the test below checks its line.
const examples: { [A in LoggedAction]: ActivityMetadata[A] } = {
  created: {},
  uploaded: { size: 10 },
  renamed: { from: "a.md", to: "b.md" },
  moved: { from: null, to: DOCS },
  trashed: {},
  restored: { name: "a.md", movedToTop: true },
  deleted_forever: { name: "old.md", type: "file" },
  downloaded: {},
  shared: { userId: BOB, role: "editor" },
  access_changed: { userId: BOB, from: "viewer", to: "editor" },
  access_removed: { userId: BOB, role: "viewer" },
  settings_changed: { setting: "editorsCanShare", value: false },
  link_created: { role: "viewer", expiresAt: "2026-12-01T00:00:00.000Z" },
  link_changed: { role: "editor", expiresAt: null },
  link_disabled: {},
  link_opened: { role: "viewer" },
  access_requested: { role: "editor" },
  access_approved: { userId: BOB, role: "viewer" },
  access_denied: { userId: BOB },
  ownership_offered: { toUserId: BOB },
  ownership_transferred: { fromUserId: ADA, toUserId: BOB },
  edited: { versionNumber: 3 },
  version_saved: { versionNumber: 4, message: "Fix intro" },
  version_restored: { versionNumber: 5, from: 2 },
};

const line = <A extends LoggedAction>(action: A, actorId: string | null = ADA) =>
  ({ action, actorId, metadata: examples[action] }) as ActivityLine;

describe("activityText", () => {
  it.each(activityActions)("%s has a line", (action) => {
    const text = activityText(line(action), names);
    expect(text).not.toBe("");
    expect(text).not.toMatch(/undefined|null|\[object/);
  });

  it("uses the names it's given", () => {
    expect(activityText(line("renamed"), names)).toBe('renamed it from "a.md" to "b.md"');
    expect(activityText(line("moved"), names)).toBe('moved it from My Drive to "Docs"');
    expect(activityText(line("shared"), names)).toBe("shared it with Bob as Editor");
    expect(activityText(line("access_changed"), names)).toBe(
      "changed Bob's access from Viewer to Editor",
    );
    expect(activityText(line("link_created"), names)).toBe(
      "created a share link for Viewers, until 2026-12-01",
    );
    expect(activityText(line("version_saved"), names)).toBe('saved version 4: "Fix intro"');
  });

  it("says when a name is missing, and when someone removed their own access", () => {
    expect(activityText(line("shared"), {})).toBe("shared it with a removed account as Editor");
    expect(activityText(line("access_removed", BOB), names)).toBe(
      "removed it from their Shared with me",
    );
    expect(activityText(line("access_removed", ADA), names)).toBe("removed Bob's access");
  });
});

describe("activityNameIds", () => {
  it("collects people and the folders of a move", () => {
    expect(activityNameIds(line("ownership_transferred"))).toEqual({
      people: [BOB, ADA],
      folders: [],
    });
    expect(activityNameIds(line("moved"))).toEqual({ people: [], folders: [DOCS] });
    expect(activityNameIds(line("created"))).toEqual({ people: [], folders: [] });
  });
});

describe("activityCursorSchema", () => {
  it("takes Postgres's timestamp text and refuses anything else", () => {
    expect(
      activityCursorSchema.safeParse({ at: "2026-11-16 12:00:00.123456+00", id: ADA }).success,
    ).toBe(true);
    expect(activityCursorSchema.safeParse({ at: "now(); drop table items", id: ADA }).success).toBe(
      false,
    );
  });
});
