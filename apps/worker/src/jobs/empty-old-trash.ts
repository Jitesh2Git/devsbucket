import type { StorageCleanup } from "@devsbucket/db/jobs";
import { deleteForever, listExpiredTrash } from "@devsbucket/db/trash";
import { TRASH_DAYS } from "@devsbucket/shared/limits";
import { deleteStoredFiles, isComplete } from "@devsbucket/storage/cleanup";

// Deletes forever what has been in the trash for 30 days (decision 0007),
// for every user. Runs daily. What storage can't delete now goes to `send`
// (the retry queue).
export const emptyOldTrash = async (send: (cleanup: StorageCleanup) => Promise<void>) => {
  let deleted = 0;
  for (;;) {
    const expired = await listExpiredTrash({ days: TRASH_DAYS, limit: 100 });
    // deleteForever works per owner (it locks the owner's row).
    const byOwner = new Map<string, string[]>();
    for (const item of expired) {
      byOwner.set(item.ownerId, [...(byOwner.get(item.ownerId) ?? []), item.id]);
    }
    for (const [ownerId, ids] of byOwner) {
      // Logged with no actor: nobody did it, 30 days did.
      const result = await deleteForever({ ids, ownerId, actorId: null });
      const failed = await deleteStoredFiles(result);
      if (!isComplete(failed)) {
        await send(failed);
      }
      deleted += result.deleted;
    }
    if (expired.length < 100) {
      return deleted;
    }
  }
};
