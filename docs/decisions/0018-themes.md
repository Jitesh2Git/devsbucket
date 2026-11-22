# 0018: Themes, chosen per browser

Date: 2026-11-22 · Status: accepted

## Context

The app was shadcn's neutral palette with Geist: black, white and grey, nothing else. After trying 14 colour and font styles on a mock of the drive, the user picked a default and asked for the others to stay available, so each person can choose their own look, the way they already choose light/dark and grid/table.

## Decision

- **Themes are data.** `@devsbucket/shared/themes` lists every theme (an accent colour, a grey family, a font, and optional exact colours per mode), the fonts (`FONTS`), the grey families (`GREYS`), and `DEFAULT_THEME_SETTINGS`. Adding a theme or a font is an edit there (and, for a font, in `apps/web/lib/fonts.ts`).
- **The default** (everyone, until they pick): Nord with a blue accent (hue 250) on zinc greys, Sora for text, IBM Plex Sans for headings, Fira Code for code, 0.75rem corners, normal density, flat surfaces, solid main button, plain sidebar.
- **Options on top of a theme:** accent hue, greys, body / heading / code font, text size (S/M/L), corners, density (compact / normal / comfy), surfaces (flat / raised), main button (solid / soft / outline), sidebar (plain / tinted / contrast).
- **Per browser:** the choice is kept in `localStorage` (`devsbucket:theme`), like the grid/table view. Not stored on the account.
- **How it's applied:** `buildTheme` (`@devsbucket/shared/theme-engine`) turns the settings into CSS variables (`--light-*`, `--dark-*`, fonts, radius, spacing, text size) and `data-*` attributes on `<html>`. The server renders the default; a small `<head>` script, built from the same function's source, applies a saved choice before the first paint. `globals.css` maps the variables onto shadcn's tokens for light and dark, so `next-themes` keeps switching modes.
- **Fonts** are self-hosted with `next/font`. Only the default's three are preloaded; the browser downloads another font only when a theme uses it.
- **The Themes page** (`/themes`, from the account menu) lets people pick and customise, with the app itself as the live preview (step 2).

## Why / alternatives rejected

- **Saved on the account:** follows you across devices, but needs a table, a migration and a round trip before the first paint (or a flash of the wrong theme). The user asked for per-browser, like the other view choices.
- **One fixed theme:** simpler, but the user wanted people to choose.
- **Fonts from Google Fonts at runtime:** no build step per font, but a request to Google from every browser and a flash while the font loads; `next/font` self-hosts and costs nothing extra.
- **A generated stylesheet per theme:** fine for fixed themes, but the hue slider and the other options make the combinations open-ended; CSS variables from one function cover them all.
