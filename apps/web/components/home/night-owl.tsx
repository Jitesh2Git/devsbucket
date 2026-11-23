"use client";

import { useEffect, useState } from "react";

const DAY = "Free, with 1 GB for everyone";
const NIGHT = "Coding at 3 a.m.? Same.";

// An easter egg in the hero's chip: between midnight and 5 a.m. on the
// visitor's own clock it says so. The server can't know their time, so it
// renders the day text and the browser swaps it after hydration.
const NightOwl = () => {
  const [late, setLate] = useState(false);

  useEffect(() => {
    setLate(new Date().getHours() < 5);
  }, []);

  return <>{late ? NIGHT : DAY}</>;
};

export default NightOwl;
