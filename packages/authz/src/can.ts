// Every permission check in the app goes through can() (CLAUDE.md).
// Phase 2: only the owner can do anything with their items.
// Phase 3 adds roles (Owner, Editor, Viewer), grants inherited from folders
// and share links, behind the same function.

export const actions = [
  "view",
  "download",
  "upload", // into a folder
  "create_folder", // inside a folder
  "rename",
  "move",
  "trash",
  "restore",
  "delete_forever",
] as const;

export type Action = (typeof actions)[number];

// Only what the rules need, so callers can pass a full row or a small object.
export type AuthzUser = { id: string };
// The top level of My Drive has no row: pass { ownerId: user.id }.
export type AuthzItem = { ownerId: string };

export const can = (user: AuthzUser, _action: Action, item: AuthzItem): boolean =>
  item.ownerId === user.id;
