"use client";

import type { RecentItem } from "@devsbucket/db/recent";
import { formatBytes } from "@devsbucket/shared/bytes";
import { Clock } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import FilePreview, { type PreviewFile } from "@/components/drive/file-preview";
import { ItemCard, ItemGrid } from "@/components/drive/item-grid";
import ItemName from "@/components/drive/item-name";
import LocalDate from "@/components/local-date";
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
import { useViewMode } from "@/lib/view-mode";

type RecentListProps = {
  items: RecentItem[];
  userId: string;
};

// The Recent page (decision 0017): files you opened, newest first. Text
// files open in the editor, others in the preview, like everywhere else.
const RecentList = ({ items, userId }: RecentListProps) => {
  const [previewing, setPreviewing] = useState<PreviewFile | null>(null);
  const view = useViewMode();
  // Next hides this page when you leave it (React Activity): close the
  // preview then, so it isn't open when you come back.
  useLayoutEffect(() => () => setPreviewing(null), []);

  const preview = <FilePreview file={previewing} onClose={() => setPreviewing(null)} />;

  if (items.length === 0) {
    return (
      <>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Clock />
            </EmptyMedia>
            <EmptyTitle>Nothing opened yet</EmptyTitle>
            <EmptyDescription>Files you open show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        {preview}
      </>
    );
  }

  return (
    <>
      {view === "grid" ? (
        <ItemGrid label="Recent files">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              name={<ItemName item={item} card onPreview={() => setPreviewing(item)} />}
              details={
                <>
                  {item.size === null ? "—" : formatBytes(item.size)} ·{" "}
                  <LocalDate value={item.openedAt} />
                </>
              }
            />
          ))}
        </ItemGrid>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Owner</TableHead>
              <TableHead className="w-28 text-right">Size</TableHead>
              <TableHead className="w-36">Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-0">
                  <ItemName item={item} onPreview={() => setPreviewing(item)} />
                </TableCell>
                <TableCell className="max-w-0 truncate text-muted-foreground">
                  {item.ownerId === userId ? "me" : item.ownerName}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.size === null ? "—" : formatBytes(item.size)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <LocalDate value={item.openedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {preview}
    </>
  );
};

export default RecentList;
