// Themes (decision 0018): the colour and font styles the app can wear, and
// the options people can change on top. Plain data, so it's easy to edit:
//
// - To add a theme, copy one entry in THEMES, give it a new `id` and `name`,
//   and change its `accent` (the main colour) and `greys` (backgrounds,
//   text, borders). `light` / `dark` override single colours when the
//   generated ones aren't quite right.
// - To add a font, add it to FONTS here and load it in apps/web/lib/fonts.ts
//   with the same CSS variable.
// - DEFAULT_THEME_SETTINGS is what everyone gets until they pick their own.
//
// Colours are OKLCH: oklch(lightness 0-1, chroma 0-0.4, hue 0-360). Keep the
// lightness steps the engine uses (theme-engine.ts) and only change hue and
// chroma, and light and dark stay readable.

// The colours a theme is made of, per mode. The engine turns them into
// shadcn's tokens (--background, --primary, …).
export type ThemeColors = {
  bg: string;
  fg: string;
  card: string;
  muted: string;
  mutedFg: string;
  border: string;
  sidebar: string;
  primary: string;
  primaryFg: string;
  destructive: string;
};

export type FontId = (typeof FONTS)[number]["id"];

export type Theme = {
  id: string;
  name: string;
  note: string;
  // Body font; headings use it too unless someone picks another.
  font: FontId;
  accent: {
    hue: number;
    chroma: number;
    // Lightness of the accent in light and dark mode.
    light: number;
    dark: number;
    // Dark text on accent buttons (for light accents like yellow).
    darkText?: boolean;
  };
  // The tint of the greys: hue and a small chroma (0 = pure grey).
  greys: { hue: number; chroma: number };
  light?: Partial<ThemeColors>;
  dark?: Partial<ThemeColors>;
};

// Every font a theme or a person can choose. `variable` is the CSS variable
// next/font sets on <html> (apps/web/lib/fonts.ts).
export const FONTS = [
  { id: "geist", name: "Geist", variable: "--font-geist", kind: "sans" },
  { id: "inter", name: "Inter", variable: "--font-inter", kind: "sans" },
  {
    id: "plus-jakarta-sans",
    name: "Plus Jakarta Sans",
    variable: "--font-plus-jakarta-sans",
    kind: "sans",
  },
  { id: "manrope", name: "Manrope", variable: "--font-manrope", kind: "sans" },
  { id: "outfit", name: "Outfit", variable: "--font-outfit", kind: "sans" },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", variable: "--font-ibm-plex-sans", kind: "sans" },
  { id: "dm-sans", name: "DM Sans", variable: "--font-dm-sans", kind: "sans" },
  { id: "figtree", name: "Figtree", variable: "--font-figtree", kind: "sans" },
  { id: "onest", name: "Onest", variable: "--font-onest", kind: "sans" },
  { id: "sora", name: "Sora", variable: "--font-sora", kind: "sans" },
  { id: "lexend", name: "Lexend", variable: "--font-lexend", kind: "sans" },
  { id: "space-grotesk", name: "Space Grotesk", variable: "--font-space-grotesk", kind: "sans" },
  { id: "geist-mono", name: "Geist Mono", variable: "--font-geist-mono", kind: "mono" },
  { id: "jetbrains-mono", name: "JetBrains Mono", variable: "--font-jetbrains-mono", kind: "mono" },
  { id: "ibm-plex-mono", name: "IBM Plex Mono", variable: "--font-ibm-plex-mono", kind: "mono" },
  { id: "fira-code", name: "Fira Code", variable: "--font-fira-code", kind: "mono" },
] as const;

// Named grey families anyone can put under any theme ("accent" tints the
// greys with the accent's hue).
export const GREYS = {
  pure: { name: "Pure grey", hue: 0, chroma: 0 },
  zinc: { name: "Zinc (cool)", hue: 286, chroma: 0.006 },
  slate: { name: "Slate (blue)", hue: 257, chroma: 0.014 },
  stone: { name: "Stone (warm)", hue: 55, chroma: 0.006 },
  accent: { name: "Tinted by accent", hue: -1, chroma: 0.012 },
} as const;
export type GreysId = keyof typeof GREYS;

export const THEMES: Theme[] = [
  {
    id: "neutral",
    name: "Neutral",
    note: "The original: plain greys, black buttons.",
    font: "geist",
    accent: { hue: 0, chroma: 0, light: 0.205, dark: 0.922 },
    greys: { hue: 0, chroma: 0 },
    light: { primaryFg: "oklch(0.985 0 0)" },
    dark: { primaryFg: "oklch(0.205 0 0)" },
  },
  {
    id: "ocean",
    name: "Ocean",
    note: "Clear blue on cool slate. Calm, classic.",
    font: "inter",
    accent: { hue: 258, chroma: 0.2, light: 0.55, dark: 0.68 },
    greys: { hue: 255, chroma: 0.008 },
  },
  {
    id: "indigo",
    name: "Indigo",
    note: "Deep indigo, crisp and focused.",
    font: "figtree",
    accent: { hue: 277, chroma: 0.21, light: 0.51, dark: 0.67 },
    greys: { hue: 275, chroma: 0.008 },
  },
  {
    id: "violet",
    name: "Violet",
    note: "Rich violet on zinc. Dev-tool feel.",
    font: "plus-jakarta-sans",
    accent: { hue: 292, chroma: 0.24, light: 0.54, dark: 0.7 },
    greys: { hue: 290, chroma: 0.008 },
  },
  {
    id: "sky",
    name: "Sky",
    note: "Bright cyan-blue, light and airy.",
    font: "onest",
    accent: { hue: 235, chroma: 0.15, light: 0.6, dark: 0.75 },
    greys: { hue: 230, chroma: 0.008 },
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Teal on deep navy, made for dark mode.",
    font: "ibm-plex-sans",
    accent: { hue: 195, chroma: 0.12, light: 0.55, dark: 0.78 },
    greys: { hue: 220, chroma: 0.01 },
    dark: {
      bg: "oklch(0.17 0.035 250)",
      card: "oklch(0.21 0.04 250)",
      muted: "oklch(0.27 0.04 250)",
      mutedFg: "oklch(0.72 0.04 230)",
      border: "oklch(0.78 0.08 220 / 14%)",
      sidebar: "oklch(0.15 0.032 250)",
      fg: "oklch(0.95 0.01 220)",
      primaryFg: "oklch(0.18 0.04 250)",
    },
  },
  {
    id: "nord",
    name: "Nord",
    note: "Frost blue on polar greys. Soft and quiet.",
    font: "inter",
    accent: { hue: 250, chroma: 0.1, light: 0.58, dark: 0.8 },
    greys: { hue: 250, chroma: 0.012 },
    light: { fg: "oklch(0.32 0.02 264)", bg: "oklch(0.985 0.005 250)" },
    dark: {
      bg: "oklch(0.32 0.02 264)",
      card: "oklch(0.36 0.022 264)",
      muted: "oklch(0.4 0.024 264)",
      mutedFg: "oklch(0.8 0.02 250)",
      sidebar: "oklch(0.29 0.02 264)",
      fg: "oklch(0.93 0.01 250)",
      primary: "oklch(0.8 0.08 215)",
      primaryFg: "oklch(0.3 0.02 264)",
      border: "oklch(1 0 0 / 10%)",
    },
  },
  {
    id: "mocha",
    name: "Mocha",
    note: "Pastel mauve on soft purple-greys.",
    font: "space-grotesk",
    accent: { hue: 300, chroma: 0.2, light: 0.55, dark: 0.79 },
    greys: { hue: 280, chroma: 0.01 },
    light: {
      bg: "oklch(0.96 0.006 265)",
      card: "oklch(0.985 0.004 265)",
      muted: "oklch(0.92 0.01 265)",
      fg: "oklch(0.44 0.04 279)",
      mutedFg: "oklch(0.55 0.035 275)",
      sidebar: "oklch(0.94 0.008 265)",
      border: "oklch(0.88 0.012 265)",
    },
    dark: {
      bg: "oklch(0.24 0.03 284)",
      card: "oklch(0.28 0.03 284)",
      muted: "oklch(0.32 0.032 284)",
      fg: "oklch(0.88 0.04 272)",
      mutedFg: "oklch(0.72 0.04 274)",
      sidebar: "oklch(0.21 0.028 284)",
      primary: "oklch(0.79 0.12 305)",
      primaryFg: "oklch(0.24 0.03 284)",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    note: "Green on near-black. Terminal energy.",
    font: "geist",
    accent: { hue: 160, chroma: 0.13, light: 0.56, dark: 0.72 },
    greys: { hue: 160, chroma: 0.008 },
  },
  {
    id: "forest",
    name: "Forest",
    note: "Deep, calm green with earthy greys.",
    font: "dm-sans",
    accent: { hue: 150, chroma: 0.09, light: 0.45, dark: 0.68 },
    greys: { hue: 150, chroma: 0.012 },
  },
  {
    id: "amber",
    name: "Amber",
    note: "Golden yellow with dark text on buttons.",
    font: "sora",
    accent: { hue: 75, chroma: 0.16, light: 0.78, dark: 0.8, darkText: true },
    greys: { hue: 80, chroma: 0.006 },
  },
  {
    id: "ember",
    name: "Ember",
    note: "Warm orange on stone greys. Friendly.",
    font: "manrope",
    accent: { hue: 45, chroma: 0.19, light: 0.64, dark: 0.72 },
    greys: { hue: 55, chroma: 0.006 },
  },
  {
    id: "coral",
    name: "Coral",
    note: "Soft red-orange, lively but not loud.",
    font: "lexend",
    accent: { hue: 30, chroma: 0.17, light: 0.64, dark: 0.74 },
    greys: { hue: 25, chroma: 0.006 },
  },
  {
    id: "rose",
    name: "Rose",
    note: "Rose pink on zinc. Bold, with personality.",
    font: "outfit",
    accent: { hue: 12, chroma: 0.22, light: 0.59, dark: 0.7 },
    greys: { hue: 10, chroma: 0.007 },
  },
];

// The options on top of a theme. `null` means "the theme's own".
export type ThemeSettings = {
  theme: string;
  accentHue: number | null;
  greys: GreysId | null;
  fontSans: FontId | null;
  fontHeading: FontId | null;
  fontMono: FontId;
  size: "s" | "m" | "l";
  // Corner radius in rem.
  radius: number;
  density: "compact" | "normal" | "comfy";
  surface: "flat" | "raised";
  button: "solid" | "soft" | "outline";
  sidebar: "plain" | "tinted" | "contrast";
};

// Everyone's starting point (chosen 2026-11-22): Nord with a blue accent on
// zinc greys, Sora, IBM Plex Sans headings, Fira Code.
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  theme: "nord",
  accentHue: 250,
  greys: "zinc",
  fontSans: "sora",
  fontHeading: "ibm-plex-sans",
  fontMono: "fira-code",
  size: "m",
  radius: 0.75,
  density: "normal",
  surface: "flat",
  button: "solid",
  sidebar: "plain",
};

// Where a browser keeps its own choice (like the grid/table view).
export const THEME_STORAGE_KEY = "devsbucket:theme";
