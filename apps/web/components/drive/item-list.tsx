"use client";

import type { ListItemsPage } from "@devsbucket/db/items";
import { formatBytes } from "@devsbucket/shared/bytes";
import type { Cursor } from "@devsbucket/shared/item";
import { useInfiniteQuery } from "@tanstack/react-query";
import { File, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";
import { loadItems } from "@/app/drive/actions";
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

type ItemListProps = {
  parentId: string | null;
  // Rendered on the server, so the first 50 rows arrive with the page.
  firstPage: ListItemsPage;
};

const ItemList = ({ parentId, firstPage }: ItemListProps) => {
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

  if (rows.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>{parentId ? "This folder is empty" : "Your drive is empty"}</EmptyTitle>
          <EmptyDescription>Create a folder or upload files to get started.</EmptyDescription>
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
                  <span className="flex items-center gap-2">
                    <File className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.name}</span>
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {item.size === null ? "—" : formatBytes(item.size)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <LocalDate value={item.updatedAt} />
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
    </div>
  );
};

export default ItemList;
