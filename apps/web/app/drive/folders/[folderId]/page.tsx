import { itemIdSchema } from "@devsbucket/shared/item";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FolderView from "@/components/drive/folder-view";
import { resolveFolder } from "@/lib/folders";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Drive" };

// A missing folder, someone else's, or one in the trash all get the same 404:
// the page never says that a folder exists (diagram 7).
const FolderContent = async ({ params }: { params: Promise<{ folderId: string }> }) => {
  const [{ folderId }, { user }] = await Promise.all([params, requireSession()]);
  if (!itemIdSchema.safeParse(folderId).success) {
    notFound();
  }
  const folder = await resolveFolder(user, folderId, "view");
  if (!folder) {
    notFound();
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
