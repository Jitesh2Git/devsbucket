"use client";

import type { ListItemsPage } from "@devsbucket/db/items";
import { formatBytes } from "@devsbucket/shared/bytes";
import type { Cursor } from "@devsbucket/shared/item";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { File, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { loadItems } from "@/app/drive/actions";
import { restoreItem, trashItem } from "@/app/drive/trash-actions";
import FilePreview, { type PreviewFile } from "@/components/drive/file-preview";
import ItemMenu, { type ItemActions } from "@/components/drive/item-menu";
import MoveDialog, { type Crumb } from "@/components/drive/move-dialog";
import RenameDialog, { type ItemRef } from "@/components/drive/rename-dialog";
import ShareDialog, { type ShareTarget } from "@/components/drive/share-dialog";
import LocalDate from "@/components/local-date";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { itemsQueryKey } from "@/lib/query-keys";
import { restoreMessage } from "@/lib/restore-message";

type ItemListProps = {
  parentId: string | null;
  // Rendered on the server, so the first 50 rows arrive with the page.
  firstPage: ListItemsPage;
  // What the user's role allows on the rows, and whether they can add here.
  actions: ItemActions;
  canAdd: boolean;
  // In someone else's tree: the top-most folder the Move dialog can reach.
  moveRoot: Crumb | null;
};

const ItemList = ({ parentId, firstPage, actions, canAdd, moveRoot }: ItemListProps) => {
  const query = useInfiniteQuery({
    queryKey: itemsQueryKey(parentId),
    queryFn: async ({ pageParam }) => {
      const result = await loadItems({ parentId, cursor: pageParam });
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result.page;
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: { pages: [firstPage], pageParams: [null] },
  });

  const rows = query.data.pages.flatMap((page) => page.items);

  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);

  // No confirm: trash is undoable, from the toast or from the Trash page.
  const moveToTrash = async (item: ItemRef) => {
    const result = await trashItem({ itemId: item.id });
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    await refresh();
    toast.success(`"${item.name}" moved to trash`, {
      // Long enough to reach for Undo (sonner's default is 4 seconds).
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: async () => {
          const restored = await restoreItem({ itemId: item.id });
          if (restored.error !== null) {
            toast.error(restored.error);
            return;
          }
          await refresh();
          toast.success(restoreMessage(restored));
        },
      },
    });
  };

  const [previewing, setPreviewing] = useState<PreviewFile | null>(null);
  const [renaming, setRenaming] = useState<ItemRef | null>(null);
  const [moving, setMoving] = useState<ItemRef | null>(null);
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  // Leaving the page only hides it (Activity): close any dialog, so a video
  // doesn't keep playing out of sight and nothing is open on return.
  useLayoutEffect(
    () => () => {
      setPreviewing(null);
      setRenaming(null);
      setMoving(null);
      setSharing(null);
    },
    [],
  );

  if (rows.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>{parentId ? "This folder is empty" : "Your drive is empty"}</EmptyTitle>
          <EmptyDescription>
            {canAdd ? "Create a folder or upload files to get started." : "Nothing here yet."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28 text-right">Size</TableHead>
            <TableHead className="w-36">Modified</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-0">
                {item.type === "folder" ? (
                  <Link
                    href={`/drive/folders/${item.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewing(item)}
                    className="flex w-full items-center gap-2 text-left hover:underline"
                  >
                    <File className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.name}</span>
                  </button>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {item.size === null ? "—" : formatBytes(item.size)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <LocalDate value={item.updatedAt} />
              </TableCell>
              <TableCell>
                <ItemMenu
                  item={item}
                  actions={actions}
                  onPreview={() => setPreviewing(item)}
                  onRename={() => setRenaming(item)}
                  onMove={() => setMoving(item)}
                  onShare={() => setSharing(item)}
                  onTrash={() => moveToTrash(item)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {query.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage && <Spinner />}
          Load more
        </Button>
      )}
      {query.isFetchNextPageError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't load more. Try again.
        </p>
      )}
      <FilePreview file={previewing} onClose={() => setPreviewing(null)} />
      <RenameDialog item={renaming} parentId={parentId} onClose={() => setRenaming(null)} />
      <MoveDialog
        item={moving}
        parentId={parentId}
        root={moveRoot}
        onClose={() => setMoving(null)}
      />
      <ShareDialog item={sharing} onClose={() => setSharing(null)} />
    </div>
  );
};

export default ItemList;
