"use client";

import type { SharedItem } from "@devsbucket/db/shared-with-me";
import type { TransferOffer } from "@devsbucket/db/transfers";
import { formatBytes } from "@devsbucket/shared/bytes";
import { roleLabel } from "@devsbucket/shared/sharing";
import { Download, FolderDown, LogOut, MoreHorizontal, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { leaveSharedItem } from "@/app/drive/shared-actions";
import CopyMenuItem from "@/components/drive/copy-menu-item";
import FilePreview, { downloadUrl, type PreviewFile } from "@/components/drive/file-preview";
import { ItemCard, ItemGrid } from "@/components/drive/item-grid";
import ItemName from "@/components/drive/item-name";
import MuteMenuItem from "@/components/drive/mute-menu-item";
import OwnershipOfferActions from "@/components/drive/ownership-offer-actions";
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
import { useViewMode } from "@/lib/view-mode";
import { downloadFolderZip } from "@/lib/zip-download";

type SharedListProps = {
  items: SharedItem[];
  // Ownership offered to you, waiting for your answer.
  offers: TransferOffer[];
  // A file opened from a share link: its preview starts open.
  opened: PreviewFile | null;
};

// A shared item's ⋯ menu, the same in both views.
const SharedItemMenu = ({ item, onLeave }: { item: SharedItem; onLeave: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${item.name}`}>
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-max">
      {item.type === "file" && (
        <>
          <DropdownMenuItem asChild>
            <a href={downloadUrl(item.id)}>
              <Download />
              Download
            </a>
          </DropdownMenuItem>
          <CopyMenuItem item={item} />
          <DropdownMenuSeparator />
        </>
      )}
      {item.type === "folder" && (
        <>
          <DropdownMenuItem onSelect={() => downloadFolderZip(item)}>
            <FolderDown />
            Download as ZIP
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <MuteMenuItem item={item} />
      <DropdownMenuItem onSelect={onLeave}>
        <LogOut />
        Remove from Shared with me
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// The Shared with me page: the top-most items shared with you. Folders open
// in the drive (breadcrumbs start here); files open in the preview.
const SharedList = ({ items, offers, opened }: SharedListProps) => {
  const router = useRouter();
  const [previewing, setPreviewing] = useState<PreviewFile | null>(opened);
  const view = useViewMode();
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

  const offerList = offers.length > 0 && (
    <section className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Ownership offers</h2>
      <ul aria-label="Ownership offers" className="flex flex-col divide-y">
        {offers.map((offer) => (
          <li key={offer.id} className="flex items-center justify-between gap-4 py-2">
            <span className="min-w-0 truncate text-sm">
              {offer.fromName} wants to make you the owner of "{offer.name}"
            </span>
            <OwnershipOfferActions offer={offer} />
          </li>
        ))}
      </ul>
    </section>
  );

  if (items.length === 0) {
    return (
      <>
        {offerList}

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
      {offerList}

      {view === "grid" ? (
        <ItemGrid label="Shared with me">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              name={<ItemName item={item} card onPreview={() => setPreviewing(item)} />}
              details={
                <>
                  {item.ownerName} · {item.size === null ? "—" : formatBytes(item.size)}
                </>
              }
              menu={<SharedItemMenu item={item} onLeave={() => leave(item)} />}
            />
          ))}
        </ItemGrid>
      ) : (
        <Table
          // On a phone the table keeps room for the names (760 px) and
          // scrolls sideways in its own box; from md up it fits the column.
          className="min-w-190 md:min-w-0"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Owner</TableHead>
              <TableHead className="w-24">Your role</TableHead>
              <TableHead className="w-28 text-right">Size</TableHead>
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
                  <ItemName item={item} onPreview={() => setPreviewing(item)} />
                </TableCell>
                <TableCell className="max-w-0 truncate text-muted-foreground">
                  {item.ownerName}
                </TableCell>
                <TableCell className="text-muted-foreground">{roleLabel(item.role)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.size === null ? "—" : formatBytes(item.size)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <LocalDate value={item.sharedAt} />
                </TableCell>
                <TableCell>
                  <SharedItemMenu item={item} onLeave={() => leave(item)} />
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

export default SharedList;
