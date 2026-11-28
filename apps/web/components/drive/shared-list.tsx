"use client";

import type { SharedItem } from "@devsbucket/db/shared-with-me";
import type { TransferOffer } from "@devsbucket/db/transfers";
import { formatBytes } from "@devsbucket/shared/bytes";
import { roleLabel } from "@devsbucket/shared/sharing";
import { Copy, Download, FolderDown, LogOut, MoreHorizontal, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { copyFiles } from "@/app/drive/copy-actions";
import { leaveSharedItem, leaveSharedItems } from "@/app/drive/shared-actions";
import CopyMenuItem from "@/components/drive/copy-menu-item";
import FilePreview, { downloadUrl, type PreviewFile } from "@/components/drive/file-preview";
import { ItemCard, ItemGrid } from "@/components/drive/item-grid";
import ItemName, { itemHref } from "@/components/drive/item-name";
import MuteMenuItem from "@/components/drive/mute-menu-item";
import OwnershipOfferActions from "@/components/drive/ownership-offer-actions";
import SelectableArea from "@/components/drive/selectable-area";
import SelectionPill, { PillButton } from "@/components/drive/selection-pill";
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
import { startNavigation } from "@/lib/navigation-progress";
import { SCROLL_LIST } from "@/lib/scroll-list";
import { SelectionPortal, useSelectableRows, useSelection } from "@/lib/selection";
import { countItems } from "@/lib/trash-selection";
import { useViewMode } from "@/lib/view-mode";
import { downloadFolderZip, downloadSelection } from "@/lib/zip-download";

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

  // Multi-select: a click selects, a double-click opens (a folder in the
  // drive, a text file in the editor, others in the preview).
  const { setRows, selectedItems, clear } = useSelection<SharedItem>();
  useEffect(() => setRows(items), [setRows, items]);
  const { rowProps, listProps, box } = useSelectableRows();
  const open = (item: SharedItem) => {
    const href = itemHref(item);
    if (href) {
      startNavigation();
      router.push(href);
    } else {
      setPreviewing(item);
    }
  };
  const onlyFiles = selectedItems.every((item) => item.type === "file");

  const copySelected = async () => {
    const chosen = selectedItems;
    clear();
    const result = await copyFiles({ itemIds: chosen.map((item) => item.id) });
    if (result.error !== null) {
      toast.error(result.error);
    } else if (result.done.length === 0) {
      toast.error(result.firstError ?? "Nothing was copied.");
    } else {
      // Each copy goes next to its original when you may add files there,
      // otherwise to your My Drive, as with one file.
      toast.success(`Copied ${countItems(result.done.length)}`, {
        description:
          result.failed > 0
            ? `${countItems(result.failed)} couldn't be copied: ${result.firstError}`
            : result.done.some((copy) => !copy.inPlace)
              ? "Copies you can't put next to the original are in your My Drive."
              : undefined,
      });
    }
  };

  const leaveSelected = async () => {
    const chosen = selectedItems;
    clear();
    const result = await leaveSharedItems({ itemIds: chosen.map((item) => item.id) });
    if (result.error !== null) {
      toast.error(result.error);
    } else if (result.done.length === 0) {
      toast.error(result.firstError ?? "Nothing was removed.");
    } else {
      toast.success(`Removed ${countItems(result.done.length)} from Shared with me`);
    }
    router.refresh();
  };

  const preview = <FilePreview file={previewing} onClose={() => setPreviewing(null)} />;

  const offerList = offers.length > 0 && (
    <section className="flex shrink-0 flex-col gap-2 rounded-lg border p-4">
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

      {selectedItems.length > 0 && (
        <SelectionPortal>
          <SelectionPill count={selectedItems.length} onClear={clear}>
            <PillButton
              icon={<Download />}
              label="Download"
              onClick={() => downloadSelection(selectedItems)}
            />
            {onlyFiles && <PillButton icon={<Copy />} label="Make a copy" onClick={copySelected} />}
            <PillButton
              icon={<LogOut />}
              label="Remove from Shared with me"
              destructive
              onClick={leaveSelected}
            />
          </SelectionPill>
        </SelectionPortal>
      )}
      <div className={SCROLL_LIST}>
        <SelectableArea listProps={listProps} box={box} count={selectedItems.length}>
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
                  selectable={rowProps(item, () => open(item))}
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
                  <TableRow
                    key={item.id}
                    {...rowProps(item, () => open(item))}
                    className="data-selected:bg-primary/10 data-selected:hover:bg-primary/15"
                  >
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
        </SelectableArea>
      </div>
      {preview}
    </>
  );
};

export default SharedList;
