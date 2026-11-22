"use client";

import type { ListedItem } from "@devsbucket/db/items";
import { cn } from "cn";
import {
  ActivityIcon,
  ChevronDown,
  Download,
  Ellipsis,
  Eye,
  FolderDown,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRef, useState } from "react";
import CopyMenuItem from "@/components/drive/copy-menu-item";
import { downloadUrl } from "@/components/drive/file-preview";
import MuteMenuItem from "@/components/drive/mute-menu-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadFolderZip } from "@/lib/zip-download";

// What the user's role allows on a row (from can(), on the server).
export type ItemActions = {
  share: boolean;
  rename: boolean;
  move: boolean;
  trash: boolean;
  activity: boolean;
};

type ItemMenuProps = {
  item: Pick<ListedItem, "id" | "name" | "type">;
  actions: ItemActions;
  onPreview: () => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onActivity: () => void;
  onTrash: () => void;
};

// The ⋯ menu on each row: only what the user may do, and muting, which
// everyone may. The less used ones (Activity, Mute) sit under "More",
// which opens in place: a side flyout has no room on a phone.
const ItemMenu = ({
  item,
  actions,
  onPreview,
  onRename,
  onMove,
  onShare,
  onActivity,
  onTrash,
}: ItemMenuProps) => {
  // Dialogs open once the menu has fully closed. Opened sooner, the closing
  // menu and the dialog fight over focus, and the dialog's focus trap ends
  // up selecting the whole name field in Rename.
  const pending = useRef<(() => void) | null>(null);
  const openDialog = (open: () => void) => () => {
    pending.current = open;
  };
  const isFile = item.type === "file";
  const [more, setMore] = useState(false);

  return (
    // Closed again for the next time the menu opens.
    <DropdownMenu onOpenChange={(open) => !open && setMore(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${item.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        // As wide as the longest label: shadcn sizes menus to the button
        // that opens them, which made labels wrap.
        className="w-max"
        onCloseAutoFocus={(event) => {
          const open = pending.current;
          if (open) {
            event.preventDefault();
            pending.current = null;
            open();
          }
        }}
      >
        {isFile && (
          <>
            <DropdownMenuItem onSelect={openDialog(onPreview)}>
              <Eye />
              Preview
            </DropdownMenuItem>
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

        {!isFile && (
          <>
            <DropdownMenuItem onSelect={() => downloadFolderZip(item)}>
              <FolderDown />
              Download as ZIP
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {actions.share && (
          <DropdownMenuItem onSelect={openDialog(onShare)}>
            <UserPlus />
            Share
          </DropdownMenuItem>
        )}
        {actions.rename && (
          <DropdownMenuItem onSelect={openDialog(onRename)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
        )}
        {actions.move && (
          <DropdownMenuItem onSelect={openDialog(onMove)}>
            <FolderInput />
            Move
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          aria-expanded={more}
          onSelect={(event) => {
            // Keep the menu open: this only shows or hides the items below.
            event.preventDefault();
            setMore((open) => !open);
          }}
        >
          <Ellipsis />
          More
          <ChevronDown className={cn("ml-auto transition-transform", more && "rotate-180")} />
        </DropdownMenuItem>
        {more && (
          <DropdownMenuGroup className="pl-4">
            {actions.activity && (
              <DropdownMenuItem onSelect={openDialog(onActivity)}>
                <ActivityIcon />
                Activity
              </DropdownMenuItem>
            )}
            <MuteMenuItem item={item} />
          </DropdownMenuGroup>
        )}
        {actions.trash && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onTrash}>
              <Trash2 />
              Move to trash
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ItemMenu;
