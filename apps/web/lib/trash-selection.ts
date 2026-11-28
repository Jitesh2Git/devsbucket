"use client";

import { toast } from "sonner";
import { restoreItems, trashItems } from "@/app/drive/trash-actions";
import { restoreMessage } from "@/lib/restore-message";

export const countItems = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

// Move to trash from a selection bar (multi-select): no confirm, since it's
// undoable, from the toast (one Undo for all of them) or from the Trash
// page. `refresh` reloads whatever list the items were in.
export const trashSelection = async (
  chosen: { id: string; name: string }[],
  refresh: () => Promise<unknown>,
) => {
  const result = await trashItems({ itemIds: chosen.map((item) => item.id) });
  if (result.error !== null) {
    toast.error(result.error);
    return;
  }
  await refresh();
  const { done, failed, firstError } = result;
  if (done.length === 0) {
    toast.error(firstError ?? "Nothing was moved to trash.");
    return;
  }
  const first = done[0];
  toast.success(
    done.length === 1 && first
      ? `"${first.name}" moved to trash`
      : `${countItems(done.length)} moved to trash`,
    {
      description: failed > 0 ? `${countItems(failed)} couldn't be: ${firstError}` : undefined,
      // Long enough to reach for Undo (sonner's default is 4 seconds).
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: async () => {
          const restored = await restoreItems({ itemIds: done.map((item) => item.id) });
          if (restored.error !== null) {
            toast.error(restored.error);
            return;
          }
          await refresh();
          const back = restored.done[0];
          if (restored.done.length === 1 && back) {
            toast.success(restoreMessage(back));
          } else if (restored.done.length > 0) {
            toast.success(`Restored ${countItems(restored.done.length)}`);
          } else {
            toast.error(restored.firstError ?? "Nothing was restored.");
          }
        },
      },
    },
  );
};
