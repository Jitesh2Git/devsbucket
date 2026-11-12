import { Trash2 } from "lucide-react";
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

export const metadata: Metadata = { title: "Trash" };

// Step 10 replaces the empty state with the trashed items.
const TrashContent = async () => {
  await requireSession();

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trash2 />
        </EmptyMedia>
        <EmptyTitle>Trash is empty</EmptyTitle>
        <EmptyDescription>Items in the trash are deleted forever after 30 days.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

const TrashPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
      <Suspense>
        <TrashContent />
      </Suspense>
    </div>
  );
};

export default TrashPage;
