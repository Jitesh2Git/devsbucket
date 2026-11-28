"use client";

import type { ReactNode } from "react";
import type { useSelectableRows } from "@/lib/selection";

type Marquee = ReturnType<typeof useSelectableRows>;

type SelectableAreaProps = {
  listProps: Marquee["listProps"];
  box: Marquee["box"];
  // How many are selected, said by screen readers when it changes.
  count: number;
  children: ReactNode;
};

// The part of a list page where a drag draws a selection box: as tall as
// its scroll box, so a drag can start below the last row; no text
// selection while dragging, and no phone callout on a long press.
const SelectableArea = ({ listProps, box, count, children }: SelectableAreaProps) => (
  <div
    {...listProps}
    className="relative flex min-h-full flex-col items-center gap-4 select-none [-webkit-touch-callout:none]"
  >
    {children}
    <p className="sr-only" aria-live="polite">
      {count > 0 ? `${count} selected` : ""}
    </p>
    {box && (
      <div
        aria-hidden
        className="pointer-events-none absolute z-20 rounded-sm border border-primary bg-primary/10"
        style={box}
      />
    )}
  </div>
);

export default SelectableArea;
