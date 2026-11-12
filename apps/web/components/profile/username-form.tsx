"use client";

import { type SetUsernameInput, setUsernameSchema } from "@devsbucket/shared/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { updateUsername } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type UsernameFormProps = {
  username: string | null;
};

const UsernameForm = ({ username }: UsernameFormProps) => {
  const router = useRouter();
  const form = useForm<SetUsernameInput>({
    resolver: zodResolver(setUsernameSchema),
    defaultValues: { username: username ?? "" },
  });

  const onSubmit = async (values: SetUsernameInput) => {
    const result = await updateUsername(values);
    if (result.error !== null) {
      form.setError("username", { message: result.error });
      return;
    }
    // The saved value becomes the new "unchanged" state, so Save greys out.
    form.reset({ username: result.username });
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
        <FieldGroup>
          <Controller
            name="username"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="profile-username">Username</FieldLabel>
                <Input
                  {...field}
                  id="profile-username"
                  autoComplete="username"
                  spellCheck={false}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  3–32 characters: lowercase letters, numbers and hyphens.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Field orientation="horizontal">
            <Button type="submit" disabled={!form.formState.isDirty}>
              {form.formState.isSubmitting && <Spinner />}
              Save
            </Button>
          </Field>
        </FieldGroup>
      </fieldset>
    </form>
  );
};

export default UsernameForm;
