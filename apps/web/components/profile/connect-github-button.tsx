"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

// Adds GitHub as a sign-in method to the signed-in account. GitHub sends the
// browser back to /profile, with ?error=<code> if it didn't work.
const ConnectGitHubButton = () => {
  const [pending, setPending] = useState(false);

  // Back from github.com can restore this page from the back/forward cache,
  // still pending.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const onClick = async () => {
    setPending(true);
    const { error } = await authClient.linkSocial({
      provider: "github",
      callbackURL: "/profile",
      errorCallbackURL: "/profile",
    });
    if (error) {
      setPending(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending}>
      {pending && <Spinner />}
      Connect
    </Button>
  );
};

export default ConnectGitHubButton;
