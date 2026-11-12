import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// The real check for signed-in pages (proxy.ts only redirects early).
// Reads the request, so call it inside a <Suspense> boundary.
export const requireSession = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }
  return session;
};
