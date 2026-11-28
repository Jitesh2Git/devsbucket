"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FolderInput, Trash2, UserPlus } from "lucide-react";
import { type ReactNode, useLayoutEffect, useState } from "react";
import type { ItemActions } from "@/components/drive/item-menu";
import MoveDialog, { type Crumb } from "@/components/drive/move-dialog";
import type { ItemRef } from "@/components/drive/rename-dialog";
import SelectionPill, { PillButton } from "@/components/drive/selection-pill";
import ShareSelectionDialog from "@/components/drive/share-selection-dialog";
import { itemsQueryKey } from "@/lib/query-keys";
import { useSelection } from "@/lib/selection";
import { trashSelection } from "@/lib/trash-selection";
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
  const [sharing, setSharing] = useState<ItemRef[] | null>(null);
  // Leaving the page only hides it (Activity): close the dialogs.
  useLayoutEffect(
    () => () => {
      setMoving(null);
      setSharing(null);
    },
    [],
  );
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);

  const moveToTrash = () => {
    const chosen = selectedItems;
    clear();
    return trashSelection(chosen, refresh);
  };

  const selecting = selectedItems.length > 0;

  // The bar and the buttons share one grid cell: the buttons only turn
  // invisible, so the row keeps its height and the list doesn't jump when
  // a click selects (the second click of a double-click would miss).
  return (
    <div className="grid">
      <div
        className={cn(
          "transition-[opacity,visibility] duration-150 [grid-area:1/1] motion-reduce:transition-none",
          selecting && "invisible opacity-0",
        )}
      >
        {children}
      </div>
      <SelectionPill
        open={selecting}
        count={selectedItems.length}
        onClear={clear}
        className="md:self-center md:justify-self-end md:[grid-area:1/1]"
      >
        {actions.share && (
          <PillButton icon={<UserPlus />} label="Share" onClick={() => setSharing(selectedItems)} />
        )}
        {canDownload && (
          <PillButton
            icon={<Download />}
            label="Download"
            onClick={() => downloadSelection(selectedItems)}
          />
        )}
        {actions.move && (
          <PillButton
            icon={<FolderInput />}
            label="Move"
            onClick={() => setMoving(selectedItems)}
          />
        )}
        {actions.trash && (
          <PillButton icon={<Trash2 />} label="Move to trash" destructive onClick={moveToTrash} />
        )}
      </SelectionPill>

      <ShareSelectionDialog items={sharing} onClose={() => setSharing(null)} />
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
