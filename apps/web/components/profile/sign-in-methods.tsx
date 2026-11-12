import { headers } from "next/headers";
import ConnectGitHubButton from "@/components/profile/connect-github-button";
import DisconnectGitHubButton from "@/components/profile/disconnect-github-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

// Which ways the signed-in user can sign in: email and password, GitHub.
const SignInMethods = async () => {
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });
  const github = accounts.find((a) => a.providerId === "github");
  const hasPassword = accounts.some((a) => a.providerId === "credential");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in methods</CardTitle>
        <CardDescription>The ways you can sign in to this account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
          <span className="text-sm font-medium">Email and password</span>
          <span className="text-sm text-muted-foreground">
            {hasPassword ? "Set up" : "Not set up"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
          <span className="text-sm font-medium">GitHub</span>
          {!github ? (
            <ConnectGitHubButton />
          ) : hasPassword ? (
            <DisconnectGitHubButton accountId={github.id} />
          ) : (
            // GitHub is this account's only way in, so it can't be removed.
            <span className="text-sm text-muted-foreground">Connected</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SignInMethods;
