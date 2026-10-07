"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * matchMedia for components that only ever render on the client (the ssr:false charts). Unlike
 * useMediaQuery, its "server" snapshot is the live value too, so a chart that mounts while the page
 * is still hydrating reads the real viewport instead of starting at `false`; every read goes to
 * `mql.matches`, so it can never hold a stale value.
 */
export function useMatches(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  const read = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, read, read);
}
