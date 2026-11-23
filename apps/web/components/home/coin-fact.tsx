"use client";

import { cn } from "cn";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// How many coins fit before the bucket tips them out.
const MAX_COINS = 7;
const outline = "M14 20 L50 20 L45 56 Q44 59 41 59 L23 59 Q20 59 19 56 Z";

// An easter egg on the "$0" fact: every click drops a coin into a little
// bucket, and they stack up. The first says the price won't change; a full
// bucket says so again, then tips over and the coins spill out of it, and
// it starts over.
const CoinFact = () => {
  const [coins, setCoins] = useState(0);
  const [emptying, setEmptying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const addCoin = () => {
    if (emptying) return;
    const count = Math.min(coins + 1, MAX_COINS);
    setCoins(count);
    if (count === 1) {
      toast("Still $0. Promise.");
    }
    if (count === MAX_COINS) {
      toast("That's a lot of coins for a free app.", { description: "Still $0. Keep them." });
      setEmptying(true);
      timer.current = setTimeout(() => {
        setCoins(0);
        setEmptying(false);
      }, 1600);
    }
  };

  return (
    <div className="relative flex flex-col-reverse gap-1 bg-background p-5">
      <dt className="text-sm text-muted-foreground">free, with no plans to charge</dt>
      <dd>
        <button
          type="button"
          onClick={addCoin}
          className="rounded-md font-heading text-3xl font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          $0
        </button>
      </dd>
      <svg
        viewBox="0 0 64 64"
        aria-hidden
        className={cn(
          "absolute top-4 right-4 size-11 overflow-visible",
          emptying && "motion-safe:animate-[home-tip_1.6s_ease-in-out]",
        )}
      >
        <g>
          {Array.from({ length: coins }, (_, index) => (
            <ellipse
              // biome-ignore lint/suspicious/noArrayIndexKey: coins are only ever added on top
              key={index}
              className={cn(
                "home-coin",
                emptying
                  ? "home-coin-spill"
                  : "motion-safe:animate-[home-coin-in_0.7s_cubic-bezier(.5,0,.6,1)]",
              )}
              // While it tips: the top coin goes first, each a little after
              // the one above it, flung a little further.
              style={
                emptying
                  ? ({
                      animationDelay: `${0.45 + (coins - 1 - index) * 0.06}s`,
                      "--spill-x": `${-34 - index * 3}px`,
                    } as CSSProperties)
                  : undefined
              }
              cx="32"
              cy={52 - index * 4.5}
              rx="9"
              ry="2.6"
            />
          ))}
        </g>
        <path
          d={outline}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default CoinFact;
