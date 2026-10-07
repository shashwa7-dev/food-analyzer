"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { THEME_COLOR, themeCookie, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

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

/**
 * Holds the appearance choice. The server render already has the right `data-theme` (root layout
 * reads the cookie); a change here applies at once with no reload: cookie, `<html data-theme>`, the
 * theme-color meta, then a background refresh so the server-rendered viewport and layout agree.
 */
export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState(initial);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const setTheme = useCallback((next: Theme) => {
    document.cookie = themeCookie(next);
    document.documentElement.dataset.theme = next;
    paintThemeColor(next);
    setThemeState(next);
    startTransition(() => router.refresh());
  }, [router]);

  // System follows the OS live: CSS does that on its own; the theme-color meta, once painted with
  // one colour above, needs a nudge.
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
