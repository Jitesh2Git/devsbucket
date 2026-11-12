"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { restoreItem } from "@/app/drive/trash-actions";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { restoreMessage } from "@/lib/restore-message";

type TrashedFolderProps = {
  folder: { id: string; name: string };
  // True when the user trashed this folder itself; false when it went to
  // the trash with a folder around it (restore that one instead).
  isTrashRoot: boolean;
};

// An old link to a folder that's now in the trash.
const TrashedFolder = ({ folder, isTrashRoot }: TrashedFolderProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState(false);

  const restore = async () => {
    setRestoring(true);
    const result = await restoreItem({ itemId: folder.id });
    setRestoring(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(restoreMessage(result));
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    router.refresh();
  };

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trash2 />
        </EmptyMedia>
        <EmptyTitle>"{folder.name}" is in the trash</EmptyTitle>
        <EmptyDescription>
          {isTrashRoot
            ? "Restore it to open it again."
            : "It's inside a folder that's in the trash. Restore that folder from the Trash."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        {isTrashRoot && (
          <Button onClick={restore} disabled={restoring}>
            {restoring && <Spinner />}
            Restore
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/drive/trash">Open Trash</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};

export default TrashedFolder;
