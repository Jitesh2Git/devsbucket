// The theme engine (decision 0018): turns ThemeSettings into CSS variables
// on <html>. globals.css maps them onto shadcn's tokens (--background:
// var(--light-background), and the --dark- ones under .dark), so light and
// dark both follow and next-themes keeps switching between them.
//
// buildTheme and bootTheme are self-contained on purpose (no imports, no
// outside helpers): themeBootScript() sends their source to the browser as
// a tiny <head> script that applies a saved choice before the first paint.
import {
  DEFAULT_THEME_SETTINGS,
  FONTS,
  GREYS,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
  type ThemeSettings,
} from "./themes.ts";

export type BuiltTheme = {
  // CSS custom properties for <html style>.
  vars: Record<string, string>;
  // data-* attributes for <html> (surfaces, main button, sidebar).
  attrs: Record<string, string>;
};

type FontList = readonly { id: string; variable: string }[];
type GreyList = Record<string, { hue: number; chroma: number }>;

export function buildTheme(
  settings: ThemeSettings,
  themes: Theme[],
  fonts: FontList,
  greyList: GreyList,
): BuiltTheme {
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const greys = (h: number, c: number, dark: boolean) =>
    dark
      ? {
          bg: `oklch(0.16 ${round(c * 1.6)} ${h})`,
          fg: `oklch(0.97 ${round(c * 0.6)} ${h})`,
          card: `oklch(0.2 ${round(c * 2)} ${h})`,
          muted: `oklch(0.26 ${round(c * 2.4)} ${h})`,
          mutedFg: `oklch(0.72 ${round(c * 3)} ${h})`,
          border: "oklch(1 0 0 / 9%)",
          sidebar: `oklch(0.18 ${round(c * 1.8)} ${h})`,
        }
      : {
          bg: `oklch(0.995 ${round(c * 0.3)} ${h})`,
          fg: `oklch(0.18 ${round(c * 2)} ${h})`,
          card: "oklch(1 0 0)",
          muted: `oklch(0.965 ${round(c)} ${h})`,
          mutedFg: `oklch(0.52 ${round(c * 3)} ${h})`,
          border: `oklch(0.92 ${round(c * 1.4)} ${h})`,
          sidebar: `oklch(0.975 ${round(c)} ${h})`,
        };
  const accent = (a: Theme["accent"], dark: boolean) =>
    dark
      ? {
          primary: `oklch(${a.dark} ${round(a.chroma * 0.85)} ${a.hue})`,
          primaryFg: `oklch(0.17 0.03 ${a.hue})`,
        }
      : {
          primary: `oklch(${a.light} ${a.chroma} ${a.hue})`,
          primaryFg: a.darkText ? `oklch(0.2 0.04 ${a.hue})` : `oklch(0.985 0.01 ${a.hue})`,
        };

  const theme = themes.find((t) => t.id === settings.theme) ?? themes[0];
  if (!theme) throw new Error("No themes");
  // A chosen hue keeps the theme's character: a light accent stays light.
  const hue = settings.accentHue ?? theme.accent.hue;
  const chosenAccent =
    settings.accentHue === null
      ? null
      : theme.accent.darkText
        ? { hue, chroma: 0.16, light: 0.78, dark: 0.8, darkText: true }
        : { hue, chroma: 0.19, light: 0.56, dark: 0.7 };
  const chosenGreys = settings.greys === null ? null : greyList[settings.greys];

  const colors = (dark: boolean) => {
    const t: Record<string, string> = Object.assign(
      {},
      greys(theme.greys.hue, theme.greys.chroma, dark),
      accent(theme.accent, dark),
      { destructive: dark ? "oklch(0.7 0.19 22)" : "oklch(0.58 0.22 27)" },
      (dark ? theme.dark : theme.light) ?? {},
    );
    if (chosenAccent) Object.assign(t, accent(chosenAccent, dark));
    if (chosenGreys) {
      Object.assign(
        t,
        greys(chosenGreys.hue < 0 ? hue : chosenGreys.hue, chosenGreys.chroma, dark),
      );
    }
    // The accent as text or an icon on the page: a light accent is too
    // faint on a light background, so it gets a darker shade there.
    t.primaryText =
      theme.accent.darkText && !dark ? `oklch(0.55 0.14 ${hue})` : (t.primary as string);
    return t;
  };

  const vars: Record<string, string> = {};
  const light = colors(false);
  const dark = colors(true);
  for (const [mode, t, other] of [
    ["light", light, dark],
    ["dark", dark, light],
  ] as const) {
    const set = (name: string, value: string | undefined) => {
      vars[`--${mode}-${name}`] = value ?? "";
    };
    set("background", t.bg);
    set("foreground", t.fg);
    set("card", t.card);
    set("card-foreground", t.fg);
    set("popover", t.card);
    set("popover-foreground", t.fg);
    set("primary", t.primary);
    set("primary-foreground", t.primaryFg);
    set("primary-text", t.primaryText);
    set("secondary", t.muted);
    set("secondary-foreground", t.fg);
    set("muted", t.muted);
    set("muted-foreground", t.mutedFg);
    set("accent", t.muted);
    set("accent-foreground", t.fg);
    set("destructive", t.destructive);
    set("border", t.border);
    set("input", t.border);
    set("ring", t.primary);
    // Sidebar: the page's own background (plain), the theme's sidebar shade
    // (tinted), or the other mode's colours (contrast).
    const sb: Record<string, string> =
      settings.sidebar === "contrast"
        ? mode === "dark"
          ? Object.assign({}, t, { sidebar: t.card ?? "" })
          : other
        : t;
    set("sidebar", settings.sidebar === "plain" ? t.bg : sb.sidebar);
    set("sidebar-foreground", sb.fg);
    set("sidebar-muted-foreground", sb.mutedFg);
    set("sidebar-primary", sb.primary);
    set("sidebar-primary-foreground", sb.primaryFg);
    set("sidebar-accent", sb.muted);
    set("sidebar-accent-foreground", sb.fg);
    set("sidebar-border", sb.border);
    set("sidebar-ring", sb.primary);
  }

  const font = (id: string | null, fallback: string) =>
    `var(${(fonts.find((f) => f.id === (id ?? fallback)) ?? fonts[0])?.variable})`;
  const body = settings.fontSans ?? theme.font;
  vars["--app-font-sans"] = font(body, theme.font);
  vars["--app-font-heading"] = font(settings.fontHeading, body);
  vars["--app-font-mono"] = font(settings.fontMono, "geist-mono");
  vars["--app-font-size"] = { s: "15px", m: "16px", l: "17px" }[settings.size] ?? "16px";
  vars["--radius"] = `${settings.radius}rem`;
  // Tailwind's spacing unit: every padding, gap and margin scales with it.
  vars["--spacing"] =
    { compact: "0.225rem", normal: "0.25rem", comfy: "0.275rem" }[settings.density] ?? "0.25rem";

  return {
    vars,
    attrs: {
      "data-surface": settings.surface,
      "data-button": settings.button,
      "data-sidebar": settings.sidebar,
    },
  };
}

// The bits of the browser bootTheme uses (shared has no DOM types).
type BootGlobals = {
  localStorage: { getItem: (key: string) => string | null };
  document: {
    documentElement: {
      style: { setProperty: (name: string, value: string) => void };
      setAttribute: (name: string, value: string) => void;
    };
  };
};

// Reads a saved choice and applies it to <html>. Runs as the <head> script
// (before the page paints) with its data passed in; a missing, broken or
// outdated value leaves the server-rendered default in place.
export function bootTheme(
  data: { key: string; defaults: ThemeSettings; themes: Theme[]; fonts: FontList; greys: GreyList },
  build: typeof buildTheme,
) {
  try {
    const { localStorage, document } = globalThis as unknown as BootGlobals;
    const raw = localStorage.getItem(data.key);
    if (!raw) return;
    const settings: ThemeSettings = Object.assign({}, data.defaults, JSON.parse(raw));
    if (!data.themes.some((t) => t.id === settings.theme)) settings.theme = data.defaults.theme;
    const built = build(settings, data.themes, data.fonts, data.greys);
    const root = document.documentElement;
    for (const [name, value] of Object.entries(built.vars)) root.style.setProperty(name, value);
    for (const [name, value] of Object.entries(built.attrs)) root.setAttribute(name, value);
  } catch {
    // Storage blocked or a broken value: keep the default.
  }
}

// The default theme, for <html> on the server (so the page is right even
// before any script runs, and without one).
export const defaultTheme = () => buildTheme(DEFAULT_THEME_SETTINGS, THEMES, FONTS, GREYS);

// The <head> script's source: bootTheme with its data, and buildTheme to
// call. "<" is escaped so nothing in the data can end the <script> early.
export const themeBootScript = () =>
  `(${bootTheme.toString()})(${JSON.stringify({
    key: THEME_STORAGE_KEY,
    defaults: DEFAULT_THEME_SETTINGS,
    themes: THEMES,
    fonts: FONTS,
    greys: GREYS,
  }).replace(/</g, "\\u003c")}, ${buildTheme.toString()})`;
