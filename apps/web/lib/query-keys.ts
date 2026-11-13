// TanStack Query keys, in one place so a mutation invalidates exactly what
// the list reads.
export const itemsQueryKey = (parentId: string | null) =>
  ["items", parentId ?? "my-drive"] as const;

// The Move dialog's folder picker. All of them go stale when folders move.
export const foldersQueryKey = (parentId: string | null) =>
  ["folders", parentId ?? "my-drive"] as const;

// Who has access to one item (the Share dialog).
export const sharingQueryKey = (itemId: string) => ["sharing", itemId] as const;
