// TanStack Query keys, in one place so a mutation invalidates exactly what
// the list reads.
export const itemsQueryKey = (parentId: string | null) =>
  ["items", parentId ?? "my-drive"] as const;
