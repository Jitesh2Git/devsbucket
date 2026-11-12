import type { StorageCleanup } from "@devsbucket/db/jobs";
import { deleteStoredFiles, isComplete } from "@devsbucket/storage/cleanup";

// Retries storage deletes that failed after their rows were gone. Throwing
// makes pg-boss run the job again later (the queue's backoff); deleting
// what's already gone is harmless, so the whole job is simply repeated.
export const deleteStorageObjects = async (cleanup: StorageCleanup) => {
  const failed = await deleteStoredFiles(cleanup);
  if (!isComplete(failed)) {
    throw new Error(
      `Storage still has ${failed.storageKeys.length} objects and ${failed.uploads.length} uploads to delete`,
    );
  }
};
