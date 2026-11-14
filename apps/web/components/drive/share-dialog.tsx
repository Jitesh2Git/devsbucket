"use client";

import type { ShareFormInput, SharingSetting } from "@devsbucket/shared/sharing";
import { roleLabel, shareFormSchema } from "@devsbucket/shared/sharing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  changeAccess,
  changeSharingSetting,
  getSharing,
  removeAccess,
  type SharingView,
  shareWithPerson,
} from "@/app/drive/share-actions";
import RoleMenu from "@/components/drive/role-menu";
import ShareLinkSection from "@/components/drive/share-link-section";
import ShareOwnershipSection from "@/components/drive/share-ownership-section";
import ShareRequestsSection from "@/components/drive/share-requests-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { sharingQueryKey } from "@/lib/query-keys";

export type ShareTarget = { id: string; name: string };

const SETTINGS: { key: SharingSetting; label: string; description: string }[] = [
  {
    key: "editorsCanShare",
    label: "Editors can share",
    description: "Editors can add people and change their access.",
  },
];

type ShareBodyProps = { item: ShareTarget; sharing: SharingView };

const ShareBody = ({ item, sharing }: ShareBodyProps) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const form = useForm<ShareFormInput>({
    resolver: zodResolver(shareFormSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: sharingQueryKey(item.id) });

  // Runs a change; shows its error, or `done` and the fresh list.
  const run = async (change: () => Promise<{ error: string | null }>, done: string) => {
    setBusy(true);
    const result = await change();
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
    } else {
      toast.success(done);
    }
    await refresh();
  };

  const onShare = async (values: ShareFormInput) => {
    const result = await shareWithPerson({ itemId: item.id, ...values });
    if (result.error !== null) {
      form.setError("email", { message: result.error });
      return;
    }
    form.reset({ email: "", role: values.role });
    toast.success(
      result.result === "added"
        ? `Shared with ${result.name}`
        : `${result.name} is now ${roleLabel(values.role).toLowerCase()}`,
    );
    await refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={form.handleSubmit(onShare)} className="flex items-start gap-2">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="share-email" className="sr-only">
                Email
              </FieldLabel>
              <Input
                {...field}
                id="share-email"
                type="email"
                placeholder="Email of someone with an account"
                aria-invalid={fieldState.invalid}
                disabled={form.formState.isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="role"
          control={form.control}
          render={({ field }) => (
            <RoleMenu label="Role for new person" value={field.value} onChange={field.onChange} />
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          Share
        </Button>
      </form>

      <ShareRequestsSection itemId={item.id} requests={sharing.requests} onChanged={refresh} />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">People with access</h3>
        <ul aria-label="People with access" className="flex flex-col divide-y">
          <li className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {sharing.owner.name}
                {sharing.owner.userId === sharing.me && " (you)"}
              </div>
              <div className="truncate text-xs text-muted-foreground">{sharing.owner.email}</div>
            </div>
            <span className="text-sm text-muted-foreground">Owner</span>
          </li>
          {sharing.people.map((person) => (
            <li key={person.userId} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {person.name}
                  {person.userId === sharing.me && " (you)"}
                </div>
                <div className="truncate text-xs text-muted-foreground">{person.email}</div>
                {person.direct && person.inherited && person.role !== person.direct && (
                  <div className="text-xs text-muted-foreground">
                    {roleLabel(person.role)} from {person.inherited.name}
                  </div>
                )}
              </div>
              {person.direct ? (
                <RoleMenu
                  label={`Access for ${person.email}`}
                  value={person.direct}
                  disabled={busy}
                  onChange={(role) =>
                    run(
                      () => changeAccess({ itemId: item.id, userId: person.userId, role }),
                      `${person.name} is now ${roleLabel(role).toLowerCase()}`,
                    )
                  }
                  onRemove={() =>
                    run(
                      () => removeAccess({ itemId: item.id, userId: person.userId }),
                      `Removed ${person.name}`,
                    )
                  }
                />
              ) : (
                // Given on a folder above: changed there, not here.
                <span className="text-right text-sm text-muted-foreground">
                  {roleLabel(person.role)}, from {person.inherited?.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Link</h3>
        <ShareLinkSection itemId={item.id} link={sharing.link} onChanged={refresh} />
      </section>

      {sharing.canTransfer && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Owner</h3>
          <ShareOwnershipSection item={item} sharing={sharing} onChanged={refresh} />
        </section>
      )}

      {sharing.canChangeSettings && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Settings</h3>
          {SETTINGS.map((setting) => {
            const own = sharing.settings.own[setting.key];
            const effective = sharing.settings.effective[setting.key];
            // Turned off on a folder above: it stays off here.
            const offAbove = own && !effective;
            return (
              <Field key={setting.key} orientation="horizontal">
                <Checkbox
                  id={`share-${setting.key}`}
                  checked={effective}
                  disabled={busy || offAbove}
                  onCheckedChange={(checked) =>
                    run(
                      () =>
                        changeSharingSetting({
                          itemId: item.id,
                          setting: setting.key,
                          value: checked === true,
                        }),
                      `${setting.label}: ${checked === true ? "on" : "off"}`,
                    )
                  }
                />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={`share-${setting.key}`} className="font-normal">
                    {setting.label}
                  </FieldLabel>
                  <FieldDescription>
                    {offAbove ? "Turned off on a folder above." : setting.description}
                  </FieldDescription>
                </div>
              </Field>
            );
          })}
        </section>
      )}
    </div>
  );
};

// Loads who has access when it opens; mounted per item (key={item.id}).
const ShareContent = ({ item }: { item: ShareTarget }) => {
  const sharing = useQuery({
    queryKey: sharingQueryKey(item.id),
    queryFn: async () => {
      const result = await getSharing({ itemId: item.id });
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result;
    },
    retry: false,
    // Other people change access too (and open links): fetch it again each
    // time the dialog opens, not the app's usual minute-old copy.
    staleTime: 0,
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader className="min-w-0">
        <DialogTitle className="truncate">Share "{item.name}"</DialogTitle>
        <DialogDescription>Share with people who have a DevsBucket account.</DialogDescription>
      </DialogHeader>
      {sharing.isPending ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : sharing.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {sharing.error.message}
        </p>
      ) : (
        <ShareBody item={item} sharing={sharing.data} />
      )}
    </DialogContent>
  );
};

type ShareDialogProps = { item: ShareTarget | null; onClose: () => void };

const ShareDialog = ({ item, onClose }: ShareDialogProps) => {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && <ShareContent key={item.id} item={item} />}
    </Dialog>
  );
};

export default ShareDialog;
