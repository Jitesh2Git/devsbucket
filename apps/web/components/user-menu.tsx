import { headers } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import UserMenuDropdown from "@/components/user-menu-dropdown";
import { auth } from "@/lib/auth";

// Server component: reads the session from the request cookies. It renders
// per request, so the header wraps it in <Suspense> (Cache Components).
const UserMenu = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  const { name, email, image } = session.user;
  return <UserMenuDropdown name={name} email={email} image={image ?? null} />;
};

export default UserMenu;
