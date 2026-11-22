import { defaultTheme, themeBootScript } from "@devsbucket/shared/theme-engine";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import QueryProvider from "@/components/query-provider";
import SiteHeader from "@/components/site-header";
import ThemeProvider from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

// The default theme on <html> (decision 0018). A browser with its own saved
// theme swaps it in from the <head> script before the first paint, so
// <html> may differ from the server's (suppressHydrationWarning).
const theme = defaultTheme();
const bootScript = themeBootScript();

export const metadata: Metadata = {
  title: { default: "DevsBucket", template: "%s · DevsBucket" },
  description: "A developer-focused file drive.",
};

const RootLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
      style={theme.vars as CSSProperties}
      {...theme.attrs}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own script, built from the theme list */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
