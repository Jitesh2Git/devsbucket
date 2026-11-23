import { HardDrive } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

// The homepage's buttons: the way to your drive when you're signed in,
// otherwise sign up (with an invite) or sign in. Reads the session from
// the request, so the page wraps it in <Suspense> (Cache Components) with
// a placeholder of the same height.
const HomeActions = async ({ signUpLabel }: { signUpLabel: string }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    return (
      <Button asChild size="lg" className="h-11 px-5">
        <Link href="/drive">
          <HardDrive />
          Go to My Drive
        </Link>
      </Button>
    );
  }
  return (
    <>
      <Button asChild size="lg" className="h-11 px-5">
        <Link href="/sign-up">{signUpLabel}</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="h-11 px-5">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    </>
  );
};

export default HomeActions;
