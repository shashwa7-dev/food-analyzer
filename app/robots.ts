import type { MetadataRoute } from "next";
import { APP_PREFIXES } from "@/lib/nav/app-prefixes";
import { SITE_URL } from "@/lib/site";

// Crawlers get the public pages only: the signed-in app redirects them to /sign-in anyway. That
// page stays crawlable so its own noindex and canonical (the home page) can be read.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...APP_PREFIXES] },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
