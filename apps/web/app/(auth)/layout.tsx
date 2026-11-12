import { Suspense } from "react";
import OAuthError from "@/components/auth/oauth-error";

const AuthLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      {/* Reads ?error= on the client, so the pages themselves stay static. */}
      <Suspense>
        <OAuthError />
      </Suspense>
      {children}
    </div>
  );
};

export default AuthLayout;
