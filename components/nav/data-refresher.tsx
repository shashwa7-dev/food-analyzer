"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DATA_CHANGED_EVENT } from "@/lib/api-client";

/**
 * Visited pages are kept in the browser for a minute (next.config.ts staleTimes). When a write goes
 * through api(), those copies are out of date, so this drops them and re-renders the current page
 * with router.refresh(). Several writes in the same moment share one refresh.
 */
export function DataRefresher() {
  const router = useRouter();
  useEffect(() => {
    let queued = false;
    function onChange() {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; router.refresh(); });
    }
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [router]);
  return null;
}
