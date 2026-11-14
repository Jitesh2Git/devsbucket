"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { SharingView } from "@/app/drive/share-actions";
import { cancelOwnershipOffer, offerOwnership } from "@/app/drive/transfer-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ShareOwnershipSectionProps = {
  item: { id: string; name: string };
  sharing: SharingView;
  onChanged: () => Promise<unknown>;
};

// The Owner's "make someone else the owner" (decision 0009): offered to
// someone who has access; they accept or decline. One offer at a time.
const ShareOwnershipSection = ({ item, sharing, onChanged }: ShareOwnershipSectionProps) => {
  const [chosen, setChosen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const person = sharing.people.find((candidate) => candidate.userId === chosen);

  const run = async (change: () => Promise<{ error: string | null }>, done: string) => {
    setBusy(true);
    const result = await change();
    setBusy(false);
    setConfirming(false);
    if (result.error !== null) {
      toast.error(result.error);
    } else {
      toast.success(done);
      setChosen(null);
    }
    await onChanged();
  };

  if (sharing.transfer) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Waiting for {sharing.transfer.toName} to accept ownership.</span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(() => cancelOwnershipOffer({ itemId: item.id }), "Offer cancelled")}
        >
          Cancel offer
        </Button>
      </div>
    );
  }

  if (sharing.people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Share it with someone first; then you can make them the owner.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="New owner">
            {person?.name ?? "Choose a person"}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={chosen ?? ""} onValueChange={setChosen}>
            {sharing.people.map((candidate) => (
              <DropdownMenuRadioItem key={candidate.userId} value={candidate.userId}>
                {candidate.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" disabled={!person || busy} onClick={() => setConfirming(true)}>
        Offer ownership
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {person?.name} the owner?</AlertDialogTitle>
            <AlertDialogDescription>
              If they accept, "{item.name}"
              {sharing.nested
                ? " moves out of the folder it's in, to the top of their My Drive. People with access through the folders above lose it."
                : " moves to their My Drive."}{" "}
              Its storage counts against theirs, and you become an Editor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                // Keep the dialog open until the server answers.
                event.preventDefault();
                if (person) {
                  void run(
                    () => offerOwnership({ itemId: item.id, userId: person.userId }),
                    `Offered to ${person.name}`,
                  );
                }
              }}
            >
              Offer ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShareOwnershipSection;
