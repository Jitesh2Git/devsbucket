"use client";

import type { ListItemsPage } from "@devsbucket/db/items";
import { formatBytes } from "@devsbucket/shared/bytes";
import type { Cursor } from "@devsbucket/shared/item";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadItems } from "@/app/drive/actions";
import { restoreItem, trashItem } from "@/app/drive/trash-actions";
import ActivityDialog, { type ActivityTarget } from "@/components/drive/activity-dialog";
import FilePreview, { type PreviewFile } from "@/components/drive/file-preview";
import { ItemCard, ItemGrid } from "@/components/drive/item-grid";
import ItemMenu, { type ItemActions } from "@/components/drive/item-menu";
import ItemName from "@/components/drive/item-name";
import MoveDialog, { type Crumb } from "@/components/drive/move-dialog";
import RenameDialog, { type ItemRef } from "@/components/drive/rename-dialog";
import ShareDialog, { type ShareTarget } from "@/components/drive/share-dialog";
import LocalDate from "@/components/local-date";
import { useFolderEvents } from "@/components/realtime-provider";
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
import { useViewMode } from "@/lib/view-mode";

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
  const view = useViewMode();

  // Infinite scroll: an empty element after the last row; when it scrolls
  // into view, the next 50 load. Watched again after each page, so a tall
  // window keeps loading until the list fills it. Not after a failed page:
  // "Try again" retries by hand, rather than in a loop.
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  const endOfList = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const end = endOfList.current;
    if (!end || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
    ]);

  // Someone (maybe you, in another tab) changed this folder: refetch it.
  useFolderEvents(parentId, refresh);

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
  const [viewingActivity, setViewingActivity] = useState<ActivityTarget | null>(null);
  // Leaving the page only hides it (Activity): close any dialog, so a video
  // doesn't keep playing out of sight and nothing is open on return.
  useLayoutEffect(
    () => () => {
      setPreviewing(null);
      setRenaming(null);
      setMoving(null);
      setSharing(null);
      setViewingActivity(null);
    },
    [],
  );

  // The same ⋯ menu in both views.
  const menu = (item: (typeof rows)[number]) => (
    <ItemMenu
      item={item}
      actions={actions}
      onPreview={() => setPreviewing(item)}
      onRename={() => setRenaming(item)}
      onMove={() => setMoving(item)}
      onShare={() => setSharing(item)}
      onActivity={() => setViewingActivity(item)}
      onTrash={() => moveToTrash(item)}
    />
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
      {view === "grid" ? (
        <div className="w-full">
          <ItemGrid label="Files and folders">
            {rows.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                name={<ItemName item={item} card onPreview={() => setPreviewing(item)} />}
                details={
                  <>
                    {item.size === null ? "—" : formatBytes(item.size)} ·{" "}
                    <LocalDate value={item.updatedAt} />
                  </>
                }
                menu={menu(item)}
              />
            ))}
          </ItemGrid>
        </div>
      ) : (
        <Table
          // On a phone the table keeps room for the names (480 px) and
          // scrolls sideways in its own box; from md up it fits the column.
          className="min-w-120 md:min-w-0"
        >
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
                  <ItemName item={item} onPreview={() => setPreviewing(item)} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.size === null ? "—" : formatBytes(item.size)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <LocalDate value={item.updatedAt} />
                </TableCell>
                <TableCell>{menu(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {hasNextPage && !isFetchNextPageError && (
        <div ref={endOfList} className="flex h-10 w-full items-center justify-center">
          {isFetchingNextPage && <Spinner aria-label="Loading more" />}
        </div>
      )}
      {isFetchNextPageError && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          Couldn't load more.
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            Try again
          </Button>
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
      <ActivityDialog item={viewingActivity} onClose={() => setViewingActivity(null)} />
    </div>
  );
};

export default ItemList;
