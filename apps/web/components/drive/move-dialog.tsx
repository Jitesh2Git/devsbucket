"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Folder } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { listFolders, moveItem } from "@/app/drive/item-actions";
import type { ItemRef } from "@/components/drive/rename-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { foldersQueryKey, itemsQueryKey } from "@/lib/query-keys";

type Crumb = { id: string; name: string };

type MovePickerProps = { item: ItemRef; fromParentId: string | null; onDone: () => void };

// Browse from the top of My Drive into folders, then "Move here".
const MovePicker = ({ item, fromParentId, onDone }: MovePickerProps) => {
  const queryClient = useQueryClient();
  // Where the picker is: [] = the top of My Drive, then each folder opened.
  const [path, setPath] = useState<Crumb[]>([]);
  const here = path.at(-1) ?? null;
  const hereId = here?.id ?? null;
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const folders = useQuery({
    queryKey: foldersQueryKey(hereId),
    queryFn: async () => {
      const result = await listFolders({ parentId: hereId });
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result.folders;
    },
  });

  const go = (to: Crumb[]) => {
    setPath(to);
    setError(null);
  };

  const move = async () => {
    setMoving(true);
    const result = await moveItem({ itemId: item.id, parentId: hereId });
    setMoving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    onDone();
    toast.success(`Moved to ${here?.name ?? "My Drive"}`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(fromParentId) }),
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(hereId) }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader className="min-w-0">
        <DialogTitle className="truncate">Move "{item.name}"</DialogTitle>
        <DialogDescription>Choose a folder, then Move here.</DialogDescription>
      </DialogHeader>
      <nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        <Button variant="ghost" size="sm" onClick={() => go([])} disabled={path.length === 0}>
          My Drive
        </Button>
        {path.map((crumb, index) => (
          <Fragment key={crumb.id}>
            <ChevronRight className="size-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className="max-w-40"
              onClick={() => go(path.slice(0, index + 1))}
              disabled={index === path.length - 1}
            >
              <span className="truncate">{crumb.name}</span>
            </Button>
          </Fragment>
        ))}
      </nav>
      <div className="h-64 overflow-y-auto rounded-md border">
        {folders.isPending ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : folders.isError ? (
          <p className="p-4 text-muted-foreground">{folders.error.message}</p>
        ) : folders.data.length === 0 ? (
          <p className="p-4 text-muted-foreground">No folders here.</p>
        ) : (
          <ul aria-label="Folders">
            {folders.data.map((folder) => {
              // A folder can't be opened as its own destination.
              const isItself = folder.id === item.id;
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => go([...path, folder])}
                    disabled={isItself}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{folder.name}</span>
                    {isItself && <span className="ml-auto text-xs">(this folder)</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button onClick={move} disabled={moving || hereId === fromParentId}>
          {moving && <Spinner />}
          Move here
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const MoveDialog = ({
  item,
  parentId,
  onClose,
}: {
  item: ItemRef | null;
  parentId: string | null;
  onClose: () => void;
}) => {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && <MovePicker key={item.id} item={item} fromParentId={parentId} onDone={onClose} />}
    </Dialog>
  );
};

export default MoveDialog;
