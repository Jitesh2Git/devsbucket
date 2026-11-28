"use client";

import { cn } from "cn";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { endNavigation, startNavigation, useNavigating } from "@/lib/navigation-progress";

// A click that will load another page of the app: the left button, no
// modifier keys, an in-app link that opens here, not a download or an API
// route (those download a file and the page stays), and not this same URL.
const leavesPage = (event: MouseEvent) => {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return false;
  // A name in a multi-select list: a click selects (lib/selection.tsx),
  // which starts the bar itself when it opens the item.
  if (link.closest("[data-item-id]")) return false;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
};

// The thin bar across the top while the next page loads (it races to ~85%
// and waits there), then fills and fades once the URL has changed.
const NavigationProgress = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigating = useNavigating();
  const [finishing, setFinishing] = useState(false);
  const wasNavigating = useRef(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (leavesPage(event)) startNavigation();
    };
    // Capture: before Next's Link handles (and prevents) the click.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // A new URL means the next page is here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every URL change on purpose
  useEffect(() => {
    endNavigation();
  }, [pathname, searchParams]);

  useEffect(() => {
    if (navigating) {
      wasNavigating.current = true;
      setFinishing(false);
      return;
    }
    if (!wasNavigating.current) return;
    wasNavigating.current = false;
    setFinishing(true);
    const done = setTimeout(() => setFinishing(false), 500);
    return () => clearTimeout(done);
  }, [navigating]);

  if (!navigating && !finishing) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-60 h-0.5">
      <div
        className={cn(
          "h-full rounded-r-full bg-primary shadow-[0_0_10px_var(--primary)]",
          navigating ? "nav-progress-grow" : "nav-progress-finish",
        )}
      />
    </div>
  );
};

export default NavigationProgress;
