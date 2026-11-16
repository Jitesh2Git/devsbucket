// Every permission check on items goes through can() (CLAUDE.md). It's pure:
// the caller gets the user's access to the item from item_access()
// (@devsbucket/db/access) and asks what that access allows (LOCKED.md
// "Roles", decisions 0002 and 0008).

export const actions = [
  "view",
  "download",
  "copy", // a file, into the same folder or your own drive (Phase 5)
  "upload", // into a folder
  "create_folder", // inside a folder
  "rename",
  "move",
  "trash",
  "restore",
  "delete_forever",
  "share", // people and links
  "change_settings", // editors can share
  "transfer", // ownership
  "view_activity",
  "request_access", // only when there's no role
  "edit", // a text file's content (Phase 4, decision 0013)
  "view_versions", // history and diff; with edit, also save and restore
] as const;

export type Action = (typeof actions)[number];

// What item_access() returns, minus what can() doesn't need. A full
// `Access` from @devsbucket/shared/access fits.
export type AuthzAccess = {
  role: "owner" | "editor" | "viewer" | null;
  editorsCanShare: boolean;
};

// The top level of My Drive has no row: it's always the user's own.
export const MY_DRIVE: AuthzAccess = {
  role: "owner",
  editorsCanShare: true,
};

const isOwner = (access: AuthzAccess) => access.role === "owner";
const isEditor = (access: AuthzAccess) => access.role === "owner" || access.role === "editor";

// Owner: everything. Editor: everything a Viewer can, plus changing
// content, editing text files, restoring, activity, version history and
// sharing (unless the Owner turned it off).
// Viewer: view, download and make a copy (decision 0012: a preview sends the
// bytes anyway).
const rules: Record<Action, (access: AuthzAccess) => boolean> = {
  view: (access) => access.role !== null,
  download: (access) => access.role !== null,
  copy: (access) => access.role !== null,
  upload: isEditor,
  create_folder: isEditor,
  rename: isEditor,
  move: isEditor,
  trash: isEditor,
  restore: isEditor,
  view_activity: isEditor,
  edit: isEditor,
  view_versions: isEditor,
  share: (access) => isOwner(access) || (access.role === "editor" && access.editorsCanShare),
  delete_forever: isOwner,
  change_settings: isOwner,
  transfer: isOwner,
  request_access: (access) => access.role === null,
};

export const can = (access: AuthzAccess, action: Action): boolean => rules[action](access);
