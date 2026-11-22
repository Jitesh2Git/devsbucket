import { type AuthzAccess, can } from "@devsbucket/authz/can";
import { getBreadcrumbs, listItems } from "@devsbucket/db/items";
import { getPendingTransfer } from "@devsbucket/db/transfers";
import { roleLabel } from "@devsbucket/shared/sharing";
import type { ReactNode } from "react";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import DropZone from "@/components/drive/drop-zone";
import ItemList from "@/components/drive/item-list";
import NewFileDialog from "@/components/drive/new-file-dialog";
import NewFolderDialog from "@/components/drive/new-folder-dialog";
import OwnershipOfferActions from "@/components/drive/ownership-offer-actions";
import ShareButton from "@/components/drive/share-button";
import UploadButton from "@/components/drive/upload-button";
import ViewToggle from "@/components/drive/view-toggle";
import ZipDownloadButton from "@/components/drive/zip-download-button";

type FolderViewProps = {
  // null = the top level of My Drive.
  folderId: string | null;
  ownerId: string;
  userId: string;
  // The user's access to this folder (MY_DRIVE at the top of their own).
  access: AuthzAccess;
};

// A folder's page: breadcrumbs, actions and the listing. The caller has
// already checked that the user may view this folder. Buttons and menus
// show only what the user's role allows here; the server checks again.
// Everything inside has at least this role, so the folder's role is used
// for every row (a higher grant on one row inside isn't offered here; the
// server still allows it).
const FolderView = async ({ folderId, ownerId, userId, access }: FolderViewProps) => {
  const [firstPage, breadcrumbs, transfer] = await Promise.all([
    listItems({ ownerId, parentId: folderId, cursor: null }),
    folderId ? getBreadcrumbs(folderId, userId) : { root: "my-drive" as const, folders: [] },
    folderId ? getPendingTransfer(folderId) : null,
  ]);

  // The folder being viewed (the last breadcrumb); none at the top of My Drive.
  const current = breadcrumbs.folders.at(-1);
  const canUpload = can(access, "upload");
  const actions = {
    share: can(access, "share"),
    rename: can(access, "rename"),
    move: can(access, "move"),
    trash: can(access, "trash"),
    activity: can(access, "view_activity"),
  };
  // In someone else's tree, moves stay below the top-most shared folder.
  const moveRoot = breadcrumbs.root === "shared" ? (breadcrumbs.folders[0] ?? null) : null;

  // From md up the page is as tall as the drive's right column: the banner,
  // breadcrumbs and buttons stay, and only the list scrolls (drive layout).
  const page: ReactNode = (
    <div className="flex flex-col gap-4 md:h-full">
      {current && transfer?.toUserId === userId && (
        // Offered to you (decision 0009): the banner on the item.
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>{transfer.fromName} wants to make you the owner of this folder.</span>
          <OwnershipOfferActions
            offer={{ id: transfer.id, itemId: current.id, name: current.name }}
          />
        </div>
      )}

      {/* On a phone the buttons wrap under the breadcrumbs. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <DriveBreadcrumbs root={breadcrumbs.root} folders={breadcrumbs.folders} />
          {access.role !== "owner" && access.role !== null && (
            <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              <span className="sr-only">Your role: </span>
              {roleLabel(access.role)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ViewToggle />
          {current && can(access, "download") && <ZipDownloadButton folder={current} />}
          {current && actions.share && <ShareButton folder={current} />}
          {canUpload && <UploadButton parentId={folderId} />}
          {canUpload && <NewFileDialog parentId={folderId} />}
          {can(access, "create_folder") && <NewFolderDialog parentId={folderId} />}
        </div>
      </div>
      {/* The column headings stick to the top of the list while it scrolls.
          The table's own wrapper scrolls sideways (overflow-x-auto), which
          would make it the headings' scroll box instead, so from md up it
          doesn't: the name cells truncate, so the table never needs to.
          The line under the headings is a shadow: with collapsed borders,
          the row's own border line would scroll away with the rows. */}
      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:**:data-[slot=table-container]:overflow-visible md:[&_thead]:sticky md:[&_thead]:top-0 md:[&_thead]:z-10 md:[&_thead]:bg-background md:[&_th]:shadow-[inset_0_-1px_0_var(--color-border)]">
        <ItemList
          parentId={folderId}
          firstPage={firstPage}
          actions={actions}
          canAdd={canUpload}
          moveRoot={moveRoot}
        />
      </div>
    </div>
  );

  return canUpload ? <DropZone parentId={folderId}>{page}</DropZone> : page;
};

export default FolderView;
