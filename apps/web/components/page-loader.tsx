import { cn } from "cn";
import BucketLoader from "@/components/bucket-loader";

type PageLoaderProps = {
  label?: string;
  // For a page whose whole content is the Suspense (My Drive, a folder, a
  // file): fill the drive column's height (from md up), so the loader sits
  // in the middle like on pages with a heading, where flex-1 does it.
  fullHeight?: boolean;
};

// What a page shows while its content loads (the pages' Suspense
// fallbacks): the bucket loader, centred, with a word under it.
const PageLoader = ({ label = "Loading", fullHeight = false }: PageLoaderProps) => {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-1 flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground",
        fullHeight && "md:h-full",
      )}
    >
      <BucketLoader label={label} size="lg" />
      <span aria-hidden>{label}…</span>
    </div>
  );
};

export default PageLoader;
