// Dev-only UI audit (pnpm ui:audit): visits every screen and the key interactive states in headless
// Chrome at 390×844 and 1280×800, in the Dark and Light themes (the eatri8-theme cookie), plus System
// under both OS schemes on /today, and checks spec §3's rules on each (see scripts/lib/audit-probe.ts):
// buttons never wrap, lime is never text, text contrast meets WCAG AA, tap targets are ≥ 44 px; and on
// /today, every meal card is the same height (±1 px), filled or empty, collapsed or with one expanded.
// Saves a screenshot of each to docs/design/qa/{page}-{w}-{theme}.png (git-ignored) and exits 1 on any
// offender. Read-only: it never saves, deletes or completes onboarding.
//   pnpm ui:audit [--only name,name] [--w 390|1280] [--theme dark|light|system] [--no-shots]
// Needs pnpm dev running and pnpm seed:demo's cookie.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import type { Theme } from "../lib/theme";
import { probe, type Finding, type ProbeResult } from "./lib/audit-probe";
import { FAKE_CAMERA_FLAGS, assertDev, baseUrl, demoCookie, goto, launch, newPage, setCookies, sleep } from "./lib/browser";

const OUT = resolve("docs/design/qa");
const WIDTHS = [390, 1280] as const;
const CONCURRENCY = 3;

type Ids = { aptamil: string; dal: string; paneer: string; spinach: string; scanLabel: string; scanBarcode: string; scanMeal: string; scanFailed: string };
type Scenario = {
  name: string;
  path: (ids: Ids) => string;
  signedIn?: boolean;
  /** Puts the page in the state to audit (opens a sheet, types a query…). Must not change data. */
  setup?: (page: Page) => Promise<void>;
  /** Shoot the viewport (overlays) rather than the full page. */
  viewportShot?: boolean;
  /** Only in these themes (default dark + light). */
  looks?: Look[];
  /** Extra page-specific checks, run after the probe at the real viewport size. */
  check?: (page: Page) => Promise<Finding[]>;
};
type Look = { theme: Theme; scheme: "light" | "dark"; label: string };
const DARK: Look = { theme: "dark", scheme: "light", label: "dark" }; // forced Dark while the OS says light
const LIGHT: Look = { theme: "light", scheme: "dark", label: "light" }; // forced Light while the OS says dark
const SYSTEM_DARK: Look = { theme: "system", scheme: "dark", label: "system-dark" };
const SYSTEM_LIGHT: Look = { theme: "system", scheme: "light", label: "system-light" };

// --- interaction helpers ---------------------------------------------------------------------------------
async function clickText(page: Page, selector: string, text: string) {
  const ok = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.textContent?.trim().includes(t));
    el?.click();
    return !!el;
  }, selector, text);
  if (!ok) throw new Error(`No ${selector} with text "${text}"`);
}
async function dialog(page: Page, role: "dialog" | "alertdialog" = "dialog") {
  await page.waitForSelector(`[role=${role}]`, { visible: true, timeout: 15_000 });
  await sleep(500); // let the open animation settle
}
async function search(page: Page, q: string) {
  const input = await page.waitForSelector("input[type=search]", { visible: true, timeout: 15_000 });
  await input!.click();
  await input!.type(q, { delay: 10 });
  await page.waitForFunction((needle: string) => [...document.querySelectorAll("li button")].some((b) => b.textContent?.toLowerCase().includes(needle)), { timeout: 20_000 }, q.toLowerCase().split(" ")[0]!.replace(/'.*/, ""));
  await sleep(400);
}
async function openFirstResult(page: Page) {
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("li > button:first-child")?.click());
  await dialog(page);
}
async function openEntry(page: Page) {
  await page.waitForSelector("button[aria-label^='Edit ']", { timeout: 15_000 });
  // Meal cards may be collapsed; the first Edit button that's rendered.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("button[aria-label^='Edit ']")?.click());
  await dialog(page);
}

/** Today's four meal cards ([data-meal-card]) must all be one height (±1 px), whatever they hold. */
async function equalMealCards(page: Page): Promise<Finding[]> {
  const cards = await page.$$eval("[data-meal-card]", (els) => els.map((e) => ({ meal: e.getAttribute("data-meal-card")!, h: e.getBoundingClientRect().height })));
  if (cards.length !== 4) return [{ rule: "height", selector: "[data-meal-card]", text: `${cards.length} cards`, detail: "expected 4 meal cards" }];
  const hs = cards.map((c) => c.h);
  if (Math.max(...hs) - Math.min(...hs) <= 1) return [];
  return [{ rule: "height", selector: "[data-meal-card]", text: cards.map((c) => `${c.meal} ${c.h.toFixed(1)}`).join(", "), detail: "meal cards differ in height by more than 1 px" }];
}
async function expandFirstMeal(page: Page) {
  await page.waitForSelector("[data-meal-card] button[aria-expanded=false]", { timeout: 15_000 });
  await page.click("[data-meal-card] button[aria-expanded=false]");
  await page.waitForSelector("[data-meal-card] button[aria-expanded=true]", { timeout: 5_000 });
  await sleep(200);
}

const SCENARIOS: Scenario[] = [
  { name: "today", path: () => "/today", check: equalMealCards },
  { name: "today-system", path: () => "/today", looks: [SYSTEM_DARK, SYSTEM_LIGHT], check: equalMealCards },
  // A meal expanded: its entries open inside the card on phones, as a full-width row under the pair on desktop.
  { name: "today-meal-open", path: () => "/today", setup: expandFirstMeal, check: equalMealCards },
  { name: "today-entry-sheet", path: () => "/today", setup: openEntry, viewportShot: true },
  {
    name: "today-delete-confirm", path: () => "/today", viewportShot: true,
    setup: async (p) => { await openEntry(p); await p.click("button[aria-label='Delete entry']"); await dialog(p, "alertdialog"); },
  },
  { name: "today-date-picker", path: () => "/today", viewportShot: true, setup: async (p) => { await p.click("button[aria-label='Pick a date']"); await dialog(p); } },
  { name: "foods-lunch", path: () => "/foods?meal=lunch" },
  { name: "foods-dal", path: () => "/foods?meal=lunch", setup: (p) => search(p, "dal") },
  { name: "foods-dal-sheet", path: () => "/foods?meal=lunch", viewportShot: true, setup: async (p) => { await search(p, "dal"); await openFirstResult(p); } },
  { name: "foods-aptamil", path: () => "/foods?meal=lunch", setup: (p) => search(p, "Aptamil") },
  { name: "foods-bhujia", path: () => "/foods?meal=lunch", setup: (p) => search(p, "Haldiram's Aloo Bhujia Masala Namkeen") },
  { name: "foods-new", path: () => "/foods/new" },
  { name: "food-dal", path: (i) => `/foods/${i.dal}` },
  { name: "food-aptamil", path: (i) => `/foods/${i.aptamil}` },
  // Micronutrient cards: an OFF paneer (label micros, a better pick) and a USDA food (every vitamin and mineral).
  { name: "food-paneer", path: (i) => `/foods/${i.paneer}` },
  { name: "food-paneer-ingredients", path: (i) => `/foods/${i.paneer}`, setup: async (p) => {
    await clickText(p, "[role=tab]", "Ingredients");
    await p.click("details summary");
    await sleep(200);
  } },
  { name: "food-spinach", path: (i) => `/foods/${i.spinach}` },
  {
    name: "scan", path: () => "/scan", viewportShot: true,
    setup: async (p) => { await p.waitForFunction(() => { const v = document.querySelector("video"); return !!v && v.videoWidth > 0; }, { timeout: 20_000 }); await sleep(600); },
  },
  { name: "scan-label", path: (i) => `/scans/${i.scanLabel}` },
  { name: "scan-barcode", path: (i) => `/scans/${i.scanBarcode}` },
  { name: "scan-meal", path: (i) => `/scans/${i.scanMeal}` },
  { name: "scan-failed", path: (i) => `/scans/${i.scanFailed}` },
  { name: "progress", path: () => "/progress", setup: () => sleep(1200) },
  { name: "progress-month", path: () => "/progress?range=month", setup: () => sleep(1200) },
  { name: "history", path: () => "/history" },
  { name: "me", path: () => "/me" },
  { name: "me-credits", path: () => "/me/credits", setup: () => sleep(800) },
  { name: "onboarding", path: () => "/onboarding?redo=1" },
  { name: "home", path: () => "/", signedIn: false },
  { name: "privacy", path: () => "/privacy", signedIn: false },
  { name: "terms", path: () => "/terms", signedIn: false },
  { name: "about-data", path: () => "/about/data", signedIn: false },
  { name: "sign-in", path: () => "/sign-in", signedIn: false },
];

function parseArgs(argv: string[]) {
  const out = { only: [] as string[], widths: [...WIDTHS] as number[], themes: [] as string[], shots: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--only") out.only = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (a === "--w") out.widths = [Number(argv[++i])];
    else if (a === "--theme") out.themes = [argv[++i] ?? ""];
    else if (a === "--no-shots") out.shots = false;
    else throw new Error(`Unknown argument ${a}`);
  }
  return out;
}

async function api<T>(path: string): Promise<T> {
  const [name, value] = demoCookie();
  const res = await fetch(new URL(path, baseUrl()), { headers: { cookie: `${name}=${value}` } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} (is pnpm dev running and the demo seeded?)`);
  return (await res.json()) as T;
}

async function resolveIds(): Promise<Ids> {
  type Hit = { id: string; name: string };
  const foods = async (q: string) => (await api<{ results: Hit[] }>(`/api/v1/foods?q=${encodeURIComponent(q)}`)).results;
  const aptamil = (await foods("Aptamil")).find((f) => f.name.startsWith("Aptamil Gold Stage 3")) ?? (await foods("Aptamil"))[0];
  const dal = (await foods("dal")).find((f) => f.name === "Dal") ?? (await foods("dal"))[0];
  type BrandHit = Hit & { brand: string | null; source: string };
  const paneers = (await foods("paneer")) as BrandHit[];
  const paneer = paneers.find((f) => f.name === "Paneer" && f.brand === "Vallhabha") ?? paneers.find((f) => f.source === "off");
  const spinach = (await foods("spinach raw")).find((f) => f.name === "Spinach, raw");
  const { scans } = await api<{ scans: { id: string; status: string; inputKind: string }[] }>("/api/v1/scans");
  const done = (kind: string) => scans.find((s) => s.status === "done" && s.inputKind === kind)?.id;
  const failed = scans.find((s) => s.status === "failed")?.id;
  const ids = { aptamil: aptamil?.id, dal: dal?.id, paneer: paneer?.id, spinach: spinach?.id, scanLabel: done("label"), scanBarcode: done("barcode"), scanMeal: done("meal"), scanFailed: failed };
  const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Demo data missing ${missing.join(", ")}: run pnpm seed:demo`);
  return ids as Ids;
}

type Run = { scenario: Scenario; width: number; look: Look };
type Outcome = { run: Run; result?: ProbeResult; error?: string; status?: number };

async function audit(browser: Browser, run: Run, ids: Ids, shots: boolean): Promise<Outcome> {
  const { scenario, width, look } = run;
  const context = await browser.createBrowserContext();
  try {
    await setCookies(context, { theme: look.theme, signedIn: scenario.signedIn !== false });
    const page = await newPage(context, { width, scheme: look.scheme });
    // tsx/esbuild wraps named functions in __name(); give the page a no-op so probe() serialises cleanly.
    await page.evaluateOnNewDocument("globalThis.__name = (f) => f;");
    const path = scenario.path(ids);
    const { status, landed } = await goto(page, path);
    if (status >= 400) return { run, status, error: `HTTP ${status}` };
    if (landed !== new URL(path, baseUrl()).pathname) return { run, status, error: `redirected to ${landed}` };
    await page.evaluate(() => document.fonts.ready);
    await scenario.setup?.(page);
    await sleep(250);
    const result = await page.evaluate(probe);
    if (scenario.check) result.findings.push(...(await scenario.check(page)));
    if (shots) {
      const file = `${OUT}/${scenario.name}-${width}-${look.label}.png` as const;
      if (!scenario.viewportShot) {
        // A full-page capture paints fixed bars (bottom nav, sticky actions) mid-page; instead grow the
        // viewport to the document (after the probe ran at the real size) so they sit at the bottom.
        const vp = page.viewport()!;
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        if (h > vp.height) { await page.setViewport({ ...vp, height: Math.min(h, 8000) }); await sleep(400); }
      }
      await page.screenshot({ path: file });
    }
    if (scenario.name === "today-delete-confirm") {
      // Cancel and make sure the dialog closed without deleting anything.
      await clickText(page, "[role=alertdialog] button", "Keep it");
      await page.waitForSelector("[role=alertdialog]", { hidden: true, timeout: 5_000 });
    }
    return { run, status, result };
  } catch (e) {
    return { run, error: e instanceof Error ? e.message.split("\n")[0] : String(e) };
  } finally {
    await context.close();
  }
}

async function main() {
  assertDev("ui:audit");
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(OUT, { recursive: true });
  const ids = await resolveIds();
  const scenarios = SCENARIOS.filter((s) => !args.only.length || args.only.includes(s.name));
  const runs: Run[] = [];
  for (const scenario of scenarios) {
    for (const width of args.widths) {
      for (const look of scenario.looks ?? [DARK, LIGHT]) {
        if (args.themes.length && !args.themes.includes(look.theme)) continue;
        runs.push({ scenario, width, look });
      }
    }
  }
  console.log(`ui:audit — ${scenarios.length} screens, ${runs.length} runs against ${baseUrl().origin}`);

  const browser = await launch(FAKE_CAMERA_FLAGS);
  const outcomes: Outcome[] = [];
  try {
    const queue = [...runs];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      for (let run = queue.shift(); run; run = queue.shift()) {
        const o = await audit(browser, run, ids, args.shots);
        outcomes.push(o);
        const tag = `${run.scenario.name} ${run.width} ${run.look.label}`;
        if (o.error) console.log(`  ✗ ${tag}: ${o.error}`);
        else console.log(`  ${o.result!.findings.length ? "✗" : "✓"} ${tag} (${o.result!.findings.length} offenders, ${o.result!.checked.text} text, ${o.result!.checked.controls} controls, ${o.result!.checked.targets} targets)`);
      }
    }));
  } finally {
    await browser.close();
  }

  // Group identical offenders across runs so one bug prints once with where it shows up.
  const groups = new Map<string, { f: Finding; where: string[] }>();
  for (const o of outcomes) {
    for (const f of o.result?.findings ?? []) {
      const key = `${f.rule}|${o.run.scenario.name}|${f.selector}|${f.text}|${f.rule === "contrast" ? f.detail : ""}`;
      const g = groups.get(key) ?? { f, where: [] };
      g.where.push(`${o.run.width}/${o.run.look.label}`);
      groups.set(key, g);
    }
  }
  const errors = outcomes.filter((o) => o.error);
  for (const o of errors) console.log(`[error] ${o.run.scenario.name} @ ${o.run.width}/${o.run.look.label}: ${o.error}`);
  const byRule = new Map<string, number>();
  for (const [key, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const [rule, page] = key.split("|");
    byRule.set(rule!, (byRule.get(rule!) ?? 0) + 1);
    console.log(`\n[${rule}] ${page} @ ${g.where.join(", ")}\n  ${g.f.selector}\n  "${g.f.text}" — ${g.f.detail}`);
  }
  const skipped = outcomes.reduce((n, o) => n + (o.result?.checked.contrastSkipped ?? 0), 0);
  console.log(`\n${runs.length - errors.length}/${runs.length} runs audited; ${groups.size} offenders (${[...byRule].map(([r, n]) => `${r} ${n}`).join(", ") || "none"}); ${errors.length} errors; ${skipped} text nodes over images/gradients not contrast-checked.`);
  if (args.shots) console.log(`Screenshots: ${OUT}`);
  if (groups.size || errors.length) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
