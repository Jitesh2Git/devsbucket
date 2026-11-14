"use client";

import {
  alwaysOnTypes,
  type NotificationType,
  notificationGroups,
} from "@devsbucket/shared/notifications";
import { useState } from "react";
import { toast } from "sonner";
import { setNotificationPreference } from "@/app/profile/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

type NotificationSettingsProps = {
  // The switches that differ from "on".
  prefs: Partial<Record<NotificationType, boolean>>;
  isAdmin: boolean;
};

// One switch per notification type (decision 0010). Always-on ones are shown,
// ticked and locked. Each change is saved as it's made.
const NotificationSettings = ({ prefs, isAdmin }: NotificationSettingsProps) => {
  const [enabled, setEnabled] = useState(prefs);

  const change = async (type: NotificationType, label: string, on: boolean) => {
    setEnabled((current) => ({ ...current, [type]: on }));
    const result = await setNotificationPreference({ type, enabled: on });
    if (result.error !== null) {
      setEnabled((current) => ({ ...current, [type]: !on }));
      toast.error(result.error);
      return;
    }
    toast.success(`${label}: ${on ? "on" : "off"}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {notificationGroups
        .filter((group) => !group.adminOnly || isAdmin)
        .map((group) => (
          <fieldset key={group.title} className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">{group.title}</legend>
            {group.types.map(({ type, label }) => {
              const alwaysOn = alwaysOnTypes.includes(type);
              const id = `notify-${type}`;
              return (
                <Field key={type} orientation="horizontal">
                  <Checkbox
                    id={id}
                    checked={alwaysOn || enabled[type] !== false}
                    disabled={alwaysOn}
                    onCheckedChange={(checked) => change(type, label, checked === true)}
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor={id} className="font-normal">
                      {label}
                    </FieldLabel>
                    {alwaysOn && <FieldDescription>Always on</FieldDescription>}
                  </div>
                </Field>
              );
            })}
          </fieldset>
        ))}
    </div>
  );
};

export default NotificationSettings;
