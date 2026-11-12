"use client";

import type { ListedItem } from "@devsbucket/db/items";
import { type NameFormInput, nameFormSchema, renameSelection } from "@devsbucket/shared/item";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { renameItem } from "@/app/drive/item-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { foldersQueryKey, itemsQueryKey } from "@/lib/query-keys";

export type ItemRef = Pick<ListedItem, "id" | "name" | "type">;

type RenameFormProps = { item: ItemRef; parentId: string | null; onDone: () => void };

// Mounted per item (key={item.id}), so the form starts from that item's name.
const RenameForm = ({ item, parentId, onDone }: RenameFormProps) => {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement | null>(null);
  const form = useForm<NameFormInput>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: item.name },
  });

  const onSubmit = async ({ name }: NameFormInput) => {
    if (name === item.name) {
      onDone();
      return;
    }
    const result = await renameItem({ itemId: item.id, name });
    if (result.error !== null) {
      form.setError("name", { message: result.error });
      return;
    }
    onDone();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) }),
      queryClient.invalidateQueries({ queryKey: foldersQueryKey(parentId) }),
    ]);
  };

  return (
    <DialogContent
      // Select the name without its extension, like Finder and Drive.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        input.current?.focus();
        input.current?.setSelectionRange(0, renameSelection(item.name, item.type === "folder"));
      }}
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="rename-name">New name</FieldLabel>
                  <Input
                    {...field}
                    ref={(element) => {
                      field.ref(element);
                      input.current = element;
                    }}
                    id="rename-name"
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
              Rename
            </Button>
          </DialogFooter>
        </fieldset>
      </form>
    </DialogContent>
  );
};

const RenameDialog = ({
  item,
  parentId,
  onClose,
}: {
  item: ItemRef | null;
  parentId: string | null;
  onClose: () => void;
}) => {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && <RenameForm key={item.id} item={item} parentId={parentId} onDone={onClose} />}
    </Dialog>
  );
};

export default RenameDialog;
