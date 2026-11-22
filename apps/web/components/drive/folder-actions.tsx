"use client";

import { FilePlus, FolderDown, FolderPlus, MoreHorizontal, Upload, UserPlus } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import NewFileDialog from "@/components/drive/new-file-dialog";
import NewFolderDialog from "@/components/drive/new-folder-dialog";
import ShareDialog from "@/components/drive/share-dialog";
import { useUploads } from "@/components/drive/uploads-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadFolderZip } from "@/lib/zip-download";

type FolderActionsProps = {
  parentId: string | null;
  // The folder being viewed; null at the top of My Drive (nothing to share
  // or download as a whole there).
  folder: { id: string; name: string } | null;
  // What the user's role allows here (the server checks again).
  can: { upload: boolean; createFolder: boolean; share: boolean; download: boolean };
};

type Open = "new-folder" | "new-file" | "share" | null;

// A folder's actions. From md up, buttons; on a phone, where they don't
// fit, one ⋯ menu with the same actions. Both open the same dialogs and
// the same file picker, kept here once.
const FolderActions = ({ parentId, folder, can }: FolderActionsProps) => {
  const { startUploads } = useUploads();
  const picker = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<Open>(null);
  // Leaving the page only hides it (Activity): close any dialog.
  useLayoutEffect(() => () => setOpen(null), []);

  const actions = [
    can.download &&
      folder && {
        key: "zip",
        label: "Download as ZIP",
        icon: FolderDown,
        run: () => downloadFolderZip(folder),
      },
    can.share &&
      folder && { key: "share", label: "Share", icon: UserPlus, run: () => setOpen("share") },
    can.upload && {
      key: "upload",
      label: "Upload",
      icon: Upload,
      run: () => picker.current?.click(),
    },
    can.upload && {
      key: "new-file",
      label: "New file",
      icon: FilePlus,
      run: () => setOpen("new-file"),
    },
    can.createFolder && {
      key: "new-folder",
      label: "New folder",
      icon: FolderPlus,
      run: () => setOpen("new-folder"),
    },
  ].filter((action) => action !== false && action !== null);

  if (actions.length === 0) return null;
  // On a phone, the ones that only add to this folder come first.
  const adds = actions.filter((action) =>
    ["upload", "new-file", "new-folder"].includes(action.key),
  );
  const others = actions.filter((action) => !adds.includes(action));

  return (
    <>
      <div className="hidden gap-2 md:flex md:flex-wrap">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.key === "new-folder" ? "default" : "outline"}
            onClick={action.run}
          >
            <action.icon />
            {action.label}
          </Button>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden" aria-label="Folder actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-max">
          {adds.map((action) => (
            <DropdownMenuItem key={action.key} onSelect={action.run}>
              <action.icon />
              {action.label}
            </DropdownMenuItem>
          ))}
          {adds.length > 0 && others.length > 0 && <DropdownMenuSeparator />}
          {others.map((action) => (
            <DropdownMenuItem key={action.key} onSelect={action.run}>
              <action.icon />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {can.upload && (
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label="Upload files"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) {
              startUploads(files, parentId);
            }
            // Picking the same file again still fires onChange.
            event.target.value = "";
          }}
        />
      )}
      {can.upload && (
        <NewFileDialog
          parentId={parentId}
          open={open === "new-file"}
          onOpenChange={(next) => setOpen(next ? "new-file" : null)}
        />
      )}
      {can.createFolder && (
        <NewFolderDialog
          parentId={parentId}
          open={open === "new-folder"}
          onOpenChange={(next) => setOpen(next ? "new-folder" : null)}
        />
      )}
      {folder && can.share && (
        <ShareDialog item={open === "share" ? folder : null} onClose={() => setOpen(null)} />
      )}
    </>
  );
};

export default FolderActions;
