"use client";

import { type NewFileFormInput, newFileFormSchema } from "@devsbucket/shared/editing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { createTextFile } from "@/app/drive/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { itemsQueryKey } from "@/lib/query-keys";

const EMPTY: NewFileFormInput = { name: "" };

type NewFileDialogProps = {
  parentId: string | null;
  // Opened from the folder's toolbar or its ⋯ menu on phones (FolderActions).
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// "New file" (Phase 4): names an empty text file, then opens it in the editor.
const NewFileDialog = ({ parentId, open, onOpenChange: setOpen }: NewFileDialogProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<NewFileFormInput>({
    resolver: zodResolver(newFileFormSchema),
    defaultValues: EMPTY,
  });

  // Closing, or navigating away (which only hides this page), starts the
  // next file from an empty form.
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset(EMPTY);
  };
  useLayoutEffect(() => {
    return () => form.reset(EMPTY);
  }, [form]);

  const onSubmit = async ({ name }: NewFileFormInput) => {
    const result = await createTextFile({ parentId, name });
    if (result.error !== null) {
      // A taken name is shown on the field, so the user can change it.
      form.setError("name", { message: result.error });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) });
    router.push(`/drive/files/${result.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
            <DialogHeader>
              <DialogTitle>New file</DialogTitle>
              <DialogDescription>
                An empty text file, opened in the editor. Names must be unique in this folder.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="new-file-name">File name</FieldLabel>
                    <Input
                      {...field}
                      id="new-file-name"
                      placeholder="notes.md"
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
            <DialogFooter>
              <Button type="submit">
                {form.formState.isSubmitting && <Spinner />}
                Create
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewFileDialog;
