/**
 * Appearance: Dark (the default), Light, or System (follows the OS). The choice lives in a cookie that
 * a tiny blocking script in <head> (THEME_SCRIPT, below) reads before first paint, so pages stay
 * static and nothing flashes. Without JS everyone sees Dark. The client side is
 * components/theme/theme-provider.tsx.
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

/** The `document.cookie` assignment that stores a choice for a year, site-wide. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Max-Age=${ONE_YEAR_S}; Path=/; SameSite=Lax`;
}

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The blocking <head> script: reads the cookie, applies parseTheme's rule (only the three names count,
 * anything else is the default), stamps <html data-theme> and points the theme-color meta at the
 * colour being shown. A minified twin of parseTheme, built from the same constants;
 * lib/theme.test.ts runs it against parseTheme for many cookie strings.
 */
export const THEME_SCRIPT =
  `(function(){try{var d=document.documentElement,m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]*)/),` +
  `t=m?m[1]:"";if(${JSON.stringify(THEMES)}.indexOf(t)<0)t=${JSON.stringify(DEFAULT_THEME)};d.dataset.theme=t;` +
  `var l=t==="light"||(t==="system"&&!matchMedia(${JSON.stringify(DARK_QUERY)}).matches),` +
  `c=l?${JSON.stringify(THEME_COLOR.light)}:${JSON.stringify(THEME_COLOR.dark)},` +
  `e=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<e.length;i++)e[i].setAttribute("content",c)}catch(_){}})()`;
