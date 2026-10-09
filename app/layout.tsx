import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Inherited as-is by every page (no per-page share cards), so no og:url here. The images come from app/opengraph-image.png and app/twitter-image.png (pnpm brand:assets).
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Static: Dark until THEME_SCRIPT (blocking, in <head>, before first paint) applies the cookie's
    // choice to data-theme and the theme-color meta. suppressHydrationWarning: those two attributes
    // legitimately differ from the server HTML once the script has run.
    <html lang="en" className={geist.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={THEME_COLOR.dark} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
