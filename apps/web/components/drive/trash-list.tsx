"use client";

import type { TrashedItem } from "@devsbucket/db/trash";
import { formatBytes } from "@devsbucket/shared/bytes";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteForever,
  deleteItemsForever,
  emptyTrash,
  restoreItem,
  restoreItems,
} from "@/app/drive/trash-actions";
import { ItemCard, ItemGrid } from "@/components/drive/item-grid";
import ItemIcon from "@/components/drive/item-icon";
import SelectableArea from "@/components/drive/selectable-area";
import SelectionPill, { PillButton } from "@/components/drive/selection-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { restoreMessage } from "@/lib/restore-message";
import { SCROLL_LIST } from "@/lib/scroll-list";
import { SelectionPortal, useSelectableRows, useSelection } from "@/lib/selection";
import { countItems } from "@/lib/trash-selection";
import { useViewMode } from "@/lib/view-mode";

export type TrashRow = TrashedItem & { daysLeft: number };

// What the confirm dialog is about: one item, the selected ones, or the
// whole trash.
type Confirming = { item: TrashRow } | { items: TrashRow[] } | "all" | null;

// The Trash page's list: restore, or delete forever (with a confirm, since
// it can't be undone). Rows from other people's trees (what an Editor
// trashed there) can only be restored: only the Owner deletes forever. The
// rows come from the server; after a change the page is refreshed, and the
// drive's cached folder lists too.
const TrashList = ({ items, userId }: { items: TrashRow[]; userId: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const view = useViewMode();
  useLayoutEffect(() => () => setConfirming(null), []);

  // Multi-select: a click selects, Restore and Delete forever in the bar.
  // Trashed items don't open, so a double-click does nothing.
  const { setRows, selectedItems, clear } = useSelection<TrashRow>();
  useEffect(() => setRows(items), [setRows, items]);
  const { rowProps, listProps, box } = useSelectableRows();
  const noOpen = () => {};
  // Delete forever is the Owner's (decisions 0007, 0008), so the bar only
  // offers it when every selected item is the user's own.
  const canDeleteSelected =
    selectedItems.length > 0 && selectedItems.every((item) => item.ownerId === userId);

  const refresh = async () => {
    router.refresh();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);
  };

  const restore = async (item: TrashRow) => {
    setBusy(true);
    const result = await restoreItem({ itemId: item.id });
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(restoreMessage(result));
    await refresh();
  };

  const restoreSelected = async () => {
    const chosen = selectedItems;
    clear();
    setBusy(true);
    const result = await restoreItems({ itemIds: chosen.map((item) => item.id) });
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    const [only] = result.done;
    if (result.done.length === 1 && only) {
      toast.success(restoreMessage(only));
    } else if (result.done.length > 0) {
      toast.success(`Restored ${countItems(result.done.length)}`, {
        description:
          result.failed > 0
            ? `${countItems(result.failed)} couldn't be: ${result.firstError}`
            : undefined,
      });
    } else {
      toast.error(result.firstError ?? "Nothing was restored.");
    }
    await refresh();
  };

  const confirmDelete = async () => {
    if (!confirming) return;
    setBusy(true);
    if (confirming !== "all" && "items" in confirming) {
      const result = await deleteItemsForever({ itemIds: confirming.items.map((item) => item.id) });
      setBusy(false);
      setConfirming(null);
      clear();
      if (result.error !== null) {
        toast.error(result.error);
      } else if (result.done.length === 0) {
        toast.error(result.firstError ?? "Nothing was deleted.");
      } else {
        toast.success(`${countItems(result.done.length)} deleted forever`, {
          description:
            result.failed > 0
              ? `${countItems(result.failed)} couldn't be: ${result.firstError}`
              : undefined,
        });
      }
      await refresh();
      return;
    }
    const result =
      confirming === "all"
        ? await emptyTrash()
        : await deleteForever({ itemId: confirming.item.id });
    setBusy(false);
    setConfirming(null);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(
      confirming === "all" ? "Trash emptied" : `"${confirming.item.name}" deleted forever`,
    );
    await refresh();
  };

  // Restore, and Delete forever for the owner, the same in both views.
  const buttons = (item: TrashRow) => (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => restore(item)}
        disabled={busy}
        aria-label={`Restore ${item.name}`}
      >
        <RotateCcw />
        Restore
      </Button>
      {item.ownerId === userId && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setConfirming({ item })}
          disabled={busy}
          aria-label={`Delete ${item.name} forever`}
        >
          Delete forever
        </Button>
      )}
    </>
  );

  if (items.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trash2 />
          </EmptyMedia>
          <EmptyTitle>Trash is empty</EmptyTitle>
          <EmptyDescription>Items in the trash are deleted forever after 30 days.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Items in the trash are deleted forever after 30 days.
        </p>
        <Button variant="destructive" onClick={() => setConfirming("all")} disabled={busy}>
          Empty trash
        </Button>
      </div>
      {selectedItems.length > 0 && (
        <SelectionPortal>
          <SelectionPill count={selectedItems.length} onClear={clear}>
            <PillButton
              icon={<RotateCcw />}
              label="Restore"
              onClick={restoreSelected}
              disabled={busy}
            />
            {canDeleteSelected && (
              <PillButton
                icon={<Trash2 />}
                label="Delete forever"
                destructive
                onClick={() => setConfirming({ items: selectedItems })}
                disabled={busy}
              />
            )}
          </SelectionPill>
        </SelectionPortal>
      )}
      <div className={SCROLL_LIST}>
        <SelectableArea listProps={listProps} box={box} count={selectedItems.length}>
          {view === "grid" ? (
            <ItemGrid label="Trash">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  name={<span className="truncate font-medium">{item.name}</span>}
                  details={
                    <>
                      {item.size === null ? "—" : formatBytes(item.size)} ·{" "}
                      {item.daysLeft === 1 ? "1 day left" : `${item.daysLeft} days left`}
                    </>
                  }
                  footer={buttons(item)}
                  selectable={rowProps(item, noOpen)}
                />
              ))}
            </ItemGrid>
          ) : (
            <Table
              // On a phone the table keeps room for the names (900 px) and
              // scrolls sideways in its own box; from md up it fits the column.
              className="min-w-225 md:min-w-0"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Name</TableHead>
                  <TableHead className="w-40">Was in</TableHead>
                  <TableHead className="w-32">Trashed by</TableHead>
                  <TableHead className="w-24 text-right">Size</TableHead>
                  <TableHead className="w-28">Days left</TableHead>
                  <TableHead className="w-56">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    {...rowProps(item, noOpen)}
                    className="data-selected:bg-primary/10 data-selected:hover:bg-primary/15"
                  >
                    <TableCell className="max-w-0">
                      <span className="flex items-center gap-2">
                        <ItemIcon item={item} className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{item.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-0 truncate text-muted-foreground">
                      {item.parentName ?? (item.ownerId === userId ? "My Drive" : "—")}
                    </TableCell>
                    <TableCell className="max-w-0 truncate text-muted-foreground">
                      {item.trashedBy === userId ? "You" : (item.trashedByName ?? "—")}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.size === null ? "—" : formatBytes(item.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.daysLeft === 1 ? "1 day" : `${item.daysLeft} days`}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">{buttons(item)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SelectableArea>
      </div>
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "all"
                ? "Empty the trash?"
                : confirming && "items" in confirming
                  ? `Delete ${countItems(confirming.items.length)} forever?`
                  : `Delete "${confirming?.item.name}" forever?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "all"
                ? "Everything in the trash is deleted forever. This can't be undone."
                : confirming && "items" in confirming
                  ? "They're deleted forever, with everything inside them. This can't be undone."
                  : "It's deleted forever, with everything inside it. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                // Keep the dialog open until the server answers.
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashList;
