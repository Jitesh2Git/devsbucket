import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FolderView from "@/components/drive/folder-view";
import NeedAccess from "@/components/drive/need-access";
import TrashedFolder from "@/components/drive/trashed-folder";
import { resolveItem } from "@/lib/items";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Drive" };

// A missing folder: 404. One that exists but isn't shared with you: "You
// need access" (decision 0008), where they can ask for it. One in the
// says so, with Restore.
const FolderContent = async ({ params }: { params: Promise<{ folderId: string }> }) => {
  const [{ folderId }, { user }] = await Promise.all([params, requireSession()]);
  const found = await resolveItem(user, folderId, "view", { type: "folder" });
  if (found.denied === "no-access") {
    return <NeedAccess itemId={folderId} userId={user.id} />;
  }
  if (found.denied) {
    notFound();
  }
  const { item: folder, access } = found;
  if (folder.trashedAt !== null) {
    return (
      <TrashedFolder folder={{ id: folder.id, name: folder.name }} isTrashRoot={folder.trashRoot} />
    );
  }
  return (
    <FolderView folderId={folderId} ownerId={folder.ownerId} userId={user.id} access={access} />
  );
};

const FolderPage = ({ params }: PageProps<"/drive/folders/[folderId]">) => {
  return (
    <Suspense>
      <FolderContent params={params} />
    </Suspense>
  );
};

export default FolderPage;
