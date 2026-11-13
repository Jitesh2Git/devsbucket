"use client";

import type { TrashedItem } from "@devsbucket/db/trash";
import { formatBytes } from "@devsbucket/shared/bytes";
import { useQueryClient } from "@tanstack/react-query";
import { File, Folder, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { deleteForever, emptyTrash, restoreItem } from "@/app/drive/trash-actions";
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

export type TrashRow = TrashedItem & { daysLeft: number };

// What the confirm dialog is about: one item, or the whole trash.
type Confirming = { item: TrashRow } | "all" | null;

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
  useLayoutEffect(() => () => setConfirming(null), []);

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

  const confirmDelete = async () => {
    if (!confirming) return;
    setBusy(true);
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Items in the trash are deleted forever after 30 days.
        </p>
        <Button variant="destructive" onClick={() => setConfirming("all")} disabled={busy}>
          Empty trash
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
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
            <TableRow key={item.id}>
              <TableCell className="max-w-0">
                <span className="flex items-center gap-2">
                  {item.type === "folder" ? (
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <File className="size-4 shrink-0 text-muted-foreground" />
                  )}
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
                <div className="flex justify-end gap-1">
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "all"
                ? "Empty the trash?"
                : `Delete "${confirming?.item.name}" forever?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "all"
                ? "Everything in the trash is deleted forever. This can't be undone."
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
