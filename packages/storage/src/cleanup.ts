// Cleanup shared by the web app and the worker (apps/worker): the same code
// discards an abandoned upload and deletes trashed files from storage.
import { deletePendingFile } from "@devsbucket/db/items";
import type { StorageCleanup } from "@devsbucket/db/jobs";
import { abortMultipart } from "./multipart.ts";
import { deleteObject, deleteObjects, itemKey } from "./objects.ts";

// Removes every trace of an upload that won't finish: the row (which gives
// the quota back), the parts of a multipart upload, and the object.
export const discardUpload = async (file: { id: string; uploadId: string | null }) => {
  await deletePendingFile(file.id);
  const key = itemKey(file.id);
  if (file.uploadId) {
    await abortMultipart({ key, uploadId: file.uploadId });
  }
  await deleteObject(key);
};

// Deletes files whose rows are already gone. Returns what storage couldn't
// delete (empty when everything went), so the caller can queue a retry.
export const deleteStoredFiles = async ({
  storageKeys,
  uploads,
}: StorageCleanup): Promise<StorageCleanup> => {
  const failedUploads: StorageCleanup["uploads"] = [];
  for (const upload of uploads) {
    try {
      await abortMultipart(upload);
    } catch {
      failedUploads.push(upload);
    }
  }
  let failedKeys: string[];
  try {
    failedKeys = await deleteObjects(storageKeys);
  } catch {
    failedKeys = storageKeys;
  }
  return { storageKeys: failedKeys, uploads: failedUploads };
};

export const isComplete = (cleanup: StorageCleanup) =>
  cleanup.storageKeys.length === 0 && cleanup.uploads.length === 0;
