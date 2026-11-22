import { cn } from "cn";
import { useId } from "react";

// The app's loader: the DevsBucket bucket drawing itself, filling with the
// theme's accent, clearing and starting again (globals.css, "Bucket
// loader"). Colours come from the theme tokens, so it fits every theme in
// light and dark; with "reduce motion" it's a still, half-full bucket.
// Buttons keep the small Spinner.
const SIZES = { sm: "size-6", md: "size-12", lg: "size-16" } as const;

type BucketLoaderProps = {
  // What's loading, for screen readers ("Loading more", "Loading files").
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
};

const BucketLoader = ({ label = "Loading", size = "md", className }: BucketLoaderProps) => {
  // A clip path id of its own (useId's characters aren't valid in url()).
  const clip = `bucket-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const outline = "M14 20 L50 20 L45 56 Q44 59 41 59 L23 59 Q20 59 19 56 Z";
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("bucket-loader inline-flex shrink-0", SIZES[size], className)}
    >
      <svg viewBox="0 0 64 64" className="size-full overflow-visible" aria-hidden>
        <defs>
          <clipPath id={clip}>
            <path d={outline} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect className="bucket-liquid" x="10" y="20" width="44" height="44" />
        </g>
        <path className="bucket-outline" d={outline} />
        <path className="bucket-handle" d="M16 20 Q32 4 48 20" />
      </svg>
    </span>
  );
};

export default BucketLoader;
