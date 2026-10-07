// Dev-only: screenshot a signed-in page as the demo user (pnpm seed:demo writes the cookie).
//   pnpm shot <path> [--w 390|1280] [--dark] [--theme dark|light|system] [--full] [--wait ms] [--out file.png]
// --dark sets the emulated OS scheme; --theme sets the eatri8-theme cookie (default "system", so the
// page follows --dark as it did before the appearance setting).
// Uses the installed Chrome through puppeteer-core; the dev server must be running.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { THEMES, type Theme } from "../lib/theme";
import { assertDev, demoCookie, goto, launch, newPage, setCookies, sleep } from "./lib/browser";

function parseArgs(argv: string[]) {
  const out = { path: "", width: 390, dark: false, theme: "system" as Theme, full: false, file: "", wait: 300 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--w" || a === "--width") out.width = Number(argv[++i]);
    else if (a === "--dark") out.dark = true;
    else if (a === "--theme") {
      const t = argv[++i] ?? "";
      if (!(THEMES as readonly string[]).includes(t)) throw new Error(`--theme must be one of ${THEMES.join(", ")}`);
      out.theme = t as Theme;
    } else if (a === "--full") out.full = true;
    else if (a === "--out") out.file = argv[++i] ?? "";
    else if (a === "--wait") out.wait = Number(argv[++i]); // e.g. let chart intros finish
    else if (!a.startsWith("--") && !out.path) out.path = a;
    else throw new Error(`Unknown argument ${a}`);
  }
  if (!out.path) throw new Error("Usage: pnpm shot <path> [--w 390|1280] [--dark] [--theme dark|light|system] [--full] [--wait ms] [--out file.png]");
  if (!Number.isInteger(out.width) || out.width < 200 || out.width > 3000) throw new Error("--w must be a width in px, e.g. 390 or 1280");
  if (!out.path.startsWith("/")) out.path = `/${out.path}`;
  return out;
}

async function main() {
  assertDev("shot");
  const args = parseArgs(process.argv.slice(2));
  demoCookie(); // fails early with a hint when pnpm seed:demo hasn't run
  const scheme = args.dark ? "dark" : "light";
  // Named for what you see: the OS scheme when the page follows it (System), else the forced theme.
  const look = args.theme === "system" ? scheme : `theme-${args.theme}`;
  const slug = args.path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home";
  const file = resolve(args.file || `.superpowers/shots/${slug}-${args.width}-${look}.png`) as `${string}.png`;
  mkdirSync(dirname(file), { recursive: true });

  const browser = await launch();
  try {
    await setCookies(browser, { theme: args.theme });
    const page = await newPage(browser, { width: args.width, scheme, height: args.width < 768 ? 844 : 900 });
    const { status, landed, url } = await goto(page, args.path);
    await sleep(args.wait);
    await page.screenshot({ path: file, fullPage: args.full });
    console.log(`${status || "?"} ${url}${landed !== new URL(url).pathname ? ` → redirected to ${landed}` : ""}`);
    console.log(file);
    if (status >= 400 || landed !== new URL(url).pathname) process.exitCode = 2; // signed out, bounced or errored
  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(process.exitCode ?? 0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
