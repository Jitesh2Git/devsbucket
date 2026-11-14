"use client";

import {
  REQUEST_MESSAGE_MAX,
  type RequestFormInput,
  requestFormSchema,
} from "@devsbucket/shared/access-requests";
import type { GrantRole } from "@devsbucket/shared/sharing";
import { roleLabel } from "@devsbucket/shared/sharing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { requestAccess } from "@/app/drive/request-actions";
import RoleMenu from "@/components/drive/role-menu";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type RequestAccessFormProps = {
  itemId: string;
  // A request already waiting for an answer, if any.
  pendingRole: GrantRole | null;
};

// Ask for Viewer or Editor access, with a short note for the owner.
const RequestAccessForm = ({ itemId, pendingRole }: RequestAccessFormProps) => {
  const [sent, setSent] = useState<GrantRole | null>(pendingRole);
  const form = useForm<RequestFormInput>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: { role: "viewer", message: "" },
  });

  const onSubmit = async (values: RequestFormInput) => {
    const result = await requestAccess({ itemId, ...values });
    if (result.error !== null) {
      form.setError("root", { message: result.error });
      return;
    }
    setSent(values.role);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm">
        <p role="status">
          Request sent for {roleLabel(sent).toLowerCase()} access. You can open it once it's
          approved.
        </p>
        <Button variant="link" size="sm" onClick={() => setSent(null)}>
          Change request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-3 text-left">
      <Controller
        name="role"
        control={form.control}
        render={({ field }) => (
          <div className="flex items-center gap-2 text-sm">
            <span>Ask for</span>
            <RoleMenu label="Role to ask for" value={field.value} onChange={field.onChange} />
            <span>access</span>
          </div>
        )}
      />
      <Controller
        name="message"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="request-message">Message (optional)</FieldLabel>
            <Textarea
              {...field}
              id="request-message"
              maxLength={REQUEST_MESSAGE_MAX}
              placeholder="Why you need it"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Spinner />}
        Request access
      </Button>
    </form>
  );
};

export default RequestAccessForm;
