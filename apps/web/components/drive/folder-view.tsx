import { getBreadcrumbs, listItems } from "@devsbucket/db/items";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import DropZone from "@/components/drive/drop-zone";
import ItemList from "@/components/drive/item-list";
import NewFolderDialog from "@/components/drive/new-folder-dialog";
import ShareButton from "@/components/drive/share-button";
import UploadButton from "@/components/drive/upload-button";

type FolderViewProps = {
  // null = the top level of My Drive.
  folderId: string | null;
  ownerId: string;
};

// A folder's page: breadcrumbs, actions and the listing. The caller has
// already checked that the user may view this folder.
const FolderView = async ({ folderId, ownerId }: FolderViewProps) => {
  const [firstPage, breadcrumbs] = await Promise.all([
    listItems({ ownerId, parentId: folderId, cursor: null }),
    folderId ? getBreadcrumbs(folderId) : [],
  ]);

  // The folder being viewed (the last breadcrumb); none at the top of My Drive.
  const current = breadcrumbs.at(-1);

  return (
    <DropZone parentId={folderId}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <DriveBreadcrumbs folders={breadcrumbs} />
          <div className="flex shrink-0 gap-2">
            {current && <ShareButton folder={current} />}
            <UploadButton parentId={folderId} />
            <NewFolderDialog parentId={folderId} />
          </div>
        </div>
        <ItemList parentId={folderId} firstPage={firstPage} />
      </div>
    </DropZone>
  );
};

export default FolderView;
