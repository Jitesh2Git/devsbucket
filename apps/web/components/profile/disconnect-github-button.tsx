"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

type DisconnectGitHubButtonProps = {
  // The row id in the `accounts` table (not GitHub's own user id).
  accountId: string;
};

// Removes GitHub as a sign-in method. Only offered when the account has
// another way in; Better Auth also refuses to unlink the last one, and wants
// a recent sign-in (its "fresh session" rule).
const DisconnectGitHubButton = ({ accountId }: DisconnectGitHubButtonProps) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    const { error } = await authClient.unlinkAccount({ accountId });
    setPending(false);
    if (error) {
      setError(error.message ?? "Couldn't disconnect GitHub.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-destructive">{error}</span>}
      <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending}>
        {pending && <Spinner />}
        Disconnect
      </Button>
    </div>
  );
};

export default DisconnectGitHubButton;
