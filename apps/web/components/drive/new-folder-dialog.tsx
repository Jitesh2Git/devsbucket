"use client";

import { type NameFormInput, nameFormSchema } from "@devsbucket/shared/item";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { createFolder } from "@/app/drive/actions";
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

const EMPTY: NameFormInput = { name: "" };

const NewFolderDialog = ({ parentId }: { parentId: string | null }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<NameFormInput>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: EMPTY,
  });

  // Closing, or navigating away (which only hides this page), starts the
  // next folder from an empty form.
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset(EMPTY);
  };
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      form.reset(EMPTY);
    };
  }, [form]);

  const onSubmit = async ({ name }: NameFormInput) => {
    const result = await createFolder({ parentId, name });
    if (result.error !== null) {
      // A taken name is shown on the field, so the user can change it.
      form.setError("name", { message: result.error });
      return;
    }
    onOpenChange(false);
    await queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <FolderPlus />
          New folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
              <DialogDescription>Names must be unique in this folder.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="new-folder-name">Folder name</FieldLabel>
                    <Input
                      {...field}
                      id="new-folder-name"
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

export default NewFolderDialog;
