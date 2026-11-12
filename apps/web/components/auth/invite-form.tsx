"use client";

import { type InviteCodeInput, inviteCodeSchema } from "@devsbucket/shared/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { acceptInvite } from "@/app/(auth)/sign-up/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const InviteForm = () => {
  const form = useForm<InviteCodeInput>({
    resolver: zodResolver(inviteCodeSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: InviteCodeInput) => {
    const result = await acceptInvite(values);
    if (result.error) {
      form.setError("code", { message: result.error });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join DevsBucket</CardTitle>
        <CardDescription>DevsBucket is invite-only. Enter the code you were given.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-code">Invite code</FieldLabel>
                  <Input
                    {...field}
                    id="invite-code"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Field>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Continue
              </Button>
              <FieldDescription className="text-center">
                Already have an account? <Link href="/sign-in">Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};

export default InviteForm;
