import { buildTheme } from "@devsbucket/shared/theme-engine";
import { DEFAULT_THEME_SETTINGS, FONTS, GREYS, THEMES } from "@devsbucket/shared/themes";
import { cn } from "cn";

// Three real themes from the list, with their swatches worked out the way
// the Themes page does (its accent in light and dark, its dark background).
const SHOWN = ["default", "forest", "ember"];
const CARDS = THEMES.filter((theme) => SHOWN.includes(theme.id)).map((theme) => {
  const { vars } = buildTheme(
    { ...DEFAULT_THEME_SETTINGS, theme: theme.id, accentHue: null, greys: null },
    THEMES,
    FONTS,
    GREYS,
  );
  return {
    id: theme.id,
    name: theme.name,
    swatches: [vars["--light-primary"], vars["--dark-primary"], vars["--dark-background"]],
  };
});

// The Themes page in miniature: the Default theme picked.
const ThemesDemo = () => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CARDS.map((card) => (
        <div
          key={card.id}
          className={cn(
            "flex flex-col gap-2 rounded-lg border bg-background p-2 text-xs",
            card.id === "default" && "border-primary ring-2 ring-ring/50",
          )}
        >
          <span className="flex h-7 overflow-hidden rounded-md">
            {card.swatches.map((color) => (
              <span key={color} className="flex-1" style={{ background: color }} />
            ))}
          </span>
          <span className="truncate font-medium">{card.name}</span>
        </div>
      ))}
    </div>
  );
};

export default ThemesDemo;
