"use client";

import {
  type CollabReply,
  type VersionMessageFormInput,
  versionMessageFormSchema,
} from "@devsbucket/shared/editing";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookmarkPlus } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
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

const EMPTY: VersionMessageFormInput = { message: "" };

// "Save version" (decision 0015): the live text as a named version, with a
// message. `save` asks realtime and resolves with its answer.
const SaveVersionDialog = ({ save }: { save: (message: string) => Promise<CollabReply> }) => {
  const [open, setOpen] = useState(false);
  const form = useForm<VersionMessageFormInput>({
    resolver: zodResolver(versionMessageFormSchema),
    defaultValues: EMPTY,
  });

  // Closing, or navigating away (which only hides this page), starts the
  // next one from an empty form.
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

  const onSubmit = async ({ message }: VersionMessageFormInput) => {
    const answer = await save(message);
    if (answer.type === "version-error") {
      form.setError("message", { message: answer.error });
      return;
    }
    onOpenChange(false);
    if (answer.type === "version-saved") {
      toast.success(`Saved as version ${answer.number}`);
    } else if (answer.type === "version-unchanged") {
      toast.info(`Nothing changed since version ${answer.number}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus />
          Save version
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
            <DialogHeader>
              <DialogTitle>Save version</DialogTitle>
              <DialogDescription>
                Keep the text as it is now, with a note, to come back to later.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Controller
                name="message"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="version-message">What changed</FieldLabel>
                    <Input
                      {...field}
                      id="version-message"
                      placeholder="First draft"
                      autoComplete="off"
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
                Save
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SaveVersionDialog;
