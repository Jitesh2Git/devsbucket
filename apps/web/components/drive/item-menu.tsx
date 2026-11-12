"use client";

import type { ListedItem } from "@devsbucket/db/items";
import { Download, Eye, FolderInput, MoreHorizontal, Pencil } from "lucide-react";
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
};

// The ⋯ menu on each row. Trash joins it in step 10.
const ItemMenu = ({ item, onPreview, onRename, onMove }: ItemMenuProps) => {
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
        <DropdownMenuItem onSelect={openDialog(onRename)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openDialog(onMove)}>
          <FolderInput />
          Move
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ItemMenu;
