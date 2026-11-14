"use client";

import type { SharedItem } from "@devsbucket/db/shared-with-me";
import { roleLabel } from "@devsbucket/shared/sharing";
import { Download, File, Folder, LogOut, MoreHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { leaveSharedItem } from "@/app/drive/shared-actions";
import FilePreview, { downloadUrl, type PreviewFile } from "@/components/drive/file-preview";
import LocalDate from "@/components/local-date";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type SharedListProps = {
  items: SharedItem[];
  // A file opened from a share link: its preview starts open.
  opened: PreviewFile | null;
};

// The Shared with me page: the top-most items shared with you. Folders open
// in the drive (breadcrumbs start here); files open in the preview.
const SharedList = ({ items, opened }: SharedListProps) => {
  const router = useRouter();
  const [previewing, setPreviewing] = useState<PreviewFile | null>(opened);
  useLayoutEffect(() => () => setPreviewing(null), []);

  const leave = async (item: SharedItem) => {
    const result = await leaveSharedItem({ itemId: item.id });
    if (result.error !== null) {
      toast.error(result.error);
    } else {
      toast.success(`Removed "${item.name}" from Shared with me`);
    }
    router.refresh();
  };

  const preview = <FilePreview file={previewing} onClose={() => setPreviewing(null)} />;

  if (items.length === 0) {
    return (
      <>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Nothing shared with you yet</EmptyTitle>
            <EmptyDescription>
              Files and folders other people share with you show up here.
            </EmptyDescription>
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
            <TableHead className="w-24">Your role</TableHead>
            <TableHead className="w-36">Shared</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
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
              <TableCell className="max-w-0 truncate text-muted-foreground">
                {item.ownerName}
              </TableCell>
              <TableCell className="text-muted-foreground">{roleLabel(item.role)}</TableCell>
              <TableCell className="text-muted-foreground">
                <LocalDate value={item.sharedAt} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${item.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.type === "file" && (
                      <>
                        <DropdownMenuItem asChild>
                          <a href={downloadUrl(item.id)}>
                            <Download />
                            Download
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onSelect={() => leave(item)}>
                      <LogOut />
                      Remove from Shared with me
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {preview}
    </>
  );
};

export default SharedList;
