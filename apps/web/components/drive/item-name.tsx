import { isEditableName } from "@devsbucket/shared/editing";
import { File, Folder } from "lucide-react";
import Link from "next/link";

type ItemNameProps = {
  item: { id: string; type: "folder" | "file" | "note"; name: string; mimeType: string | null };
  onPreview: () => void;
};

// A row's name: folders open their page, text files open in the editor
// (Phase 4), and other files open the preview.
const ItemName = ({ item, onPreview }: ItemNameProps) => {
  if (item.type === "folder") {
    return (
      <Link
        href={`/drive/folders/${item.id}`}
        className="flex items-center gap-2 font-medium hover:underline"
      >
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.name}</span>
      </Link>
    );
  }
  if (isEditableName(item.name, item.mimeType)) {
    return (
      <Link href={`/drive/files/${item.id}`} className="flex items-center gap-2 hover:underline">
        <File className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.name}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onPreview}
      className="flex w-full items-center gap-2 text-left hover:underline"
    >
      <File className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{item.name}</span>
    </button>
  );
};

export default ItemName;
