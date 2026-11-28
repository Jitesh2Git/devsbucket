"use client";

import { X } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SelectionPillProps = {
  // Something is selected. When it turns false the pill fades out first.
  open: boolean;
  count: number;
  onClear: () => void;
  // The page's actions (PillButton); the divider shows when there are any.
  children?: ReactNode;
  className?: string;
};

// How long the pill takes to fade out (its duration-150).
const EXIT_MS = 150;

// The selection bar (multi-select): a pill in the accent colour, like the
// selected rows, so it reads as "this is about what you picked" (the tint
// over an opaque background, since on a phone it floats over the header).
// From md up the page puts it in its header row (folder pages: in the
// buttons' place; Trash, Shared with me, Recent: next to the view toggle),
// exactly as tall as the buttons, so nothing moves. On a phone there's no
// room next to the heading, so it covers the site header, like Drive's
// app (the bottom is the toasts' and the uploads panel's). It fades and
// grows in (slides down on a phone) and back out, unless reduce motion.
const SelectionPill = ({ open, count, onClear, children, className }: SelectionPillProps) => {
  // Stays in the page while it fades out, then leaves.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);
  // While it fades out the count is 0: keep showing the last one.
  const [shown, setShown] = useState(count);
  if (count > 0 && count !== shown) setShown(count);

  if (!mounted) return null;
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      // Fading out: already gone for clicks, screen readers and tests.
      inert={!open}
      aria-hidden={!open || undefined}
      className={cn(
        "flex items-center gap-1 rounded-full border border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 p-1 shadow-sm md:py-px max-md:fixed max-md:inset-x-3 max-md:top-1.5 max-md:z-50 max-md:shadow-lg",
        // In: grows and rises into place after the buttons start fading
        // (slides down on a phone). Out: quicker, same way back.
        "transition-[opacity,scale,translate] motion-reduce:transition-none",
        "starting:opacity-0 md:starting:translate-y-1 md:starting:scale-90 max-md:starting:-translate-y-6",
        open
          ? "delay-75 duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          : "opacity-0 duration-150 ease-in md:scale-90 max-md:-translate-y-6 motion-reduce:hidden",
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
        {shown} selected
      </span>
      {children && <span aria-hidden className="mx-1 h-5 w-px bg-primary/30 max-md:ml-auto" />}
      {children}
    </div>
  );
};

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
