import { getOpsThisMonth } from "@devsbucket/db/usage";
import { zipSummary } from "@devsbucket/db/zip";
import { zipLimitError } from "@devsbucket/shared/limits";
import { deniedMessage, resolveItem } from "@/lib/items";

// Several selected items as one ZIP (multi-select): every one must be
// there and downloadable by `user`, or none is zipped. Shared by checkZip
// (asked first, for a message on the page) and the /api/zip route.
export const resolveZipSelection = async (user: { id: string }, itemIds: string[]) => {
  const ids = [...new Set(itemIds)];
  const found = [];
  for (const itemId of ids) {
    const one = await resolveItem(user, itemId, "download", { trashed: false });
    if (one.denied) {
      return { error: deniedMessage(one.denied, "One of these items no longer exists.") } as const;
    }
    found.push(one.item);
  }
  const roots = { itemIds: ids };
  const [summary, ops] = await Promise.all([zipSummary(roots), getOpsThisMonth()]);
  const refused = zipLimitError({ ...summary, ops, selection: true });
  if (refused) {
    return { error: refused } as const;
  }
  return { error: null, items: found, roots, ...summary } as const;
};
