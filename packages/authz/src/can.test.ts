import { describe, expect, it } from "vitest";
import { type Action, actions, can } from "./can.ts";

const owner = { id: "owner" };
const other = { id: "other" };
const item = { ownerId: owner.id };

// Every action × every kind of user. Phase 3 adds Editor, Viewer and
// share-link columns to this grid.
const grid: Record<Action, { owner: boolean; other: boolean }> = {
  view: { owner: true, other: false },
  download: { owner: true, other: false },
  upload: { owner: true, other: false },
  create_folder: { owner: true, other: false },
  rename: { owner: true, other: false },
  move: { owner: true, other: false },
  trash: { owner: true, other: false },
  restore: { owner: true, other: false },
  delete_forever: { owner: true, other: false },
};

describe("can", () => {
  it.each(actions)("%s: owner and other user", (action) => {
    expect(can(owner, action, item)).toBe(grid[action].owner);
    expect(can(other, action, item)).toBe(grid[action].other);
  });

  it("lets a user act on the top level of their own My Drive", () => {
    expect(can(owner, "upload", { ownerId: owner.id })).toBe(true);
    expect(can(other, "upload", { ownerId: owner.id })).toBe(false);
  });
});
