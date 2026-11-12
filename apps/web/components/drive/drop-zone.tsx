"use client";

import { Upload } from "lucide-react";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { useUploads } from "@/components/drive/uploads-provider";

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

// Drop files anywhere on a folder's page to upload them into that folder.
// Dropped folders are skipped for now (uploading folder trees is for later).
const DropZone = ({ parentId, children }: { parentId: string | null; children: ReactNode }) => {
  const { startUploads } = useUploads();
  const [over, setOver] = useState(false);
  // dragenter/dragleave fire for every child element; count to know when
  // the pointer really left.
  const depth = useRef(0);

  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    const files: File[] = [];
    let folders = 0;
    for (const item of Array.from(event.dataTransfer.items)) {
      if (item.kind !== "file") continue;
      if (item.webkitGetAsEntry()?.isDirectory) {
        folders += 1;
        continue;
      }
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (folders > 0) {
      toast.info("Folders can't be uploaded yet", {
        description: files.length > 0 ? "Only the files you dropped are uploading." : undefined,
      });
    }
    if (files.length > 0) {
      startUploads(files, parentId);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for the mouse; the Upload button is the keyboard way
    <div
      className="relative min-h-[60vh]"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        // Without this the browser opens the file instead of dropping it here.
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        depth.current -= 1;
        if (depth.current === 0) setOver(false);
      }}
      onDrop={onDrop}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-primary border-dashed bg-background/80 text-sm font-medium">
          <Upload className="size-6" />
          Drop files to upload them here
        </div>
      )}
    </div>
  );
};

export default DropZone;
