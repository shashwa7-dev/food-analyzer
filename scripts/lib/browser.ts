// Dev-only helpers shared by pnpm shot and pnpm ui:audit: headless Chrome (the installed one, through
// puppeteer-core) with the demo session (pnpm seed:demo writes the cookie) and the eatri8-theme cookie.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer, { type Browser, type BrowserContext, type Page } from "puppeteer-core";
import { THEME_COOKIE, type Theme } from "../../lib/theme";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const COOKIE_FILE = resolve(".superpowers/demo-cookie.txt");
// Hides the Next.js dev indicator / overlay badge without touching next.config.ts.
export const HIDE_DEV_UI = "nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher { display: none !important; }";
// The scanner needs a camera: Chrome's fake device plus auto-accepted permission.
export const FAKE_CAMERA_FLAGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];

export const baseUrl = () => new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");

export function assertDev(what: string) {
  if (process.env.NODE_ENV === "production") throw new Error(`${what} is dev only.`);
}

/** The demo session cookie as [name, value]. */
export function demoCookie(): [string, string] {
  if (!existsSync(COOKIE_FILE)) throw new Error("No demo cookie. Run pnpm seed:demo first.");
  const line = readFileSync(COOKIE_FILE, "utf8").trim();
  const eq = line.indexOf("=");
  return [line.slice(0, eq), line.slice(eq + 1)];
}

export function launch(extraArgs: string[] = []): Promise<Browser> {
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-first-run", "--no-default-browser-check", ...extraArgs] });
}

export type PageOpts = {
  width: number;
  /** Emulated OS colour scheme. */
  scheme: "light" | "dark";
  /** The eatri8-theme cookie. */
  theme: Theme;
  /** Send the demo session cookie (false = signed out). */
  signedIn?: boolean;
};

/** Sets the session (unless signed out) and theme cookies on a browser or an isolated context. */
export async function setCookies(target: Browser | BrowserContext, { theme, signedIn = true }: Pick<PageOpts, "theme" | "signedIn">) {
  const base = baseUrl();
  const cookies = [{ name: THEME_COOKIE, value: theme, domain: base.hostname, path: "/", sameSite: "Lax" as const }];
  if (signedIn) {
    const [name, value] = demoCookie();
    cookies.push({ name, value, domain: base.hostname, path: "/", httpOnly: true, secure: name.startsWith("__Secure-"), sameSite: "Lax" } as (typeof cookies)[number]);
  }
  await target.setCookie(...cookies);
}

/** A new page at the mobile (< 768 px, touch) or desktop viewport, with the colour scheme emulated. */
export async function newPage(target: Browser | BrowserContext, { width, scheme, height }: Pick<PageOpts, "width" | "scheme"> & { height?: number }): Promise<Page> {
  const page = await target.newPage();
  const mobile = width < 768;
  await page.setViewport({ width, height: height ?? (mobile ? 844 : 800), deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  return page;
}

/** Navigates and hides the dev overlay; returns the response status and the pathname it landed on. */
export async function goto(page: Page, path: string): Promise<{ status: number; landed: string; url: string }> {
  const url = new URL(path, baseUrl()).toString();
  const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 90_000 });
  await page.addStyleTag({ content: HIDE_DEV_UI });
  return { status: res?.status() ?? 0, landed: new URL(page.url()).pathname, url };
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
