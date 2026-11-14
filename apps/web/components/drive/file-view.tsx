import { getBreadcrumbs } from "@devsbucket/db/items";
import type { Access } from "@devsbucket/shared/access";
import { decodeEditableText, editorPath, isEditableName } from "@devsbucket/shared/editing";
import { roleLabel } from "@devsbucket/shared/sharing";
import { getObject, itemKey } from "@devsbucket/storage/objects";
import { Download, FileX } from "lucide-react";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import CodeEditorLazy from "@/components/editor/code-editor-lazy";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type FileViewProps = {
  file: { id: string; name: string; mimeType: string | null; size: number | null };
  userId: string;
  access: Access;
};

// The whole file as text, or why it can't be shown in the editor. Step 5
// replaces this with the live document from realtime.
const readText = async (file: FileViewProps["file"]) => {
  if (!isEditableName(file.name, file.mimeType)) {
    return { text: null, reason: "This type of file can't be opened in the editor." } as const;
  }
  const bytes = file.size ? await getObject(itemKey(file.id)) : new Uint8Array();
  const text = decodeEditableText(bytes);
  if (text === null) {
    return { text: null, reason: "This file isn't UTF-8 text, so it can't be edited." } as const;
  }
  return { text, reason: null } as const;
};

// A file's page (Phase 4): breadcrumbs, Download and the editor, read-only
// for now. The caller has already checked that the user may view it.
const FileView = async ({ file, userId, access }: FileViewProps) => {
  const [breadcrumbs, content] = await Promise.all([
    getBreadcrumbs(file.id, userId),
    readText(file),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <DriveBreadcrumbs root={breadcrumbs.root} folders={breadcrumbs.folders} />
          {access.role !== "owner" && access.role !== null && (
            <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              <span className="sr-only">Your role: </span>
              {roleLabel(access.role)}
            </span>
          )}
        </div>
        <Button asChild variant="outline" className="shrink-0">
          {/* The same route as the preview's Download (downloadUrl is client-only). */}
          <a href={`/api/items/${file.id}/download`}>
            <Download />
            Download
          </a>
        </Button>
      </div>
      {content.text === null ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileX />
            </EmptyMedia>
            <EmptyTitle>Can't open this file here</EmptyTitle>
            <EmptyDescription>{content.reason} Download it to open it.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="h-[calc(100vh-12rem)] min-h-80 overflow-hidden rounded-md border">
          <CodeEditorLazy path={editorPath(file.id, file.name)} value={content.text} readOnly />
        </div>
      )}
    </div>
  );
};

export default FileView;
