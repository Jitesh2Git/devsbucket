"use client";

import { type SignInInput, signInSchema } from "@devsbucket/shared/auth";
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

const SignInForm = () => {
  const router = useRouter();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
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

  const onSubmit = async (values: SignInInput) => {
    setBusy("email");
    const { error } = await authClient.signIn.email(values);
    if (error) {
      setBusy(null);
      form.setError("root", { message: error.message ?? "Could not sign you in." });
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
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to DevsBucket.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={busy !== null} className="min-w-0">
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="sign-in-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id="sign-in-password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                    />
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
                  Sign in
                </Button>
              </Field>
              <FieldSeparator>or</FieldSeparator>
              <Field>
                <GitHubButton
                  mode="sign-in"
                  pending={busy === "github"}
                  onPendingChange={(pending) => setBusy(pending ? "github" : null)}
                />
                <FieldDescription className="text-center">
                  Have an invite? <Link href="/sign-up">Create an account</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
};

export default SignInForm;
