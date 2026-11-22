import { MY_DRIVE } from "@devsbucket/authz/can";
import type { Metadata } from "next";
import { Suspense } from "react";
import FolderView from "@/components/drive/folder-view";
import PageLoader from "@/components/page-loader";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Drive" };

const MyDriveContent = async () => {
  const { user } = await requireSession();
  return <FolderView folderId={null} ownerId={user.id} userId={user.id} access={MY_DRIVE} />;
};

const MyDrivePage = () => {
  return (
    <Suspense fallback={<PageLoader label="Loading your drive" fullHeight />}>
      <MyDriveContent />
    </Suspense>
  );
};

export default MyDrivePage;
