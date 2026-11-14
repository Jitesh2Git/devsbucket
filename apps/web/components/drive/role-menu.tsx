"use client";

import type { GrantRole } from "@devsbucket/shared/sharing";
import { roleLabel } from "@devsbucket/shared/sharing";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RoleMenuProps = {
  label: string;
  value: GrantRole;
  onChange: (role: GrantRole) => void;
  onRemove?: () => void;
  disabled?: boolean;
};

// Editor / Viewer, and (for an existing grant) Remove access. Used for
// people and for share links in the Share dialog.
const RoleMenu = ({ label, value, onChange, onRemove, disabled }: RoleMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label} disabled={disabled}>
          {roleLabel(value)}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as GrantRole)}>
          <DropdownMenuRadioItem value="editor">Editor</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="viewer">Viewer</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              Remove access
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleMenu;
