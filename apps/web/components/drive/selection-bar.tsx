"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FolderInput, Trash2, X } from "lucide-react";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { restoreItems, trashItems } from "@/app/drive/trash-actions";
import type { ItemActions } from "@/components/drive/item-menu";
import MoveDialog, { type Crumb } from "@/components/drive/move-dialog";
import type { ItemRef } from "@/components/drive/rename-dialog";
import { Button } from "@/components/ui/button";
import { itemsQueryKey } from "@/lib/query-keys";
import { restoreMessage } from "@/lib/restore-message";
import { useSelection } from "@/lib/selection";
import { cn } from "@/lib/utils";
import { downloadSelection } from "@/lib/zip-download";

type SelectionBarProps = {
  parentId: string | null;
  // What the user's role allows here (the folder's role, as on each row).
  actions: ItemActions;
  // Download (anyone with a role here, decision 0012).
  canDownload: boolean;
  moveRoot: Crumb | null;
  // Shown while nothing is selected: the folder's own buttons.
  children: ReactNode;
};

const count = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

// While items are selected, the folder's buttons make way for what can be
// done to all of them (Google Drive style). Every item is checked again on
// the server.
const SelectionBar = ({
  parentId,
  actions,
  canDownload,
  moveRoot,
  children,
}: SelectionBarProps) => {
  const { selectedItems, clear } = useSelection<ItemRef & { type: "folder" | "file" }>();
  const [moving, setMoving] = useState<ItemRef[] | null>(null);
  // Leaving the page only hides it (Activity): close the dialog.
  useLayoutEffect(() => () => setMoving(null), []);
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);

  // No confirm: trash is undoable, from the toast or from the Trash page.
  const moveToTrash = async () => {
    const chosen = selectedItems;
    clear();
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
        : `${count(done.length)} moved to trash`,
      {
        description: failed > 0 ? `${count(failed)} couldn't be: ${firstError}` : undefined,
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
              toast.success(`Restored ${count(restored.done.length)}`);
            } else {
              toast.error(restored.firstError ?? "Nothing was restored.");
            }
          },
        },
      },
    );
  };

  const selecting = selectedItems.length > 0;

  // The bar and the buttons share one grid cell: the buttons only turn
  // invisible, so the row keeps its height and the list doesn't jump when
  // a click selects (the second click of a double-click would miss).
  return (
    <div className="grid">
      <div className={cn("[grid-area:1/1]", selecting && "invisible")}>{children}</div>
      {selecting && (
        // A pill in the accent colour, like the selected rows, so it reads
        // as "this is about what you picked". Pops in, unless reduce motion.
        <div
          role="toolbar"
          aria-label="Selection"
          className="flex items-center gap-1 self-center justify-self-end rounded-full border border-primary/30 bg-primary/10 p-1 shadow-sm [grid-area:1/1] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full hover:bg-primary/15"
            aria-label="Clear selection"
            onClick={clear}
          >
            <X />
          </Button>
          <span className="pr-1 text-sm font-medium whitespace-nowrap text-primary-text">
            {selectedItems.length} selected
          </span>
          {(canDownload || actions.move || actions.trash) && (
            <span aria-hidden className="mx-1 h-5 w-px bg-primary/30" />
          )}
          {canDownload && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-primary/15"
              onClick={() => downloadSelection(selectedItems)}
            >
              <Download />
              <span className="sr-only md:not-sr-only">Download</span>
            </Button>
          )}
          {actions.move && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-primary/15"
              onClick={() => setMoving(selectedItems)}
            >
              <FolderInput />
              <span className="sr-only md:not-sr-only">Move</span>
            </Button>
          )}
          {actions.trash && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={moveToTrash}
            >
              <Trash2 />
              <span className="sr-only md:not-sr-only">Move to trash</span>
            </Button>
          )}
        </div>
      )}
      <MoveDialog
        items={moving}
        parentId={parentId}
        root={moveRoot}
        onClose={() => setMoving(null)}
      />
    </div>
  );
};

export default SelectionBar;
