import { FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My Drive" };

// Step 4 replaces the empty state with the folder listing.
const MyDriveContent = async () => {
  await requireSession();

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>Your drive is empty</EmptyTitle>
        <EmptyDescription>Create a folder or upload files to get started.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

const MyDrivePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">My Drive</h1>
      <Suspense>
        <MyDriveContent />
      </Suspense>
    </div>
  );
};

export default MyDrivePage;
