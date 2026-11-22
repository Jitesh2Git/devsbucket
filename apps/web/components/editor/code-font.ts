"use client";

import { onThemeChange } from "@/lib/theme-settings";
import monaco from "./monaco";

// The theme's code font for Monaco (decision 0018). Monaco doesn't use the
// page's CSS fonts, so it's given the font list --app-font-mono resolves to
// (next/font's family names, e.g. "Fira Code", "Fira Code Fallback").
export const codeFontFamily = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--app-font-mono").trim() ||
  "monospace";

// Keeps an editor on the theme's code font: at once, again when another
// theme is picked (here or in another tab), and Monaco re-measures its
// characters once the font file has loaded, so the cursor lines up.
// Returns the function that stops it.
export const followCodeFont = (setFontFamily: (fontFamily: string) => void) => {
  const update = () => {
    const family = codeFontFamily();
    setFontFamily(family);
    // The download can fail or be cancelled (leaving the page while it
    // loads); Monaco then keeps the fallback font, so the error is ignored
    // rather than left as an unhandled rejection.
    document.fonts
      .load(`13px ${family}`)
      .then(() => monaco.editor.remeasureFonts())
      .catch(() => {});
  };
  update();
  return onThemeChange(update);
};
