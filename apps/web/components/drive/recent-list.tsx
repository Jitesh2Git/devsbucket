"use client";

import type { RecentItem } from "@devsbucket/db/recent";
import { Clock } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import FilePreview, { type PreviewFile } from "@/components/drive/file-preview";
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

type RecentListProps = {
  items: RecentItem[];
  userId: string;
};

// The Recent page (decision 0017): files you opened, newest first. Text
// files open in the editor, others in the preview, like everywhere else.
const RecentList = ({ items, userId }: RecentListProps) => {
  const [previewing, setPreviewing] = useState<PreviewFile | null>(null);
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-40">Owner</TableHead>
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
              <TableCell className="text-muted-foreground">
                <LocalDate value={item.openedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {preview}
    </>
  );
};

export default RecentList;
