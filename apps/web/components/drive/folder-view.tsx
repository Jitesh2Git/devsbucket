import { getBreadcrumbs, listItems } from "@devsbucket/db/items";
import DriveBreadcrumbs from "@/components/drive/drive-breadcrumbs";
import ItemList from "@/components/drive/item-list";
import NewFolderDialog from "@/components/drive/new-folder-dialog";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <DriveBreadcrumbs folders={breadcrumbs} />
        <NewFolderDialog parentId={folderId} />
      </div>
      <ItemList parentId={folderId} firstPage={firstPage} />
    </div>
  );
};

export default FolderView;
