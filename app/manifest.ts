import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/lib/theme";

// Dark is the default theme, so the installed app's splash and status bar start dark too.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Santul", short_name: "Santul", start_url: "/today", display: "standalone",
    background_color: THEME_COLOR.dark, theme_color: THEME_COLOR.dark,
    // Static files written by pnpm brand:assets. The maskable one keeps the plate inside Android's safe zone.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
