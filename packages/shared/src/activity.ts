// Activity (LOCKED.md "Activity", decision 0010): every action on an item
// writes one row, in the same transaction as the change. Read by the worker
// for notifications (step 11) and by the activity panel (Phase 5).

// Phase 3's actions. The database check allows exactly these; Phase 4 adds
// edited, version_saved and version_restored with a migration.
export const activityActions = [
  "created",
  "uploaded",
  "renamed",
  "moved",
  "trashed",
  "restored",
  "deleted_forever",
  "downloaded",
  "shared",
  "access_changed",
  "access_removed",
  "link_created",
  "link_disabled",
  "link_changed",
  "link_opened",
  "access_requested",
  "access_approved",
  "access_denied",
  "ownership_offered",
  "ownership_transferred",
  "settings_changed",
] as const;

export type ActivityAction = (typeof activityActions)[number];

// What each action records besides the item and the actor. Only ids and
// names: an activity row never holds file contents. Each step adds the
// shapes of the actions it starts writing.
export type ActivityMetadata = {
  created: Record<string, never>;
  uploaded: { size: number };
  renamed: { from: string; to: string };
  // Folder ids; null = the top level of the owner's My Drive.
  moved: { from: string | null; to: string | null };
  trashed: Record<string, never>;
  restored: { name: string; movedToTop: boolean };
  // Logged on the folder it was in (the item itself is gone).
  deleted_forever: { name: string; type: "folder" | "file" | "note" };
  downloaded: Record<string, never>;
  // The person given, changed or removed (step 5).
  shared: { userId: string; role: "editor" | "viewer" };
  access_changed: { userId: string; from: "editor" | "viewer"; to: "editor" | "viewer" };
  access_removed: { userId: string; role: "editor" | "viewer" };
  settings_changed: { setting: "editorsCanShare"; value: boolean };
  // The link as it is after the change (step 7). expiresAt: ISO date or null.
  link_created: { role: "editor" | "viewer"; expiresAt: string | null };
  link_changed: { role: "editor" | "viewer"; expiresAt: string | null };
  link_disabled: Record<string, never>;
  // The visitor is the actor; logged on their first open only.
  link_opened: { role: "editor" | "viewer" };
  // Access requests (step 8). Requested: the requester is the actor.
  // Approved or denied: the one who decided is, and userId the requester.
  access_requested: { role: "editor" | "viewer" };
  access_approved: { userId: string; role: "editor" | "viewer" };
  access_denied: { userId: string };
  // Ownership transfers (step 9). Offered: by the owner, to toUserId.
  // Transferred: the new owner accepted, and is the actor.
  ownership_offered: { toUserId: string };
  ownership_transferred: { fromUserId: string; toUserId: string };
};

export type LoggedAction = keyof ActivityMetadata;
