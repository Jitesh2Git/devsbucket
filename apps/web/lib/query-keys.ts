// TanStack Query keys, in one place so a mutation invalidates exactly what
// the list reads.
export const itemsQueryKey = (parentId: string | null) =>
  ["items", parentId ?? "my-drive"] as const;

// The Move dialog's folder picker. All of them go stale when folders move.
export const foldersQueryKey = (parentId: string | null) =>
  ["folders", parentId ?? "my-drive"] as const;

// Who has access to one item (the Share dialog).
export const sharingQueryKey = (itemId: string) => ["sharing", itemId] as const;

// The user's notifications, and (under it, so both refresh together) the
// unread count in the sidebar.
export const notificationsQueryKey = ["notifications"] as const;
export const unreadQueryKey = ["notifications", "unread"] as const;

// Whether the user muted an item (its menu's Mute notifications).
export const muteQueryKey = (itemId: string) => ["mute", itemId] as const;
