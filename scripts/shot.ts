// Dev-only: screenshot a signed-in page as the demo user (pnpm seed:demo writes the cookie).
//   pnpm shot <path> [--w 390|1280] [--dark] [--full] [--wait ms] [--out file.png]
// Uses the installed Chrome through puppeteer-core; the dev server must be running.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const COOKIE_FILE = resolve(".superpowers/demo-cookie.txt");
// Hides the Next.js dev indicator / overlay badge without touching next.config.ts.
const HIDE_DEV_UI = "nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher { display: none !important; }";

function parseArgs(argv: string[]) {
  const out = { path: "", width: 390, dark: false, full: false, file: "", wait: 300 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--w" || a === "--width") out.width = Number(argv[++i]);
    else if (a === "--dark") out.dark = true;
    else if (a === "--full") out.full = true;
    else if (a === "--out") out.file = argv[++i] ?? "";
    else if (a === "--wait") out.wait = Number(argv[++i]); // e.g. let chart intros finish
    else if (!a.startsWith("--") && !out.path) out.path = a;
    else throw new Error(`Unknown argument ${a}`);
  }
  if (!out.path) throw new Error("Usage: pnpm shot <path> [--w 390|1280] [--dark] [--full] [--wait ms] [--out file.png]");
  if (!Number.isInteger(out.width) || out.width < 200 || out.width > 3000) throw new Error("--w must be a width in px, e.g. 390 or 1280");
  if (!out.path.startsWith("/")) out.path = `/${out.path}`;
  return out;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("shot is dev only.");
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(COOKIE_FILE)) throw new Error("No demo cookie. Run pnpm seed:demo first.");
  const line = readFileSync(COOKIE_FILE, "utf8").trim();
  const eq = line.indexOf("=");
  const [name, value] = [line.slice(0, eq), line.slice(eq + 1)];
  const base = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  const theme = args.dark ? "dark" : "light";
  const slug = args.path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home";
  const file = resolve(args.file || `.superpowers/shots/${slug}-${args.width}-${theme}.png`) as `${string}.png`;
  mkdirSync(dirname(file), { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-first-run", "--no-default-browser-check"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: args.width, height: args.width < 768 ? 844 : 900, deviceScaleFactor: 2, isMobile: args.width < 768, hasTouch: args.width < 768 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    await browser.setCookie({ name, value, domain: base.hostname, path: "/", httpOnly: true, secure: name.startsWith("__Secure-"), sameSite: "Lax" });
    const url = new URL(args.path, base).toString();
    const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.addStyleTag({ content: HIDE_DEV_UI });
    await new Promise((r) => setTimeout(r, args.wait));
    await page.screenshot({ path: file, fullPage: args.full });
    const landed = new URL(page.url()).pathname;
    console.log(`${res?.status() ?? "?"} ${url}${landed !== new URL(url).pathname ? ` → redirected to ${landed}` : ""}`);
    console.log(file);
    const status = res?.status() ?? 0;
    if (status >= 400 || landed !== new URL(url).pathname) process.exitCode = 2; // signed out, bounced or errored
  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(process.exitCode ?? 0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
