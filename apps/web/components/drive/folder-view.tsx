import { type AuthzAccess, can } from "@devsbucket/authz/can";
import { getBreadcrumbs, listItems } from "@devsbucket/db/items";
import { getPendingTransfer } from "@devsbucket/db/transfers";
import { roleLabel } from "@devsbucket/shared/sharing";
import type { ReactNode } from "react";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import DropZone from "@/components/drive/drop-zone";
import ItemList from "@/components/drive/item-list";
import NewFolderDialog from "@/components/drive/new-folder-dialog";
import OwnershipOfferActions from "@/components/drive/ownership-offer-actions";
import ShareButton from "@/components/drive/share-button";
import UploadButton from "@/components/drive/upload-button";

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
  };
  // In someone else's tree, moves stay below the top-most shared folder.
  const moveRoot = breadcrumbs.root === "shared" ? (breadcrumbs.folders[0] ?? null) : null;

  const page: ReactNode = (
    <div className="flex flex-col gap-4">
      {current && transfer?.toUserId === userId && (
        // Offered to you (decision 0009): the banner on the item.
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>{transfer.fromName} wants to make you the owner of this folder.</span>
          <OwnershipOfferActions
            offer={{ id: transfer.id, itemId: current.id, name: current.name }}
          />
        </div>
      )}

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
        <div className="flex shrink-0 gap-2">
          {current && actions.share && <ShareButton folder={current} />}
          {canUpload && <UploadButton parentId={folderId} />}
          {can(access, "create_folder") && <NewFolderDialog parentId={folderId} />}
        </div>
      </div>
      <ItemList
        parentId={folderId}
        firstPage={firstPage}
        actions={actions}
        canAdd={canUpload}
        moveRoot={moveRoot}
      />
    </div>
  );

  return canUpload ? <DropZone parentId={folderId}>{page}</DropZone> : page;
};

export default FolderView;
