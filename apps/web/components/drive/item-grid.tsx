import type { ReactNode } from "react";
import ItemIcon from "@/components/drive/item-icon";

type CardItem = { id: string; type: "folder" | "file"; name: string; mimeType: string | null };

type ItemCardProps = {
  item: CardItem;
  // The name: a link or button (ItemName with `card`) covers the whole card.
  name: ReactNode;
  // One muted line under the name (size, date, owner…).
  details: ReactNode;
  // The ⋯ menu, top right, above the covering link.
  menu?: ReactNode;
  // Buttons along the bottom (the Trash's Restore and Delete forever).
  footer?: ReactNode;
};

// The grid view's card: a big icon, the name and a line of details.
export const ItemCard = ({ item, name, details, menu, footer }: ItemCardProps) => (
  <li className="relative flex min-w-0 flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring">
    <div className="flex items-start justify-between gap-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <ItemIcon item={item} className="size-5 text-muted-foreground" />
      </span>
      {menu && <div className="relative z-10">{menu}</div>}
    </div>
    <div className="flex min-w-0 flex-col gap-1">
      {name}
      <p className="truncate text-xs text-muted-foreground">{details}</p>
    </div>
    {footer && <div className="relative z-10 flex flex-wrap gap-1">{footer}</div>}
  </li>
);

// The grid itself: as many columns as fit the width.
export const ItemGrid = ({ label, children }: { label: string; children: ReactNode }) => (
  <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {children}
  </ul>
);
