import { can } from "@devsbucket/authz/can";
import { getBreadcrumbs } from "@devsbucket/db/items";
import type { Access } from "@devsbucket/shared/access";
import { isEditableName } from "@devsbucket/shared/editing";
import { roleLabel } from "@devsbucket/shared/sharing";
import { Download, FileX } from "lucide-react";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import LiveEditorLazy from "@/components/editor/live-editor-lazy";
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
  user: { id: string; name: string };
  access: Access;
};

// A file's page (Phase 4): breadcrumbs, Download and the live editor. The
// caller has already checked that the user may view it; realtime checks
// again (and reads the file) when the editor connects.
const FileView = async ({ file, user, access }: FileViewProps) => {
  const breadcrumbs = await getBreadcrumbs(file.id, user.id);

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
      {isEditableName(file.name, file.mimeType) ? (
        <LiveEditorLazy
          file={{ id: file.id, name: file.name, size: file.size ?? 0 }}
          user={user}
          canEdit={can(access, "edit")}
        />
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileX />
            </EmptyMedia>
            <EmptyTitle>Can't open this file here</EmptyTitle>
            <EmptyDescription>
              This type of file can't be opened in the editor. Download it to open it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
};

export default FileView;
