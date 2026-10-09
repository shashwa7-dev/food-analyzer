"use client";
import { useEffect } from "react";

const STAMP_KEY = "eatri8:session-refreshed";
/** A little under the cookie's five minutes (SESSION_CACHE_SECONDS in lib/auth.ts). */
const REFRESH_MS = 4 * 60 * 1000;

/**
 * Keeps the five-minute session cookie fresh. A page can read that cookie but never set it; only a
 * route handler can, so this asks the session endpoint for a new one while the app is open: on
 * arrival if the last refresh is old, then every four minutes while the tab is visible. Without it
 * the cookie would lapse and every navigation would go back to asking the database.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    function refreshIfDue() {
      if (document.visibilityState !== "visible") return;
      let last = 0;
      try { last = Number(localStorage.getItem(STAMP_KEY)) || 0; } catch { /* storage blocked: refresh anyway */ }
      if (Date.now() - last < REFRESH_MS) return;
      try { localStorage.setItem(STAMP_KEY, String(Date.now())); } catch { /* as above */ }
      // Read the body to the end: an unread response keeps its connection (and the request) open.
      void fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" }).then((r) => r.arrayBuffer()).catch(() => undefined);
    }
    refreshIfDue();
    const timer = setInterval(refreshIfDue, 60_000);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refreshIfDue); };
  }, []);
  return null;
}
