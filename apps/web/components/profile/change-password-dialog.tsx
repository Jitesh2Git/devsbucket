"use client";

import { type ChangePasswordInput, changePasswordSchema } from "@devsbucket/shared/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLayoutEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import PasswordInput from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { authClient } from "@/lib/auth-client";

const EMPTY: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  revokeOtherSessions: true,
};

const ChangePasswordDialog = () => {
  const [open, setOpen] = useState(false);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
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

  const onSubmit = async ({
    currentPassword,
    newPassword,
    revokeOtherSessions,
  }: ChangePasswordInput) => {
    // Better Auth checks the current password and, if asked, signs out every
    // other device (this one gets a fresh session).
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
    if (error) {
      if (error.code === "INVALID_PASSWORD") {
        form.setError("currentPassword", { message: "Current password is incorrect" });
      } else {
        form.setError("root", { message: error.message ?? "Couldn't change your password." });
      }
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>Enter your current password, then a new one.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Controller
                name="currentPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="change-current-password">Current password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="change-current-password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="newPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="change-new-password">New password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="change-new-password"
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
                    <FieldLabel htmlFor="change-confirm-password">Confirm new password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="change-confirm-password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="revokeOtherSessions"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id="change-revoke-sessions"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <FieldLabel htmlFor="change-revoke-sessions" className="font-normal">
                      Sign out my other devices
                    </FieldLabel>
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
                Change password
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
