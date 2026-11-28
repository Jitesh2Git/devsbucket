import { isEditableName } from "@devsbucket/shared/editing";
import Link from "next/link";
import ItemIcon from "@/components/drive/item-icon";
import { cn } from "@/lib/utils";

type NamedItem = { id: string; type: "folder" | "file"; name: string; mimeType: string | null };

type ItemNameProps = {
  item: NamedItem;
  onPreview: () => void;
  // In a grid card: no small icon (the card has a big one), and the link or
  // button covers the whole card, so a click anywhere opens it.
  card?: boolean;
};

// Where an item opens: folders their page, text files the editor (Phase 4);
// null for other files, which open the preview.
export const itemHref = (item: NamedItem) => {
  if (item.type === "folder") return `/drive/folders/${item.id}`;
  if (isEditableName(item.name, item.mimeType)) return `/drive/files/${item.id}`;
  return null;
};

// A row's name: a link to its page, or a button for the preview. In a list
// with multi-select (lib/selection.tsx) the row decides what a click does;
// `data-item-name` tells it this is the name, not another control.
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
  const href = itemHref(item);
  if (href) {
    return (
      <Link href={href} className={className} data-item-name draggable={false}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onPreview} className={cn(className, "w-full")} data-item-name>
      {content}
    </button>
  );
};

export default ItemName;
