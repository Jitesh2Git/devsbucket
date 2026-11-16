import { listRecent } from "@devsbucket/db/recent";
import type { Metadata } from "next";
import { Suspense } from "react";
import RecentList from "@/components/drive/recent-list";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Recent" };

const RecentContent = async () => {
  const { user } = await requireSession();
  const items = await listRecent(user.id);
  return <RecentList items={items} userId={user.id} />;
};

const RecentPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Recent</h1>
      <Suspense>
        <RecentContent />
      </Suspense>
    </div>
  );
};

export default RecentPage;
