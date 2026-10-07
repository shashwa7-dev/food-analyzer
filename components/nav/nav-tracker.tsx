"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { IN_APP_NAV_KEY } from "@/lib/nav/back";

/**
 * Mounted once in the app layout: when the pathname changes after the first render, the user has
 * navigated inside the app, so sub-pages (food search) can use browser back safely. See backAction.
 */
export function NavTracker() {
  const path = usePathname();
  const first = useRef(path);
  useEffect(() => {
    if (path === first.current) return;
    try {
      window.sessionStorage.setItem(IN_APP_NAV_KEY, "1");
    } catch {
      // Storage unavailable: Back falls back to its fixed page.
    }
  }, [path]);
  return null;
}
