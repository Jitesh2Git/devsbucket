import { itemIdSchema } from "@devsbucket/shared/item";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FolderView from "@/components/drive/folder-view";
import TrashedFolder from "@/components/drive/trashed-folder";
import { findTrashedFolder, resolveFolder } from "@/lib/folders";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Drive" };

// A missing folder or someone else's gets the same 404: the page never says
// that a folder exists (diagram 7). The user's own trashed folder says so.
const FolderContent = async ({ params }: { params: Promise<{ folderId: string }> }) => {
  const [{ folderId }, { user }] = await Promise.all([params, requireSession()]);
  if (!itemIdSchema.safeParse(folderId).success) {
    notFound();
  }
  const folder = await resolveFolder(user, folderId, "view");
  if (!folder) {
    const trashed = await findTrashedFolder(user, folderId);
    if (!trashed) {
      notFound();
    }
    return (
      <TrashedFolder
        folder={{ id: trashed.id, name: trashed.name }}
        isTrashRoot={trashed.trashRoot}
      />
    );
  }
  return <FolderView folderId={folderId} ownerId={folder.ownerId} />;
};

const FolderPage = ({ params }: PageProps<"/drive/folders/[folderId]">) => {
  return (
    <Suspense>
      <FolderContent params={params} />
    </Suspense>
  );
};

export default FolderPage;
