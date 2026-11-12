import { type Action, can } from "@devsbucket/authz/can";
import { getItem } from "@devsbucket/db/items";

// The folder `user` wants to act on: the top level of their My Drive when
// folderId is null, otherwise a folder row. null when it doesn't exist, isn't
// a folder, is in the trash, or `can()` says no. Callers answer all of those
// the same way (404 or "no longer exists"), so nobody learns that someone
// else's folder exists.
export const resolveFolder = async (
  user: { id: string },
  folderId: string | null,
  action: Action,
) => {
  if (folderId === null) {
    const myDrive = { ownerId: user.id };
    return can(user, action, myDrive) ? myDrive : null;
  }
  const item = await getItem(folderId);
  if (item?.type !== "folder" || item.trashedAt !== null || !can(user, action, item)) {
    return null;
  }
  return item;
};

// A folder `user` may see that is in the trash, or null. Its old link then
// says so (with Restore) instead of a 404.
export const findTrashedFolder = async (user: { id: string }, folderId: string) => {
  const item = await getItem(folderId);
  if (item?.type !== "folder" || item.trashedAt === null || !can(user, "view", item)) {
    return null;
  }
  return item;
};
