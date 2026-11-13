"use client";

import { type AuthzAdmin, canAdmin } from "@devsbucket/authz/admin";
import type { AdminUser } from "@devsbucket/db/admin";
import { formatBytes } from "@devsbucket/shared/bytes";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import {
  removeUser,
  resetPassword,
  signOutUser,
  updateAdmin,
  updateQuota,
} from "@/app/admin/actions";
import LocalDate from "@/components/local-date";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Which dialog is open, and for whom.
type Open =
  | { kind: "reset"; user: AdminUser }
  | { kind: "password"; user: AdminUser; password: string }
  | { kind: "quota"; user: AdminUser }
  | { kind: "remove"; user: AdminUser }
  | null;

type UsersCardProps = { users: AdminUser[]; me: AuthzAdmin };

// Every account, with a menu per row. The menu only shows what canAdmin()
// allows (nothing that could lock you out of your own account); the server
// actions check it again.
const UsersCard = ({ users, me }: UsersCardProps) => {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Leaving the page closes any dialog (and forgets a shown password).
  useLayoutEffect(() => () => setOpen(null), []);

  const show = (next: Open) => {
    setText(next?.kind === "quota" ? formatBytes(next.user.storageQuota) : "");
    setError(null);
    setOpen(next);
  };

  // Runs an action; on success shows `message` and reloads the list.
  const run = async <T extends { error: string | null }>(
    action: () => Promise<T>,
    message: (result: T) => string,
  ) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return null;
    }
    toast.success(message(result));
    router.refresh();
    return result;
  };

  const onReset = async () => {
    if (open?.kind !== "reset") return;
    const { user } = open;
    setBusy(true);
    const result = await resetPassword({ userId: user.id });
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      show(null);
      return;
    }
    show({ kind: "password", user, password: result.password });
    router.refresh();
  };

  const onQuota = async (event: FormEvent) => {
    event.preventDefault();
    if (open?.kind !== "quota") return;
    setBusy(true);
    const result = await updateQuota({ userId: open.user.id, size: text });
    setBusy(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    toast.success(`${open.user.email}: quota ${result.quota}`);
    show(null);
    router.refresh();
  };

  const onRemove = async () => {
    if (open?.kind !== "remove") return;
    const { user } = open;
    await run(
      () => removeUser({ userId: user.id }),
      (result) => `Removed ${user.email} and ${"files" in result ? result.files : 0} file(s)`,
    );
    show(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Everyone with an account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table aria-label="Users">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="w-24">Role</TableHead>
              <TableHead className="w-44">Storage</TableHead>
              <TableHead className="w-24">Sessions</TableHead>
              <TableHead className="w-32">Joined</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="max-w-0">
                  <div className="truncate font-medium">
                    {user.name}
                    {user.id === me.id && " (you)"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.isAdmin ? "Admin" : "User"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBytes(user.storageUsed)} of {formatBytes(user.storageQuota)}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.sessions}</TableCell>
                <TableCell className="text-muted-foreground">
                  <LocalDate value={user.createdAt} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Actions for ${user.email}`}
                        disabled={busy}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canAdmin(me, "reset_password", user) && (
                        <DropdownMenuItem onSelect={() => show({ kind: "reset", user })}>
                          Reset password
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => show({ kind: "quota", user })}>
                        Set quota
                      </DropdownMenuItem>
                      {canAdmin(me, "set_admin", user) && (
                        <DropdownMenuItem
                          onSelect={() =>
                            run(
                              () => updateAdmin({ userId: user.id, isAdmin: !user.isAdmin }),
                              () =>
                                `${user.email} is ${user.isAdmin ? "no longer" : "now"} an admin`,
                            )
                          }
                        >
                          {user.isAdmin ? "Remove admin" : "Make admin"}
                        </DropdownMenuItem>
                      )}
                      {canAdmin(me, "sign_out", user) && (
                        <DropdownMenuItem
                          onSelect={() =>
                            run(
                              () => signOutUser({ userId: user.id }),
                              () => `${user.email} was signed out everywhere`,
                            )
                          }
                        >
                          Sign out everywhere
                        </DropdownMenuItem>
                      )}
                      {canAdmin(me, "remove_user", user) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => show({ kind: "remove", user })}
                          >
                            Remove user
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog open={open?.kind === "reset"} onOpenChange={(next) => !next && show(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password for {open?.user.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They get a new random password and are signed out everywhere. Their old password stops
              working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={onReset}>
              {busy && <Spinner />}
              Reset password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open?.kind === "password"} onOpenChange={(next) => !next && show(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {open?.user.email}</DialogTitle>
            <DialogDescription>
              Send it to them privately. It isn't shown again; they can change it in Profile.
            </DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            aria-label="New password"
            className="text-center font-mono"
            value={open?.kind === "password" ? open.password : ""}
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (open?.kind !== "password") return;
                await navigator.clipboard.writeText(open.password);
                toast.success("Password copied");
              }}
            >
              Copy password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open?.kind === "quota"} onOpenChange={(next) => !next && show(null)}>
        <DialogContent>
          <form onSubmit={onQuota}>
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Set quota for {open?.user.email}</DialogTitle>
                <DialogDescription>
                  Using {formatBytes(open?.user.storageUsed ?? 0)} now. Below that, their uploads
                  stop until they free up space.
                </DialogDescription>
              </DialogHeader>
              <Field data-invalid={error !== null}>
                <FieldLabel htmlFor="quota-size">Quota</FieldLabel>
                <Input
                  id="quota-size"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="5GB"
                  aria-invalid={error !== null}
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
              <DialogFooter>
                <Button type="submit">
                  {busy && <Spinner />}
                  Save
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={open?.kind === "remove"} onOpenChange={(next) => !next && show(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {open?.user.email} forever?</AlertDialogTitle>
            <AlertDialogDescription>
              Their account and everything in their drive (
              {formatBytes(open?.user.storageUsed ?? 0)}) are deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="remove-confirm">Type their email to confirm</FieldLabel>
            <Input
              id="remove-confirm"
              value={text}
              onChange={(event) => setText(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy || text.trim() !== open?.user.email}
              onClick={onRemove}
            >
              {busy && <Spinner />}
              Remove forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default UsersCard;
