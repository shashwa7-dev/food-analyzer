import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EATRi8", short_name: "EATRi8", start_url: "/today", display: "standalone",
    background_color: "#F6F7F6", theme_color: "#15803D",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
