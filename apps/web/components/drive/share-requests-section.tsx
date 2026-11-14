"use client";

import type { GrantRole } from "@devsbucket/shared/sharing";
import { roleLabel } from "@devsbucket/shared/sharing";
import { useState } from "react";
import { toast } from "sonner";
import { approveAccessRequest, denyAccessRequest } from "@/app/drive/request-actions";
import type { SharingView } from "@/app/drive/share-actions";
import RoleMenu from "@/components/drive/role-menu";
import { Button } from "@/components/ui/button";

type Request = SharingView["requests"][number];

type RequestRowProps = {
  itemId: string;
  request: Request;
  onChanged: () => Promise<unknown>;
};

// One request: approve with the role asked for (or another), or deny.
const RequestRow = ({ itemId, request, onChanged }: RequestRowProps) => {
  const [role, setRole] = useState<GrantRole>(request.role);
  const [busy, setBusy] = useState(false);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const result = approve
      ? await approveAccessRequest({ itemId, requestId: request.id, role })
      : await denyAccessRequest({ itemId, requestId: request.id });
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
    } else {
      toast.success(
        approve
          ? `${request.name} is now ${roleLabel(role).toLowerCase()}`
          : `Denied ${request.name}'s request`,
      );
    }
    await onChanged();
  };

  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {request.name}{" "}
          <span className="font-normal text-muted-foreground">
            asks for {roleLabel(request.role).toLowerCase()} access
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{request.email}</div>
        {request.message && (
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{request.message}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <RoleMenu
          label={`Role for ${request.email}`}
          value={role}
          onChange={setRole}
          disabled={busy}
        />
        <Button
          size="sm"
          aria-label={`Approve ${request.email}`}
          disabled={busy}
          onClick={() => decide(true)}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Deny ${request.email}`}
          disabled={busy}
          onClick={() => decide(false)}
        >
          Deny
        </Button>
      </div>
    </li>
  );
};

type ShareRequestsSectionProps = {
  itemId: string;
  requests: Request[];
  onChanged: () => Promise<unknown>;
};

// Pending access requests for the item, shown in the Share dialog to whoever
// may share it. Nothing when there are none.
const ShareRequestsSection = ({ itemId, requests, onChanged }: ShareRequestsSectionProps) => {
  if (requests.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Access requests</h3>
      <ul aria-label="Access requests" className="flex flex-col divide-y">
        {requests.map((request) => (
          <RequestRow key={request.id} itemId={itemId} request={request} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
};

export default ShareRequestsSection;
