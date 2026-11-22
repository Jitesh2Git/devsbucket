"use client";

import { type SetNameInput, setNameSchema } from "@devsbucket/shared/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { updateName } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

// Your display name, as others see it (like the username form).
const NameForm = ({ name }: { name: string }) => {
  const router = useRouter();
  const form = useForm<SetNameInput>({
    resolver: zodResolver(setNameSchema),
    defaultValues: { name },
  });

  const onSubmit = async (values: SetNameInput) => {
    const result = await updateName(values);
    if (result.error !== null) {
      form.setError("name", { message: result.error });
      return;
    }
    // The saved value becomes the new "unchanged" state, so Save greys out.
    form.reset({ name: result.name });
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <fieldset disabled={form.formState.isSubmitting} className="min-w-0">
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="profile-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="profile-name"
                  autoComplete="name"
                  aria-invalid={fieldState.invalid}
                />
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

export default NameForm;
