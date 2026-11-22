import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FileView from "@/components/drive/file-view";
import NeedAccess from "@/components/drive/need-access";
import PageLoader from "@/components/page-loader";
import { resolveFile } from "@/lib/items";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "File" };

// A missing (or trashed) file: 404. One that exists but isn't shared with
// you: "You need access" (decision 0008).
const FileContent = async ({ params }: { params: Promise<{ fileId: string }> }) => {
  const [{ fileId }, { user }] = await Promise.all([params, requireSession()]);
  const found = await resolveFile(user, fileId, "view");
  if (found.denied === "no-access") {
    return <NeedAccess itemId={fileId} userId={user.id} />;
  }
  if (found.denied) {
    notFound();
  }
  return (
    <FileView file={found.item} user={{ id: user.id, name: user.name }} access={found.access} />
  );
};

const FilePage = ({ params }: PageProps<"/drive/files/[fileId]">) => {
  return (
    <Suspense fallback={<PageLoader label="Loading the file" fullHeight />}>
      <FileContent params={params} />
    </Suspense>
  );
};

export default FilePage;
