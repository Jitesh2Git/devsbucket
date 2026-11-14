"use client";

import {
  type LinkExpiry,
  linkExpiryLabels,
  linkExpirySchema,
  shareLinkPath,
} from "@devsbucket/shared/share-links";
import type { GrantRole } from "@devsbucket/shared/sharing";
import { roleLabel } from "@devsbucket/shared/sharing";
import { ChevronDown, Copy, Link2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
  changeShareLink,
  createShareLink,
  disableShareLink,
  type SharingView,
} from "@/app/drive/share-actions";
import RoleMenu from "@/components/drive/role-menu";
import LocalDate from "@/components/local-date";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type ExpiryMenuProps = {
  label: string;
  // What the button says: the choice, or the link's current expiry.
  text: ReactNode;
  value?: LinkExpiry;
  onChange: (expiry: LinkExpiry) => void;
  disabled?: boolean;
};

const ExpiryMenu = ({ label, text, value, onChange, disabled }: ExpiryMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label} disabled={disabled}>
          {text}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(linkExpirySchema.parse(next))}
        >
          {linkExpirySchema.options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {option === "never" ? "Never expires" : `Expires in ${linkExpiryLabels[option]}`}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type ShareLinkSectionProps = {
  itemId: string;
  link: SharingView["link"];
  // Refetch the dialog's data after a change.
  onChanged: () => Promise<unknown>;
};

// The Share dialog's link (decision 0008): one per item, for signed-in
// people only. Create it with a role and expiry; then copy, change, reset
// (new token) or disable it.
const ShareLinkSection = ({ itemId, link, onChanged }: ShareLinkSectionProps) => {
  const [role, setRole] = useState<GrantRole>("viewer");
  const [expiry, setExpiry] = useState<LinkExpiry>("never");
  const [busy, setBusy] = useState(false);

  const run = async (change: () => Promise<{ error: string | null }>, done: string) => {
    setBusy(true);
    const result = await change();
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
    } else {
      toast.success(done);
    }
    await onChanged();
  };

  if (!link) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Anyone signed in with the link gets</span>
        <RoleMenu label="Role for link" value={role} onChange={setRole} disabled={busy} />
        <ExpiryMenu
          label="Link expiry"
          text={expiry === "never" ? "Never expires" : `Expires in ${linkExpiryLabels[expiry]}`}
          value={expiry}
          onChange={setExpiry}
          disabled={busy}
        />
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(() => createShareLink({ itemId, role, expiry }), "Link created")}
        >
          <Link2 />
          Create link
        </Button>
      </div>
    );
  }

  // The dialog only renders in the browser (it opens on a click), so the
  // page's own address is known here.
  const url = `${window.location.origin}${shareLinkPath(link.token)}`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Share link"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="outline" onClick={copy}>
          <Copy />
          Copy
        </Button>
      </div>
      {link.expired && (
        <p className="text-sm text-destructive">
          This link has expired. Choose a new expiry, or reset it.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Anyone signed in with the link gets</span>
        <RoleMenu
          label="Link role"
          value={link.role}
          disabled={busy}
          onChange={(next) =>
            run(
              () => changeShareLink({ itemId, role: next }),
              `Link gives ${roleLabel(next).toLowerCase()} access`,
            )
          }
        />
        <ExpiryMenu
          label="Link expiry"
          disabled={busy}
          text={
            link.expired ? (
              "Expired"
            ) : link.expiresAt ? (
              <>
                Expires <LocalDate value={link.expiresAt} />
              </>
            ) : (
              "Never expires"
            )
          }
          onChange={(next) =>
            run(
              () => changeShareLink({ itemId, expiry: next }),
              next === "never" ? "Link never expires" : `Link expires in ${linkExpiryLabels[next]}`,
            )
          }
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Opened by {link.visitors} {link.visitors === 1 ? "person" : "people"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => createShareLink({ itemId, role: link.role }),
                "New link created. The old one no longer works.",
              )
            }
          >
            Reset link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={busy}
            onClick={() => run(() => disableShareLink({ itemId }), "Link disabled")}
          >
            Disable link
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShareLinkSection;
