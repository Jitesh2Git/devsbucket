"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { copyFile } from "@/app/drive/copy-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// "Make a copy" in a file's menu (Phase 5): everyone who can see the file
// may copy it. The server decides where the copy goes and says so.
const CopyMenuItem = ({ item }: { item: { id: string; name: string } }) => {
  const queryClient = useQueryClient();
  return (
    <DropdownMenuItem
      onSelect={async () => {
        const result = await copyFile({ itemId: item.id });
        if (result.error !== null) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.inPlace
            ? `Copied as "${result.name}"`
            : `Copied to your My Drive as "${result.name}"`,
        );
        // The folder it landed in (realtime says so too, a moment later).
        await queryClient.invalidateQueries({ queryKey: ["items"] });
      }}
    >
      <Copy />
      Make a copy
    </DropdownMenuItem>
  );
};

export default CopyMenuItem;
