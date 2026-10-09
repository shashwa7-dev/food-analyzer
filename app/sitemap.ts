import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages; everything else needs a session. */
const PUBLIC_PATHS = ["/", "/about/data", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: new URL(path, SITE_URL).href, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.5 }));
}
