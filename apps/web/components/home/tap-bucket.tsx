"use client";

import { cn } from "cn";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import LogoMark from "@/components/logo-mark";

// Taps within this long count towards overflowing, and this many do it.
const TAP_WINDOW = 2000;
const TAPS_TO_FILL = 5;
// How long it stays full (spilling) before it settles back.
const FULL_FOR = 2600;

type Drop = { id: number; dx: number; dy: number };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// An easter egg: the homepage's big bucket is a button. A tap makes it
// wobble and splash; five quick taps fill it to the brim, it spills down
// both sides and says so. Enter and Space work too (it's a button), and
// with "reduce motion" only the message shows.
const TapBucket = () => {
  const [tapped, setTapped] = useState(0);
  const [full, setFull] = useState(false);
  const [drops, setDrops] = useState<Drop[]>([]);
  const taps = useRef<number[]>([]);
  const nextDrop = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const splash = (count: number) => {
    if (reducedMotion()) return;
    const added = Array.from({ length: count }, (_, index) => ({
      id: nextDrop.current++,
      dx: (index % 2 ? 1 : -1) * (18 + Math.random() * 26),
      dy: -10 - Math.random() * 24,
    }));
    setDrops((current) => [...current, ...added]);
  };

  const onTap = () => {
    if (full) return;
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time < TAP_WINDOW), now];
    // A new value each tap restarts the wobble (the key below).
    setTapped((count) => count + 1);
    splash(2);
    if (taps.current.length >= TAPS_TO_FILL) {
      taps.current = [];
      setFull(true);
      splash(6);
      toast("Bucket full. 1 GB of 1 GB used.", { description: "Kidding, it's empty." });
      timer.current = setTimeout(() => setFull(false), FULL_FOR);
    }
  };

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="The DevsBucket bucket"
      className="relative rounded-2xl p-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        key={tapped}
        data-tapped={tapped > 0 || undefined}
        data-full={full || undefined}
        className={cn("home-bucket relative block size-16", tapped > 0 && "home-wobble")}
      >
        <LogoMark className="size-16" />
        {full && (
          <>
            <span aria-hidden className="home-spill left-[calc(22%-5px)]" />
            <span aria-hidden className="home-spill left-[78%] [animation-delay:250ms]" />
          </>
        )}
      </span>
      {drops.map((drop) => (
        <span
          key={drop.id}
          aria-hidden
          className="home-drop"
          style={{ "--dx": `${drop.dx}px`, "--dy": `${drop.dy}px` } as CSSProperties}
          onAnimationEnd={() =>
            setDrops((current) => current.filter((other) => other.id !== drop.id))
          }
        />
      ))}
    </button>
  );
};

export default TapBucket;
