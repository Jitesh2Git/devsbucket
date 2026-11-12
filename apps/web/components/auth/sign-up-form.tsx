"use client";

import { type SignUpInput, signUpSchema } from "@devsbucket/shared/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import GitHubButton from "@/components/auth/github-button";
import PasswordInput from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

type SignUpFormProps = {
  // Set when the invite only works for one email address.
  lockedEmail: string | null;
};

const SignUpForm = ({ lockedEmail }: SignUpFormProps) => {
  const router = useRouter();
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: lockedEmail ?? "", password: "" },
  });

  // Which action is in flight. While it's set, the whole form is disabled
  // (<fieldset disabled>) so nothing can be clicked twice or mixed.
  const [busy, setBusy] = useState<"email" | "github" | null>(null);

  // Next.js keeps this page alive, hidden, after we navigate away (React
  // <Activity>). After a successful submit, clear it as it hides, so the
  // password isn't left in the page and the form isn't stuck "busy" when
  // someone comes back (Back button, or after signing out).
  const submitted = useRef(false);
  useLayoutEffect(() => {
    return () => {
      if (submitted.current) {
        submitted.current = false;
        setBusy(null);
        form.reset();
      }
    };
  }, [form]);

  const onSubmit = async (values: SignUpInput) => {
    setBusy("email");
    // The invite code travels in the httpOnly cookie, not in this body.
    const { error } = await authClient.signUp.email(values);
    if (error) {
      setBusy(null);
      form.setError("root", { message: error.message ?? "Could not create your account." });
      return;
    }
    // Stay busy until the next page has loaded.
    submitted.current = true;
    router.push("/");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Your invite code is valid. Choose how you'll sign in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={busy !== null} className="min-w-0">
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-up-name">Name</FieldLabel>
                    <Input
                      {...field}
                      id="sign-up-name"
                      autoComplete="name"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="sign-up-email"
                      type="email"
                      autoComplete="email"
                      readOnly={lockedEmail !== null}
                      aria-invalid={fieldState.invalid}
                    />
                    {lockedEmail !== null && (
                      <FieldDescription>This invite is for this email address.</FieldDescription>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="sign-up-password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>At least 8 characters.</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {form.formState.errors.root && (
                <FieldError>{form.formState.errors.root.message}</FieldError>
              )}
              <Field>
                <Button type="submit">
                  {busy === "email" && <Spinner />}
                  Create account
                </Button>
              </Field>
              <FieldSeparator>or</FieldSeparator>
              <Field>
                <GitHubButton
                  mode="sign-up"
                  pending={busy === "github"}
                  onPendingChange={(pending) => setBusy(pending ? "github" : null)}
                />
                <FieldDescription className="text-center">
                  Already have an account? <Link href="/sign-in">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
};

export default SignUpForm;
