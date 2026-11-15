import { can } from "@devsbucket/authz/can";
import type { Access } from "@devsbucket/shared/access";
import { isEditableName } from "@devsbucket/shared/editing";

// What one connection to a file's live document may do (decision 0013):
// "edit", "read-only", or null to refuse it. Checked when it connects, and
// again when access, the trash or the file's place changes.
export type CollabMode = "edit" | "read-only" | null;

type File = {
  type: "folder" | "file" | "note";
  status: "pending" | "ready";
  trashedAt: Date | null;
  name: string;
  mimeType: string | null;
};

export const collabMode = (
  access: Access | null,
  file: File | null,
  ownerStorageFull: boolean,
): CollabMode => {
  if (!access?.role || !file) {
    return null;
  }
  // Only finished text files outside the trash have a live document.
  if (
    file.type !== "file" ||
    file.status !== "ready" ||
    file.trashedAt !== null ||
    !isEditableName(file.name, file.mimeType)
  ) {
    return null;
  }
  // Viewers see it live but can't change it; nobody can while the owner's
  // drive is full (the quota's hard stop).
  if (!can(access, "edit") || ownerStorageFull) {
    return "read-only";
  }
  return "edit";
};
