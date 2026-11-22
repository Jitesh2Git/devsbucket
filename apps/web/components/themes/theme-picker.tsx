"use client";

import { buildTheme } from "@devsbucket/shared/theme-engine";
import {
  DEFAULT_THEME_SETTINGS,
  FONTS,
  GREYS,
  type GreysId,
  THEMES,
  type ThemeSettings,
} from "@devsbucket/shared/themes";
import { RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useSyncExternalStore } from "react";
import ThemePreview from "@/components/themes/theme-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resetThemeSettings, setThemeSettings, useThemeSettings } from "@/lib/theme-settings";

// Each theme's own look, for the swatches on its card: its accent in light
// and dark mode, and its dark background.
const SWATCHES = Object.fromEntries(
  THEMES.map((theme) => {
    const { vars } = buildTheme(
      { ...DEFAULT_THEME_SETTINGS, theme: theme.id, accentHue: null, greys: null },
      THEMES,
      FONTS,
      GREYS,
    );
    return [theme.id, [vars["--light-primary"], vars["--dark-primary"], vars["--dark-background"]]];
  }),
);
const fontName = (id: string) => FONTS.find((font) => font.id === id)?.name ?? id;

// The cards: every theme but the Default one (Reset brings that back).
const LISTED = THEMES.filter((theme) => theme.listed !== false);
const isDefault = (settings: ThemeSettings) =>
  JSON.stringify(settings) === JSON.stringify(DEFAULT_THEME_SETTINGS);

// Radix Select can't have an empty value, so "the theme's own" is a word.
const OWN = "own";

type Option<T extends string> = { value: T; label: string };

// A row of buttons, one pressed (like the grid/table toggle).
const Choice = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: Option<T>[];
  onChange: (value: T) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <span aria-hidden className="text-sm text-muted-foreground">
      {label}
    </span>
    <fieldset className="flex rounded-lg border p-0.5">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "secondary" : "ghost"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </fieldset>
  </div>
);

// A labelled dropdown.
const Pick = ({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option<string>[];
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <Label htmlFor={id} className="font-normal text-muted-foreground">
      {label}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-3">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
    {children}
  </section>
);

const SANS = FONTS.filter((font) => font.kind === "sans").map((font) => ({
  value: font.id as string,
  label: font.name as string,
}));
const MONO = FONTS.filter((font) => font.kind === "mono").map((font) => ({
  value: font.id as string,
  label: font.name as string,
}));

// True once the page has hydrated (false on the server and while
// hydrating), for values only the browser knows.
const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

// The Themes page (decision 0018): pick a theme, change it, see it at once
// on the whole app. Saved in this browser only. The controls sit in a side
// panel that stays in view; the preview gets the rest of the width.
const ThemePicker = () => {
  const settings = useThemeSettings();
  const set = (changes: Partial<ThemeSettings>) => setThemeSettings(changes);
  const { theme: savedMode, setTheme: setMode } = useTheme();
  // next-themes knows the saved mode only in the browser: showing it before
  // hydration made the server's and the browser's first render differ.
  const mode = useHydrated() ? savedMode : undefined;
  const current = THEMES.find((theme) => theme.id === settings.theme) ?? THEMES[0];

  // A theme card starts from that theme's own colours and fonts; the
  // options below change it from there.
  const pickTheme = (id: string) =>
    set({ theme: id, accentHue: null, greys: null, fontSans: null, fontHeading: null });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Themes</h1>
          <p className="text-sm text-muted-foreground">
            Colours, fonts and shapes for DevsBucket, saved in this browser. Changes show at once on
            the whole app.
          </p>
        </div>
        <Button variant="outline" onClick={resetThemeSettings} disabled={isDefault(settings)}>
          <RotateCcw />
          Reset to default
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* The controls: in view beside the preview, scrolling on their own
            (`relative` keeps the sr-only text inside that scroll box). */}
        <aside
          aria-label="Theme settings"
          className="relative flex flex-col gap-6 rounded-xl border bg-card p-4 lg:sticky lg:top-20"
        >
          <section aria-labelledby="themes-heading" className="flex flex-col gap-3">
            <h2 id="themes-heading" className="font-semibold">
              Theme
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {LISTED.map((theme) => {
                const active = theme.id === settings.theme;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={active}
                    aria-label={theme.name}
                    aria-describedby={`theme-note-${theme.id}`}
                    onClick={() => pickTheme(theme.id)}
                    className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 aria-pressed:border-primary aria-pressed:bg-muted/50 aria-pressed:ring-2 aria-pressed:ring-primary/30"
                  >
                    <span className="flex shrink-0 gap-0.5" aria-hidden>
                      {SWATCHES[theme.id]?.map((color) => (
                        <span
                          key={color}
                          className="size-2.5 rounded-full border"
                          style={{ background: color }}
                        />
                      ))}
                    </span>
                    <span className="truncate font-medium">{theme.name}</span>
                    <span id={`theme-note-${theme.id}`} className="sr-only">
                      {theme.note} {fontName(theme.font)}.
                    </span>
                  </button>
                );
              })}
            </div>
            {current && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                <span className="font-medium text-foreground">In use: {current.name}.</span>{" "}
                {current.listed === false
                  ? `${current.note} Pick a theme to change it; Reset to default comes back here.`
                  : `${current.note} ${fontName(current.font)}. Picking a theme starts from its own colours and fonts.`}
              </p>
            )}
          </section>

          <Group title="Colour">
            <Choice
              label="Mode"
              value={mode as "light" | "dark" | "system" | undefined}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              onChange={setMode}
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="own-accent"
                  checked={settings.accentHue !== null}
                  onCheckedChange={(checked) =>
                    set({ accentHue: checked === true ? (current?.accent.hue ?? 250) : null })
                  }
                />
                <Label htmlFor="own-accent" className="font-normal text-muted-foreground">
                  Own accent colour
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={359}
                  aria-label="Accent hue"
                  value={settings.accentHue ?? current?.accent.hue ?? 0}
                  onChange={(event) => set({ accentHue: Number(event.target.value) })}
                  className="min-w-0 flex-1 accent-primary"
                />
                <span
                  aria-hidden
                  className="size-5 shrink-0 rounded-md border"
                  style={{ background: "var(--primary)" }}
                />
              </div>
            </div>
            <Pick
              id="greys"
              label="Greys"
              value={settings.greys ?? OWN}
              options={[
                { value: OWN, label: "Theme's own" },
                ...Object.entries(GREYS).map(([value, grey]) => ({ value, label: grey.name })),
              ]}
              onChange={(value) => set({ greys: value === OWN ? null : (value as GreysId) })}
            />
          </Group>

          <Group title="Type">
            <Pick
              id="font-body"
              label="Text font"
              value={settings.fontSans ?? OWN}
              options={[
                { value: OWN, label: `Theme's own (${fontName(current?.font ?? "")})` },
                ...SANS,
              ]}
              onChange={(value) =>
                set({ fontSans: value === OWN ? null : (value as ThemeSettings["fontMono"]) })
              }
            />
            <Pick
              id="font-heading"
              label="Heading font"
              value={settings.fontHeading ?? OWN}
              options={[{ value: OWN, label: "Same as text" }, ...SANS]}
              onChange={(value) =>
                set({ fontHeading: value === OWN ? null : (value as ThemeSettings["fontMono"]) })
              }
            />
            <Pick
              id="font-code"
              label="Code font"
              value={settings.fontMono}
              options={MONO}
              onChange={(value) => set({ fontMono: value as ThemeSettings["fontMono"] })}
            />
            <Choice
              label="Text size"
              value={settings.size}
              options={[
                { value: "s", label: "S" },
                { value: "m", label: "M" },
                { value: "l", label: "L" },
              ]}
              onChange={(size) => set({ size })}
            />
          </Group>

          <Group title="Shape">
            <Pick
              id="corners"
              label="Corners"
              value={String(settings.radius)}
              options={[
                { value: "0.25", label: "Sharp" },
                { value: "0.5", label: "Crisp" },
                { value: "0.625", label: "Medium" },
                { value: "0.75", label: "Soft" },
                { value: "1", label: "Round" },
              ]}
              onChange={(value) => set({ radius: Number(value) })}
            />
            <Choice
              label="Density"
              value={settings.density}
              options={[
                { value: "compact", label: "Compact" },
                { value: "normal", label: "Normal" },
                { value: "comfy", label: "Comfy" },
              ]}
              onChange={(density) => set({ density })}
            />
            <Choice
              label="Surfaces"
              value={settings.surface}
              options={[
                { value: "flat", label: "Flat" },
                { value: "raised", label: "Raised" },
              ]}
              onChange={(surface) => set({ surface })}
            />
          </Group>

          <Group title="Pieces">
            <Choice
              label="Main button"
              value={settings.button}
              options={[
                { value: "solid", label: "Solid" },
                { value: "soft", label: "Soft" },
                { value: "outline", label: "Outline" },
              ]}
              onChange={(button) => set({ button })}
            />
            <Choice
              label="Sidebar"
              value={settings.sidebar}
              options={[
                { value: "plain", label: "Plain" },
                { value: "tinted", label: "Tinted" },
                { value: "contrast", label: "Contrast" },
              ]}
              onChange={(sidebar) => set({ sidebar })}
            />
          </Group>
        </aside>

        <ThemePreview />
      </div>
    </div>
  );
};

export default ThemePicker;
