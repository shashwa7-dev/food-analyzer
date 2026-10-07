/**
 * Appearance: Dark (the default), Light, or System (follows the OS). The choice lives in a cookie,
 * not localStorage, so the server render already carries `<html data-theme>` and nothing flashes.
 * Pure helpers only; the client side is components/theme/theme-provider.tsx.
 */
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "eatri8-theme";
export const DEFAULT_THEME: Theme = "dark";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

/** The browser chrome colour for each palette: globals.css --bg in light and dark. */
export const THEME_COLOR = { light: "#FAFBF6", dark: "#11140F" } as const;

export const THEME_LABEL: Record<Theme, string> = { dark: "Dark", light: "Light", system: "System" };

/** A cookie value to a theme: anything missing or unknown is the default, Dark. */
export function parseTheme(value: string | null | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : DEFAULT_THEME;
}

/** The sidebar button's cycle: Dark → Light → System → Dark. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

/** The `document.cookie` assignment that stores a choice for a year, site-wide. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Max-Age=${ONE_YEAR_S}; Path=/; SameSite=Lax`;
}

/** The viewport themeColor for a choice: one colour when it's fixed, the media pair for System. */
export function themeColorFor(theme: Theme): string | { media: string; color: string }[] {
  if (theme !== "system") return THEME_COLOR[theme];
  return [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ];
}
