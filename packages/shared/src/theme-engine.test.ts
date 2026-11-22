import { describe, expect, it } from "vitest";
import { buildTheme, defaultTheme, themeBootScript } from "./theme-engine.ts";
import {
  DEFAULT_THEME_SETTINGS,
  FONTS,
  GREYS,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeSettings,
} from "./themes.ts";

const build = (changes: Partial<ThemeSettings>) =>
  buildTheme({ ...DEFAULT_THEME_SETTINGS, ...changes }, THEMES, FONTS, GREYS);

describe("buildTheme", () => {
  it("builds the default: a blue accent on zinc greys, Sora, IBM Plex Sans, Fira Code", () => {
    const { vars, attrs } = defaultTheme();
    expect(vars["--light-primary"]).toBe("oklch(0.56 0.19 250)");
    expect(vars["--dark-primary"]).toBe("oklch(0.7 0.1615 250)");
    expect(vars["--light-background"]).toBe("oklch(0.995 0.0018 286)");
    expect(vars["--app-font-sans"]).toBe("var(--font-sora)");
    expect(vars["--app-font-heading"]).toBe("var(--font-ibm-plex-sans)");
    expect(vars["--app-font-mono"]).toBe("var(--font-fira-code)");
    expect(vars["--radius"]).toBe("0.75rem");
    expect(vars["--spacing"]).toBe("0.25rem");
    expect(attrs).toEqual({
      "data-surface": "flat",
      "data-button": "solid",
      "data-sidebar": "plain",
    });
  });

  it("gives the Default theme IBM Plex Sans headings, until a text font is picked", () => {
    expect(build({}).vars["--app-font-heading"]).toBe("var(--font-ibm-plex-sans)");
    // A new text font is used for headings too, unless a heading font is picked.
    expect(build({ fontSans: "inter" }).vars["--app-font-heading"]).toBe("var(--font-inter)");
    expect(build({ fontSans: "inter", fontHeading: "outfit" }).vars["--app-font-heading"]).toBe(
      "var(--font-outfit)",
    );
  });

  it("uses a theme's own colours and font when nothing is chosen on top", () => {
    const { vars } = build({
      theme: "nord",
      accentHue: null,
      greys: null,
      fontSans: null,
      fontHeading: null,
    });
    expect(vars["--dark-background"]).toBe("oklch(0.32 0.02 264)");
    expect(vars["--dark-primary"]).toBe("oklch(0.8 0.08 215)");
    expect(vars["--app-font-sans"]).toBe("var(--font-inter)");
    expect(vars["--app-font-heading"]).toBe("var(--font-inter)");
  });

  it("puts the sidebar on the page background, the theme's shade, or the other mode", () => {
    const plain = build({ sidebar: "plain" }).vars;
    expect(plain["--light-sidebar"]).toBe(plain["--light-background"]);
    const tinted = build({ sidebar: "tinted" }).vars;
    expect(tinted["--light-sidebar"]).not.toBe(tinted["--light-background"]);
    const contrast = build({ sidebar: "contrast" }).vars;
    expect(contrast["--light-sidebar-foreground"]).toBe(contrast["--dark-foreground"]);
    expect(contrast["--dark-sidebar"]).toBe(contrast["--dark-card"]);
  });

  it("keeps dark text on a light accent, and a darker shade of it as text", () => {
    const { vars } = build({ theme: "amber", accentHue: null });
    expect(vars["--light-primary-foreground"]).toBe("oklch(0.2 0.04 75)");
    expect(vars["--light-primary-text"]).toBe("oklch(0.55 0.14 75)");
  });

  it("tints the greys with the accent when asked", () => {
    const { vars } = build({ accentHue: 150, greys: "accent" });
    expect(vars["--light-muted"]).toBe("oklch(0.965 0.012 150)");
  });

  it("falls back to the first theme for an unknown id", () => {
    expect(build({ theme: "gone" }).vars).toEqual(build({ theme: THEMES[0]?.id }).vars);
  });

  it.each(THEMES.map((t) => t.id))("gives %s a value for every variable", (id) => {
    const { vars } = build({ theme: id, accentHue: null, greys: null });
    for (const value of Object.values(vars)) {
      expect(value).not.toMatch(/^$|undefined|NaN/);
    }
  });
});

describe("themeBootScript", () => {
  // Runs the script on its own, the way the browser does, with a fake
  // localStorage and <html>.
  const run = (saved: string | null) => {
    const props = new Map<string, string>();
    const attrs = new Map<string, string>();
    const env = {
      localStorage: { getItem: (key: string) => (key === THEME_STORAGE_KEY ? saved : null) },
      document: {
        documentElement: {
          style: { setProperty: (name: string, value: string) => props.set(name, value) },
          setAttribute: (name: string, value: string) => attrs.set(name, value),
        },
      },
    };
    const g = globalThis as Record<string, unknown>;
    Object.assign(g, env);
    try {
      new Function(themeBootScript())();
    } finally {
      delete g.localStorage;
      delete g.document;
    }
    return { props, attrs };
  };

  it("applies a saved choice", () => {
    const { props, attrs } = run(
      JSON.stringify({ theme: "rose", accentHue: null, button: "soft" }),
    );
    const expected = build({ theme: "rose", accentHue: null, button: "soft" });
    expect(Object.fromEntries(props)).toEqual(expected.vars);
    expect(attrs.get("data-button")).toBe("soft");
  });

  it("leaves the default alone with nothing saved or a broken value", () => {
    expect(run(null).props.size).toBe(0);
    expect(run("{not json").props.size).toBe(0);
  });

  it("uses the default theme for a theme that no longer exists", () => {
    const { props } = run(JSON.stringify({ theme: "removed" }));
    expect(props.get("--light-primary")).toBe(defaultTheme().vars["--light-primary"]);
  });

  it("can't end its own <script> tag", () => {
    expect(themeBootScript()).not.toContain("</");
  });
});
