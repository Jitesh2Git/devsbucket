"use client";

import type { ListedItem } from "@devsbucket/db/items";
import { formatBytes } from "@devsbucket/shared/bytes";
import { previewKind } from "@devsbucket/shared/preview";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { loadTextPreview } from "@/app/drive/preview-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export type PreviewFile = Pick<ListedItem, "id" | "name" | "mimeType" | "size">;

export const downloadUrl = (id: string) => `/api/items/${id}/download`;
const previewUrl = (id: string) => `/api/items/${id}/preview`;

const Message = ({ children }: { children: React.ReactNode }) => (
  <p className="py-12 text-center text-muted-foreground">{children}</p>
);

// The first megabyte of a text file, from the server.
const TextPreview = ({ file }: { file: PreviewFile }) => {
  const query = useQuery({
    queryKey: ["text-preview", file.id],
    queryFn: async () => {
      const result = await loadTextPreview({ itemId: file.id });
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result;
    },
  });
  if (query.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (query.isError) {
    return <Message>{query.error.message}</Message>;
  }
  if (query.data.binary) {
    return <Message>This file isn't text. Download it to open it.</Message>;
  }
  if (query.data.text === "") {
    return <Message>This file is empty.</Message>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <pre className="max-h-[65vh] overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
        {query.data.text}
      </pre>
      {query.data.truncated && (
        <p className="text-xs text-muted-foreground">
          Showing the first 1 MB. Download the file to see all of it.
        </p>
      )}
    </div>
  );
};

const PreviewBody = ({ file }: { file: PreviewFile }) => {
  const src = previewUrl(file.id);
  switch (previewKind(file.name, file.mimeType)) {
    case "image":
      return (
        // A plain <img>: the file comes from storage through a redirect,
        // which Next's <Image> optimizer can't follow with our cookies.
        // biome-ignore lint/performance/noImgElement: see above
        <img src={src} alt={file.name} className="mx-auto max-h-[65vh] object-contain" />
      );
    case "video":
      // biome-ignore lint/a11y/useMediaCaption: user files come without captions
      return <video src={src} controls className="mx-auto max-h-[65vh] w-full" />;
    case "audio":
      // biome-ignore lint/a11y/useMediaCaption: user files come without captions
      return <audio src={src} controls className="w-full" />;
    case "pdf":
      return <iframe src={src} title={file.name} className="h-[65vh] w-full rounded-md border" />;
    case "text":
      return <TextPreview file={file} />;
    default:
      return <Message>No preview for this type of file.</Message>;
  }
};

// A file's preview, over the folder. Closing it (or leaving the page)
// unmounts the content, which also stops a playing video.
const FilePreview = ({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) => {
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        {file && (
          <>
            <DialogHeader className="min-w-0 pr-8">
              <DialogTitle className="truncate">{file.name}</DialogTitle>
              <DialogDescription>
                {file.size === null ? "" : formatBytes(file.size)}
              </DialogDescription>
            </DialogHeader>
            <PreviewBody file={file} />
            <DialogFooter>
              <Button asChild variant="outline">
                <a href={downloadUrl(file.id)}>
                  <Download />
                  Download
                </a>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
