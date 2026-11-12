import { listAbandonedUploads } from "@devsbucket/db/items";
import { discardUpload } from "@devsbucket/storage/cleanup";

// An upload's URLs last 10 minutes, so after an hour it can't finish.
export const ABANDONED_AFTER_MINUTES = 60;

// Uploads that were started but never completed or cancelled (a closed tab,
// a crash): free their quota and storage. Runs every 15 minutes.
export const cleanupPendingUploads = async () => {
  let cleaned = 0;
  // In batches, so one run can't hold thousands of rows in memory.
  for (;;) {
    const uploads = await listAbandonedUploads({
      olderThanMinutes: ABANDONED_AFTER_MINUTES,
      limit: 100,
    });
    for (const upload of uploads) {
      await discardUpload(upload);
    }
    cleaned += uploads.length;
    if (uploads.length < 100) {
      return cleaned;
    }
  }
};
