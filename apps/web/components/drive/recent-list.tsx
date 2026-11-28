"use client";

import type { RecentItem } from "@devsbucket/db/recent";
import { formatBytes } from "@devsbucket/shared/bytes";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import FilePreview, { type PreviewFile } from "@/components/drive/file-preview";
import { ItemCard, ItemGrid } from "@/components/drive/item-grid";
import ItemName, { itemHref } from "@/components/drive/item-name";
import SelectableArea from "@/components/drive/selectable-area";
import SelectionPill, { PillButton } from "@/components/drive/selection-pill";
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
import { startNavigation } from "@/lib/navigation-progress";
import { SCROLL_LIST } from "@/lib/scroll-list";
import { SelectionPortal, useSelectableRows, useSelection } from "@/lib/selection";
import { trashSelection } from "@/lib/trash-selection";
import { useViewMode } from "@/lib/view-mode";
import { downloadSelection } from "@/lib/zip-download";

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

  // Multi-select: a click selects, a double-click opens; Download and
  // Move to trash in the bar (trash is checked per file on the server: only
  // where your role allows it).
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setRows, selectedItems, clear } = useSelection<RecentItem>();
  useEffect(() => setRows(items), [setRows, items]);
  const { rowProps, listProps, box } = useSelectableRows();
  const open = (item: RecentItem) => {
    const href = itemHref(item);
    if (href) {
      startNavigation();
      router.push(href);
    } else {
      setPreviewing(item);
    }
  };
  const moveToTrash = () => {
    const chosen = selectedItems;
    clear();
    return trashSelection(chosen, async () => {
      router.refresh();
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    });
  };

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
      <SelectionPortal>
        <SelectionPill open={selectedItems.length > 0} count={selectedItems.length} onClear={clear}>
          <PillButton
            icon={<Download />}
            label="Download"
            onClick={() => downloadSelection(selectedItems)}
          />
          <PillButton icon={<Trash2 />} label="Move to trash" destructive onClick={moveToTrash} />
        </SelectionPill>
      </SelectionPortal>
      <div className={SCROLL_LIST}>
        <SelectableArea listProps={listProps} box={box} count={selectedItems.length}>
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
                  selectable={rowProps(item, () => open(item))}
                />
              ))}
            </ItemGrid>
          ) : (
            <Table
              // On a phone the table keeps room for the names (600 px) and
              // scrolls sideways in its own box; from md up it fits the column.
              className="min-w-150 md:min-w-0"
            >
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
                  <TableRow
                    key={item.id}
                    {...rowProps(item, () => open(item))}
                    className="data-selected:bg-primary/10 data-selected:hover:bg-primary/15"
                  >
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
        </SelectableArea>
      </div>
      {preview}
    </>
  );
};

export default RecentList;
