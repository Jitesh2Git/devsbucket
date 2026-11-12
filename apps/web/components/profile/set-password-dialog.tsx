"use client";

import { type SetPasswordInput, setPasswordSchema } from "@devsbucket/shared/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { setPassword } from "@/app/profile/actions";
import PasswordInput from "@/components/password-input";
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
import { Spinner } from "@/components/ui/spinner";

const EMPTY: SetPasswordInput = { newPassword: "", confirmPassword: "" };

// For GitHub-only accounts: choose a DevsBucket password (their GitHub
// password is never shared with us). Afterwards they can sign in with their
// email and this password, and disconnect GitHub if they want.
const SetPasswordDialog = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: EMPTY,
  });

  // Closing (or navigating away, which hides this page) clears the typed
  // passwords so they don't linger in the page.
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

  const onSubmit = async (values: SetPasswordInput) => {
    const result = await setPassword(values);
    if (result.error !== null) {
      form.setError("root", { message: result.error });
      return;
    }
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Set password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
            <DialogHeader>
              <DialogTitle>Set a password</DialogTitle>
              <DialogDescription>
                Sign in with your email and this password as well as GitHub. It's separate from your
                GitHub password.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Controller
                name="newPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="set-new-password">New password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="set-new-password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="confirmPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="set-confirm-password">Confirm password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="set-confirm-password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {form.formState.errors.root && (
                <FieldError>{form.formState.errors.root.message}</FieldError>
              )}
            </FieldGroup>
            <DialogFooter>
              <Button type="submit">
                {form.formState.isSubmitting && <Spinner />}
                Set password
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SetPasswordDialog;
