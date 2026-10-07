import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/lib/theme";

// Dark is the default theme, so the installed app's splash and status bar start dark too.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EATRi8", short_name: "EATRi8", start_url: "/today", display: "standalone",
    background_color: THEME_COLOR.dark, theme_color: THEME_COLOR.dark,
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
