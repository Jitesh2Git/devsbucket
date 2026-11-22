import {
  DM_Sans,
  Figtree,
  Fira_Code,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Lexend,
  Manrope,
  Onest,
  Outfit,
  Plus_Jakarta_Sans,
  Sora,
  Space_Grotesk,
} from "next/font/google";

// Every font a theme can use (decision 0018), self-hosted by next/font.
// Each sets its CSS variable (the `variable` in FONTS, @devsbucket/shared/
// themes) on <html>; the theme points --app-font-* at the ones it wants.
// Only the default theme's fonts are preloaded; the browser downloads the
// others only when a theme uses them. A new font goes here and in FONTS.
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-ibm-plex-sans" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", preload: false });
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  preload: false,
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", preload: false });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", preload: false });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", preload: false });
const onest = Onest({ subsets: ["latin"], variable: "--font-onest", preload: false });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", preload: false });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  preload: false,
});
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", preload: false });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  preload: false,
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  preload: false,
});

// The class names that set every font variable, for <html>.
export const fontVariables = [
  sora,
  ibmPlexSans,
  firaCode,
  geist,
  inter,
  plusJakartaSans,
  manrope,
  outfit,
  dmSans,
  figtree,
  onest,
  lexend,
  spaceGrotesk,
  geistMono,
  jetbrainsMono,
  ibmPlexMono,
]
  .map((font) => font.variable)
  .join(" ");
