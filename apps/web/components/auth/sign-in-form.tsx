"use client";

import { type SignInInput, signInSchema } from "@devsbucket/shared/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { authClient } from "@/lib/auth-client";

const SignInForm = () => {
  const router = useRouter();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInInput) => {
    const { error } = await authClient.signIn.email(values);
    if (error) {
      form.setError("root", { message: error.message ?? "Could not sign you in." });
      return;
    }
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Sign in
              </Button>
            </Field>
            <FieldSeparator>or</FieldSeparator>
            <Field>
              <GitHubButton mode="sign-in" />
              <FieldDescription className="text-center">
                Have an invite? <Link href="/sign-up">Create an account</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};

export default SignInForm;
