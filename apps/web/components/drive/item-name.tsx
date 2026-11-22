import { isEditableName } from "@devsbucket/shared/editing";
import Link from "next/link";
import ItemIcon from "@/components/drive/item-icon";
import { cn } from "@/lib/utils";

type ItemNameProps = {
  item: { id: string; type: "folder" | "file"; name: string; mimeType: string | null };
  onPreview: () => void;
  // In a grid card: no small icon (the card has a big one), and the link or
  // button covers the whole card, so a click anywhere opens it.
  card?: boolean;
};

// A row's name: folders open their page, text files open in the editor
// (Phase 4), and other files open the preview.
const ItemName = ({ item, onPreview, card = false }: ItemNameProps) => {
  const className = cn(
    "flex min-w-0 items-center gap-2 text-left",
    card ? "font-medium outline-none after:absolute after:inset-0" : "hover:underline",
    item.type === "folder" && "font-medium",
  );
  const content = (
    <>
      {!card && <ItemIcon item={item} className="size-4 shrink-0 text-muted-foreground" />}
      <span className="truncate">{item.name}</span>
    </>
  );
  if (item.type === "folder") {
    return (
      <Link href={`/drive/folders/${item.id}`} className={className}>
        {content}
      </Link>
    );
  }
  if (isEditableName(item.name, item.mimeType)) {
    return (
      <Link href={`/drive/files/${item.id}`} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onPreview} className={cn(className, "w-full")}>
      {content}
    </button>
  );
};

export default ItemName;
