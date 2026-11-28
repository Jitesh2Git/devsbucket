"use client";

import type { ShareFormInput } from "@devsbucket/shared/sharing";
import { roleLabel, shareFormSchema } from "@devsbucket/shared/sharing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { shareItems } from "@/app/drive/share-actions";
import RoleMenu from "@/components/drive/role-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type ShareSelectionDialogProps = {
  // The selected items; null when closed.
  items: { id: string; name: string }[] | null;
  onClose: () => void;
};

const count = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

// Share from the selection bar (multi-select): one person, one role, every
// selected item. Only adds or raises access, never lowers it; who has what
// on one item is still that item's own Share dialog.
const ShareSelectionForm = ({
  items,
  onClose,
}: {
  items: { id: string; name: string }[];
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const form = useForm<ShareFormInput>({
    resolver: zodResolver(shareFormSchema),
    defaultValues: { person: "", role: "viewer" },
  });

  const onShare = async (values: ShareFormInput) => {
    const result = await shareItems({ itemIds: items.map((item) => item.id), ...values });
    if (result.error !== null) {
      form.setError("person", { message: result.error });
      return;
    }
    const { name, shared, unchanged, failed, firstError } = result;
    if (shared === 0 && unchanged === 0) {
      form.setError("person", { message: firstError ?? "Nothing was shared." });
      return;
    }
    onClose();
    const notes = [
      unchanged > 0 && `${count(unchanged)} already had this access or more.`,
      failed > 0 && `${count(failed)} couldn't be shared: ${firstError}`,
    ].filter(Boolean);
    toast.success(
      shared > 0
        ? `Shared ${count(shared)} with ${name} as ${roleLabel(values.role).toLowerCase()}`
        : `${name} already has access`,
      { description: notes.length > 0 ? notes.join(" ") : undefined },
    );
    // Each item's Share dialog shows the new person next time.
    await queryClient.invalidateQueries({ queryKey: ["sharing"] });
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Share {count(items.length)}</DialogTitle>
        <DialogDescription>
          Adds them to every one. Nobody loses access: someone who's already an Editor stays one.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onShare)} className="flex items-start gap-2">
        <Controller
          name="person"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="share-selection-person" className="sr-only">
                Email or username
              </FieldLabel>
              <Input
                {...field}
                id="share-selection-person"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Email or @username"
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
    </DialogContent>
  );
};

const ShareSelectionDialog = ({ items, onClose }: ShareSelectionDialogProps) => (
  <Dialog open={items !== null} onOpenChange={(open) => !open && onClose()}>
    {items && <ShareSelectionForm items={items} onClose={onClose} />}
  </Dialog>
);

export default ShareSelectionDialog;
