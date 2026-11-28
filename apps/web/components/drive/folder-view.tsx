import { type AuthzAccess, can } from "@devsbucket/authz/can";
import { getBreadcrumbs, listItems } from "@devsbucket/db/items";
import { getPendingTransfer } from "@devsbucket/db/transfers";
import { roleLabel } from "@devsbucket/shared/sharing";
import type { ReactNode } from "react";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import DropZone from "@/components/drive/drop-zone";
import FolderActions from "@/components/drive/folder-actions";
import ItemList from "@/components/drive/item-list";
import OwnershipOfferActions from "@/components/drive/ownership-offer-actions";
import SelectionBar from "@/components/drive/selection-bar";
import ViewToggle from "@/components/drive/view-toggle";
import { SCROLL_LIST } from "@/lib/scroll-list";
import { SelectionProvider } from "@/lib/selection";

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

      {/* On a phone: the breadcrumbs, the view toggle and one ⋯ menu.
          From md up the buttons can wrap under the breadcrumbs when the
          column is narrow. */}
      <div className="flex shrink-0 items-center justify-between gap-x-4 gap-y-2 md:flex-wrap">
        <div className="flex min-w-0 items-center gap-3">
          <DriveBreadcrumbs root={breadcrumbs.root} folders={breadcrumbs.folders} />
          {access.role !== "owner" && access.role !== null && (
            <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              <span className="sr-only">Your role: </span>
              {roleLabel(access.role)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-2 md:shrink md:flex-wrap">
          <ViewToggle />
          {/* While items are selected, their actions take the buttons' place. */}
          <SelectionBar parentId={folderId} actions={actions} moveRoot={moveRoot}>
            <FolderActions
              parentId={folderId}
              folder={current ?? null}
              can={{
                upload: canUpload,
                createFolder: can(access, "create_folder"),
                share: actions.share,
                download: can(access, "download"),
              }}
            />
          </SelectionBar>
        </div>
      </div>
      {/* Only the list scrolls (SCROLL_LIST, lib/scroll-list.ts). */}
      <div className={SCROLL_LIST}>
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

  // One selection for the list and the bar (multi-select, lib/selection.tsx).
  return (
    <SelectionProvider>
      {canUpload ? <DropZone parentId={folderId}>{page}</DropZone> : page}
    </SelectionProvider>
  );
};

export default FolderView;
