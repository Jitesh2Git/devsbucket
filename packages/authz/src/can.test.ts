import { describe, expect, it } from "vitest";
import { type Action, type AuthzAccess, actions, can, MY_DRIVE } from "./can.ts";

const roles = ["owner", "editor", "viewer", "none"] as const;
type Column = (typeof roles)[number];

const access = (role: Column, settings: Partial<AuthzAccess> = {}): AuthzAccess => ({
  role: role === "none" ? null : role,
  editorsCanShare: true,
  ...settings,
});

// Every action × every role, with sharing on (LOCKED.md "Roles").
const grid: Record<Action, Record<Column, boolean>> = {
  view: { owner: true, editor: true, viewer: true, none: false },
  download: { owner: true, editor: true, viewer: true, none: false },
  upload: { owner: true, editor: true, viewer: false, none: false },
  create_folder: { owner: true, editor: true, viewer: false, none: false },
  rename: { owner: true, editor: true, viewer: false, none: false },
  move: { owner: true, editor: true, viewer: false, none: false },
  trash: { owner: true, editor: true, viewer: false, none: false },
  restore: { owner: true, editor: true, viewer: false, none: false },
  view_activity: { owner: true, editor: true, viewer: false, none: false },
  share: { owner: true, editor: true, viewer: false, none: false },
  delete_forever: { owner: true, editor: false, viewer: false, none: false },
  change_settings: { owner: true, editor: false, viewer: false, none: false },
  transfer: { owner: true, editor: false, viewer: false, none: false },
  request_access: { owner: false, editor: false, viewer: false, none: true },
};

describe("can", () => {
  it.each(actions)("%s: owner, editor, viewer, no role", (action) => {
    for (const role of roles) {
      expect(can(access(role), action), role).toBe(grid[action][role]);
    }
  });

  it("with sharing off, only Editors lose share, and nothing else changes", () => {
    const off = { editorsCanShare: false };
    for (const action of actions) {
      for (const role of roles) {
        const expected = action === "share" && role === "editor" ? false : grid[action][role];
        expect(can(access(role, off), action), `${action} ${role}`).toBe(expected);
      }
    }
  });

  it("treats the top level of My Drive as the user's own", () => {
    for (const action of actions) {
      expect(can(MY_DRIVE, action), action).toBe(grid[action].owner);
    }
  });
});
