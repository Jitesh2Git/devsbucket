"use client";

import type { AdminInvite } from "@devsbucket/db/admin";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { createInvite, revokeInvite } from "@/app/admin/actions";
import LocalDate from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const status = (invite: AdminInvite) => {
  if (invite.usedAt) return `Used by ${invite.usedByEmail ?? "a removed user"}`;
  return invite.expired ? "Expired" : "Open";
};

const copy = async (code: string) => {
  await navigator.clipboard.writeText(code);
  toast.success("Invite code copied");
};

// Create invites (valid 7 days, optionally for one email) and revoke the
// ones nobody used. The list comes from the server; changes refresh it.
const InvitesCard = ({ invites }: { invites: AdminInvite[] }) => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await createInvite({ email: email.trim() });
    setBusy(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setError(null);
    setEmail("");
    toast.success(`Invite created: ${result.code}`, {
      action: { label: "Copy", onClick: () => copy(result.code) },
    });
    router.refresh();
  };

  const onRevoke = async (invite: AdminInvite) => {
    const result = await revokeInvite({ inviteId: invite.id });
    if (result.error !== null) {
      toast.error(result.error);
    } else {
      toast.success("Invite revoked");
    }
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invites</CardTitle>
        <CardDescription>Codes are valid for 7 days and work once.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onCreate} className="flex items-end gap-2">
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor="invite-email">Only for this email (optional)</FieldLabel>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error !== null}
              disabled={busy}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy && <Spinner />}
            Create invite
          </Button>
        </form>
        {error && <FieldError>{error}</FieldError>}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        ) : (
          <Table aria-label="Invites">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-40">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-mono">{invite.code}</TableCell>
                  <TableCell className="max-w-0 truncate">{invite.email ?? "Anyone"}</TableCell>
                  <TableCell className="text-muted-foreground">{status(invite)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <LocalDate value={invite.expiresAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    {!invite.usedAt && (
                      <span className="flex justify-end gap-1">
                        {!invite.expired && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Copy ${invite.code}`}
                            onClick={() => copy(invite.code)}
                          >
                            <Copy />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Revoke ${invite.code}`}
                          onClick={() => onRevoke(invite)}
                        >
                          Revoke
                        </Button>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default InvitesCard;
