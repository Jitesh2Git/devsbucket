"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setViewMode, useViewMode } from "@/lib/view-mode";

const OPTIONS = [
  { mode: "table", label: "Table view", icon: List },
  { mode: "grid", label: "Grid view", icon: LayoutGrid },
] as const;

// Table or grid, for every list in the drive (remembered per browser).
const ViewToggle = () => {
  const mode = useViewMode();
  return (
    <fieldset className="flex shrink-0 rounded-lg border p-0.5">
      <legend className="sr-only">View</legend>
      {OPTIONS.map((option) => (
        <Button
          key={option.mode}
          variant={mode === option.mode ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={option.label}
          aria-pressed={mode === option.mode}
          onClick={() => setViewMode(option.mode)}
        >
          <option.icon />
        </Button>
      ))}
    </fieldset>
  );
};

export default ViewToggle;
