import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "EATRi8",
  description: "Track what you eat. Scan any food. See how healthy it really is.",
  applicationName: "EATRi8",
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F6F7F6" }, { media: "(prefers-color-scheme: dark)", color: "#0B0F0D" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
