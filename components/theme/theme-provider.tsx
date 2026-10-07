"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DARK_QUERY, DEFAULT_THEME, THEME_COLOR, parseTheme, themeCookie, type Theme } from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Points every `<meta name="theme-color">` at the colour the page is showing right now. */
function paintThemeColor(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = dark ? THEME_COLOR.dark : THEME_COLOR.light;
  }
}

// The source of truth is <html data-theme>, stamped from the cookie by THEME_SCRIPT before first
// paint. The server render (static) knows nothing, so it renders the default; after hydration the
// controls show the real choice.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = () => parseTheme(document.documentElement.dataset.theme);
const serverTheme = () => DEFAULT_THEME;

/**
 * The appearance choice. A change applies at once with no reload and no server round trip: the cookie
 * (for the next page load's script), `<html data-theme>` (the palette, and this store) and the
 * theme-color meta.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const setTheme = useCallback((next: Theme) => {
    document.cookie = themeCookie(next);
    document.documentElement.dataset.theme = next;
    paintThemeColor(next);
  }, []);

  // System follows the OS live: CSS does that on its own; the theme-color meta needs a nudge.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => paintThemeColor("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
