import { listSharedWithMe } from "@devsbucket/db/shared-with-me";
import type { Metadata } from "next";
import { Suspense } from "react";
import SharedList from "@/components/drive/shared-list";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Shared with me" };

const SharedContent = async () => {
  const { user } = await requireSession();
  return <SharedList items={await listSharedWithMe(user.id)} />;
};

const SharedPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Shared with me</h1>
      <Suspense>
        <SharedContent />
      </Suspense>
    </div>
  );
};

export default SharedPage;
