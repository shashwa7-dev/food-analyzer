"use client";

import { useEffect, useState } from "react";

/**
 * matchMedia for components that only ever render on the client (the ssr:false charts). Unlike
 * useMediaQuery it has no server snapshot, so a chart that mounts while the page is still hydrating
 * reads the real viewport straight away instead of starting (and possibly staying) at `false`.
 */
/** `query` is expected to be a constant for the component's life. */
export function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
