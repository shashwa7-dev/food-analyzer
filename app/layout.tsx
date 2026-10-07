import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "EATRi8",
  description: "Track what you eat. Scan any food. See how healthy it really is.",
  applicationName: "EATRi8",
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
