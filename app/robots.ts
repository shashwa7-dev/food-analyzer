import type { MetadataRoute } from "next";
import { APP_PREFIXES } from "@/lib/nav/app-prefixes";
import { SITE_URL } from "@/lib/site";

// Crawlers get the public pages only: the signed-in app redirects them to /sign-in anyway, which
// is the home page again.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...APP_PREFIXES, "/sign-in"] },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
