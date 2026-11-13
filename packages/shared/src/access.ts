// What item_access() (packages/db/drizzle, decision 0008) says about one user
// and one item. packages/authz decides what each role may do (step 3).

export const roles = ["owner", "editor", "viewer"] as const;

export type Role = (typeof roles)[number];

export type Access = {
  // null: the item exists, but this user has no access to it.
  role: Role | null;
  // Off if the item or any folder above it turned it off.
  editorsCanShare: boolean;
  trashed: boolean;
};
