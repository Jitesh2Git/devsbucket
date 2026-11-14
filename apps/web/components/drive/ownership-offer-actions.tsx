"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { acceptOwnership, declineOwnership } from "@/app/drive/transfer-actions";
import { Button } from "@/components/ui/button";

type OwnershipOfferActionsProps = {
  offer: { id: string; itemId: string; name: string };
};

// Accept or decline an ownership offer (decision 0009). Accepting moves it
// to the top of your My Drive; either way the page shows the new state.
const OwnershipOfferActions = ({ offer }: OwnershipOfferActionsProps) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const answer = async (accept: boolean) => {
    setBusy(true);
    const input = { itemId: offer.itemId, transferId: offer.id };
    const result = accept ? await acceptOwnership(input) : await declineOwnership(input);
    setBusy(false);
    if (result.error !== null) {
      toast.error(result.error);
      return;
    }
    toast.success(
      "name" in result
        ? `You own "${result.name}" now. It's at the top of your My Drive.`
        : `Declined "${offer.name}"`,
    );
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={busy}
        aria-label={`Accept ownership of ${offer.name}`}
        onClick={() => answer(true)}
      >
        Accept
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label={`Decline ownership of ${offer.name}`}
        onClick={() => answer(false)}
      >
        Decline
      </Button>
    </div>
  );
};

export default OwnershipOfferActions;
