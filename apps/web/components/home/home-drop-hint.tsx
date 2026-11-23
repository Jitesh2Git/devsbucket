import { headers } from "next/headers";
import FileDropHint from "@/components/home/file-drop-hint";
import { auth } from "@/lib/auth";

// The file-drop easter egg, told whether the visitor is signed in (the
// message differs). Reads the request, so the page wraps it in <Suspense>.
const HomeDropHint = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return <FileDropHint signedIn={session !== null} />;
};

export default HomeDropHint;
