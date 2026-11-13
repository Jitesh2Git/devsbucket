import { type Action, can, MY_DRIVE } from "@devsbucket/authz/can";
import { getAccess } from "@devsbucket/db/access";
import { getItem } from "@devsbucket/db/items";
import type { Access } from "@devsbucket/shared/access";
import { itemIdSchema } from "@devsbucket/shared/item";

// Why an item can't be used:
// - "missing":   no such item (or not the kind the caller wants) → 404
// - "no-access": it exists, but the user has no role on it → "You need
//   access" on pages (decision 0008); "no longer exists" in actions
// - "forbidden": they have a role, but it doesn't allow this → 403
export type Denied = "missing" | "no-access" | "forbidden";

type Item = NonNullable<Awaited<ReturnType<typeof getItem>>>;

export type Resolved<T> =
  | { denied: null; item: T; access: Access }
  | { denied: Denied; item?: never; access?: never };

const deny = (denied: Denied) => ({ denied }) as const;

// The item `user` wants to `action`, with their access to it. Only finished
// items (not pending uploads). `trashed`: true = must be in the trash,
// false = must not be, undefined = either.
export const resolveItem = async (
  user: { id: string },
  itemId: string,
  action: Action,
  want: { type?: "folder" | "file"; trashed?: boolean } = {},
): Promise<Resolved<Item>> => {
  if (!itemIdSchema.safeParse(itemId).success) {
    return deny("missing");
  }
  const item = await getItem(itemId);
  if (
    item?.status !== "ready" ||
    (want.type !== undefined && item.type !== want.type) ||
    (want.trashed !== undefined && (item.trashedAt !== null) !== want.trashed)
  ) {
    return deny("missing");
  }
  const access = await getAccess(user.id, item.id);
  if (!access) {
    return deny("missing");
  }
  if (access.role === null) {
    return deny("no-access");
  }
  if (!can(access, action)) {
    return deny("forbidden");
  }
  return { denied: null, item, access };
};

// The folder `user` wants to act on, outside the trash: the top level of
// their own My Drive when folderId is null.
export const resolveFolder = async (
  user: { id: string },
  folderId: string | null,
  action: Action,
): Promise<Resolved<{ id: string | null; ownerId: string }>> => {
  if (folderId === null) {
    if (!can(MY_DRIVE, action)) {
      return deny("forbidden");
    }
    return {
      denied: null,
      item: { id: null, ownerId: user.id },
      access: { ...MY_DRIVE, trashed: false },
    };
  }
  return resolveItem(user, folderId, action, { type: "folder", trashed: false });
};

// A finished file outside the trash.
export const resolveFile = (user: { id: string }, fileId: string, action: Action) =>
  resolveItem(user, fileId, action, { type: "file", trashed: false });

// What a server action says when it's refused. Missing and no access read
// the same, so an action never confirms that someone else's item exists.
export const NOT_ALLOWED = "You don't have permission to do that.";
export const deniedMessage = (denied: Denied, gone: string) =>
  denied === "forbidden" ? NOT_ALLOWED : gone;
