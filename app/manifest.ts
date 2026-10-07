import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EATRi8", short_name: "EATRi8", start_url: "/today", display: "standalone",
    background_color: "#FAFBF6", theme_color: "#FAFBF6",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
