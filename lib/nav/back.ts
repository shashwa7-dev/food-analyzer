/** sessionStorage key set once the user has moved between pages inside the app in this tab. */
export const IN_APP_NAV_KEY = "eatri8:in-app-nav";

/**
 * Where a sub-page's Back goes: browser back only when an in-app navigation is on record (so it
 * returns to the app page the user came from), else `fallback` — a page opened directly from a
 * link or bookmark must not leave the app. `history.length` can't tell these apart.
 */
export function backAction(flag: string | null, fallback: string): { kind: "back" } | { kind: "push"; href: string } {
  return flag === "1" ? { kind: "back" } : { kind: "push", href: fallback };
}

/** The flag, or null where storage is unavailable (private mode, blocked site data). */
export function readInAppNav(): string | null {
  try {
    return window.sessionStorage.getItem(IN_APP_NAV_KEY);
  } catch {
    return null;
  }
}
