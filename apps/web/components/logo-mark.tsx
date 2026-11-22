"use client";

import { useId } from "react";
import { useNavigating } from "@/lib/navigation-progress";

// The bucket beside "DevsBucket" in the header: a little accent inside,
// sloshing while the next page loads (with the top bar).
const LogoMark = () => {
  const navigating = useNavigating();
  const clip = `logo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const outline = "M14 20 L50 20 L45 56 Q44 59 41 59 L23 59 Q20 59 19 56 Z";
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      data-loading={navigating || undefined}
      className="logo-mark size-6 shrink-0 overflow-visible"
    >
      <defs>
        <clipPath id={clip}>
          <path d={outline} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g className="logo-level">
          <path
            className="logo-wave"
            d="M0 30 Q10 26 20 30 T40 30 T60 30 T80 30 T100 30 V70 H0 Z"
          />
        </g>
      </g>
      <path className="logo-outline" d={outline} />
      <path className="logo-handle" d="M16 20 Q32 4 48 20" />
    </svg>
  );
};

export default LogoMark;
