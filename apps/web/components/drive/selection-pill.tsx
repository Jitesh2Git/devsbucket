"use client";

import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SelectionPillProps = {
  count: number;
  onClear: () => void;
  // The page's actions (PillButton); the divider shows when there are any.
  children?: ReactNode;
  className?: string;
};

// The selection bar (multi-select): a pill in the accent colour, like the
// selected rows, so it reads as "this is about what you picked" (the tint
// over an opaque background, since on a phone it floats over the header).
// From md up the page puts it in its header row (folder pages: in the
// buttons' place; Trash, Shared with me, Recent: next to the view toggle),
// exactly as tall as the buttons, so nothing moves. On a phone there's no
// room next to the heading, so it covers the site header, like Drive's
// app (the bottom is the toasts' and the uploads panel's). Pops in, unless
// reduce motion.
const SelectionPill = ({ count, onClear, children, className }: SelectionPillProps) => (
  <div
    role="toolbar"
    aria-label="Selection"
    className={cn(
      "flex items-center gap-1 rounded-full border border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 p-1 shadow-sm md:py-px motion-safe:animate-in motion-safe:fade-in max-md:fixed max-md:inset-x-3 max-md:top-1.5 max-md:z-50 max-md:shadow-lg max-md:motion-safe:slide-in-from-top-4 md:motion-safe:zoom-in-95",
      className,
    )}
  >
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full hover:bg-primary/15"
      aria-label="Clear selection"
      onClick={onClear}
    >
      <X />
    </Button>
    <span className="pr-1 text-sm font-medium whitespace-nowrap text-primary-text">
      {count} selected
    </span>
    {children && <span aria-hidden className="mx-1 h-5 w-px bg-primary/30 max-md:ml-auto" />}
    {children}
  </div>
);

type PillButtonProps = ComponentProps<typeof Button> & {
  icon: ReactNode;
  label: string;
  // Delete and trash turn red on hover.
  destructive?: boolean;
};

// One action in the pill: icon and label from md up, icon only on a phone
// (the label stays for screen readers).
export const PillButton = ({ icon, label, destructive, className, ...props }: PillButtonProps) => (
  <Button
    variant="ghost"
    size="sm"
    className={cn(
      "rounded-full",
      destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-primary/15",
      className,
    )}
    {...props}
  >
    {icon}
    <span className="sr-only md:not-sr-only">{label}</span>
  </Button>
);

export default SelectionPill;
