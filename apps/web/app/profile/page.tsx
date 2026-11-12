import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} image={image ?? null} className="size-16 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {username ? `@${username}` : "No username yet"} · {email}
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Username</CardTitle>
          <CardDescription>How other people find you when sharing files.</CardDescription>
        </CardHeader>
        <CardContent>
          <UsernameForm username={username ?? null} />
        </CardContent>
      </Card>
    </div>
  );
};

const ProfilePage = () => {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <Suspense>
        <ProfileContent />
      </Suspense>
    </div>
  );
};

export default ProfilePage;
