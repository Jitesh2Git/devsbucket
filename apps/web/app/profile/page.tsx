import { canAdmin } from "@devsbucket/authz/admin";
import { listNotificationPrefs } from "@devsbucket/db/notification-settings";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import OAuthError from "@/components/auth/oauth-error";
import NameForm from "@/components/profile/name-form";
import NotificationSettings from "@/components/profile/notification-settings";
import SignInMethods from "@/components/profile/sign-in-methods";
import UsernameForm from "@/components/profile/username-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UserAvatar from "@/components/user-avatar";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

// The real check (proxy.ts only redirects early): no session, no profile.
const ProfileContent = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  const { name, email, image, username } = session.user;
  const prefs = await listNotificationPrefs(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} image={image ?? null} className="size-16 shrink-0 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          {/* On their own lines, so a long email wraps instead of being cut off. */}
          <p className="text-sm text-muted-foreground">
            {username ? `@${username}` : "No username yet"}
          </p>
          <p className="text-sm break-all text-muted-foreground">{email}</p>
        </div>
      </div>
      {/* Two columns on wide screens: the short cards on the left, the long
          notification settings on the right. One column below lg. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Name</CardTitle>
              <CardDescription>
                What people see when you share with them, in activity and in an open file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NameForm name={name} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Username</CardTitle>
              <CardDescription>
                People can share with you by typing @username instead of your email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsernameForm username={username ?? null} />
            </CardContent>
          </Card>
          <SignInMethods />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              What you're told about. To stop hearing about one folder or file, mute it from its
              menu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettings prefs={prefs} isAdmin={canAdmin(session.user, "view")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 lg:max-w-5xl">
      {/* Shows ?error= after a failed "Connect GitHub" round trip. */}
      <Suspense>
        <OAuthError />
      </Suspense>
      <Suspense>
        <ProfileContent />
      </Suspense>
    </div>
  );
};

export default ProfilePage;
