import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { THEME_COOKIE, parseTheme, themeColorFor } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "EATRi8",
  description: "Track what you eat. Scan any food. See how healthy it really is.",
  applicationName: "EATRi8",
};

async function readTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

// The browser chrome follows the chosen theme: one colour for Dark or Light, the media pair for System.
export async function generateViewport(): Promise<Viewport> {
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: themeColorFor(await readTheme()) };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await readTheme();
  return (
    // data-theme picks the palette in globals.css on the server render, so there's no flash.
    <html lang="en" className={geist.variable} data-theme={theme}>
      <body><Providers theme={theme}>{children}</Providers></body>
    </html>
  );
}
