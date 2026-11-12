"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { savedAsNote, type Upload, useUploads } from "@/components/drive/uploads-provider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const isActive = (upload: Upload) => upload.status === "queued" || upload.status === "uploading";

const UploadRow = ({ upload, onCancel }: { upload: Upload; onCancel: () => void }) => {
  const note = savedAsNote(upload);
  return (
    <li className="flex flex-col gap-1.5 px-4 py-2.5">
      <div className="flex items-center gap-2">
        {upload.status === "done" && <CircleCheck className="size-4 shrink-0 text-primary" />}
        {upload.status === "error" && <CircleAlert className="size-4 shrink-0 text-destructive" />}
        <span className="min-w-0 flex-1 truncate text-sm">{upload.savedAs ?? upload.name}</span>
        {isActive(upload) && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            aria-label={`Cancel ${upload.name}`}
          >
            <X />
          </Button>
        )}
      </div>
      {upload.status === "uploading" && (
        <Progress value={upload.progress * 100} aria-label={`Uploading ${upload.name}`} />
      )}
      {upload.status === "queued" && <p className="text-xs text-muted-foreground">Waiting…</p>}
      {upload.status === "cancelled" && <p className="text-xs text-muted-foreground">Cancelled</p>}
      {upload.status === "error" && <p className="text-xs text-destructive">{upload.error}</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </li>
  );
};

// Bottom-right: one row per file, while uploading and after.
const UploadsPanel = () => {
  const { uploads, cancel, clearFinished } = useUploads();
  if (uploads.length === 0) {
    return null;
  }
  const running = uploads.filter(isActive).length;

  return (
    <section
      aria-label="Uploads"
      className="fixed right-4 bottom-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg"
    >
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-medium">
          {running === 0
            ? "Uploads finished"
            : running === 1
              ? "Uploading 1 file"
              : `Uploading ${running} files`}
        </h2>
        {running === 0 && (
          <Button variant="ghost" size="icon-xs" onClick={clearFinished} aria-label="Close uploads">
            <X />
          </Button>
        )}
      </header>
      <ul className="max-h-72 divide-y overflow-y-auto">
        {uploads.map((upload) => (
          <UploadRow key={upload.id} upload={upload} onCancel={() => cancel(upload.id)} />
        ))}
      </ul>
    </section>
  );
};

export default UploadsPanel;
