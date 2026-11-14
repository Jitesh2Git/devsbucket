import { getAppStorageUsed, getOpsThisMonth } from "@devsbucket/db/usage";
import { uploadLimitError } from "@devsbucket/shared/limits";

// The app-wide guards before an upload (file size, 9 GB, monthly
// operations): the message to show, or null to go ahead. Admins hear about
// 70% and 90% of the operations from the worker's check-alerts job.
export const checkUploadLimits = async (size: number) => {
  const [appStorageUsed, ops] = await Promise.all([getAppStorageUsed(), getOpsThisMonth()]);
  return uploadLimitError({ size, appStorageUsed, ops });
};
