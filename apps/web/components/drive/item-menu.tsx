"use client";

import type { ListedItem } from "@devsbucket/db/items";
import { Download, Eye, FolderInput, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRef } from "react";
import { downloadUrl } from "@/components/drive/file-preview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ItemMenuProps = {
  item: Pick<ListedItem, "id" | "name" | "type">;
  onPreview: () => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onTrash: () => void;
};

// The ⋯ menu on each row.
const ItemMenu = ({ item, onPreview, onRename, onMove, onShare, onTrash }: ItemMenuProps) => {
  // Dialogs open once the menu has fully closed. Opened sooner, the closing
  // menu and the dialog fight over focus, and the dialog's focus trap ends
  // up selecting the whole name field in Rename.
  const pending = useRef<(() => void) | null>(null);
  const openDialog = (open: () => void) => () => {
    pending.current = open;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${item.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          const open = pending.current;
          if (open) {
            event.preventDefault();
            pending.current = null;
            open();
          }
        }}
      >
        {item.type === "file" && (
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
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={openDialog(onShare)}>
          <UserPlus />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openDialog(onRename)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openDialog(onMove)}>
          <FolderInput />
          Move
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onTrash}>
          <Trash2 />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ItemMenu;
