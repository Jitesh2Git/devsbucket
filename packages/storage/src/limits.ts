import { getAppStorageUsed, getOpsThisMonth } from "@devsbucket/db/usage";
import { opsLevel, uploadLimitError } from "@devsbucket/shared/limits";

// The app-wide guards before an upload (file size, 9 GB, monthly
// operations): the message to show, or null to go ahead.
export const checkUploadLimits = async (size: number) => {
  const [appStorageUsed, ops] = await Promise.all([getAppStorageUsed(), getOpsThisMonth()]);
  if (opsLevel(ops) === "warn") {
    // Phase 3 turns this into an admin notification.
    console.warn(
      `Storage operations this month are above 70% of the free tier: ${ops.classA} class A, ${ops.classB} class B`,
    );
  }
  return uploadLimitError({ size, appStorageUsed, ops });
};
