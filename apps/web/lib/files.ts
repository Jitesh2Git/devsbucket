import { type Action, can } from "@devsbucket/authz/can";
import { getItem } from "@devsbucket/db/items";
import { itemIdSchema } from "@devsbucket/shared/item";

// The file `user` wants to act on, or null when the id isn't a uuid, the
// file doesn't exist, isn't a finished upload, is in the trash, or `can()`
// says no. Callers answer all of those with the same 404, so nobody learns
// that someone else's file exists.
export const resolveFile = async (user: { id: string }, fileId: string, action: Action) => {
  if (!itemIdSchema.safeParse(fileId).success) {
    return null;
  }
  const item = await getItem(fileId);
  if (
    item?.type !== "file" ||
    item.status !== "ready" ||
    item.trashedAt !== null ||
    !can(user, action, item)
  ) {
    return null;
  }
  return item;
};
