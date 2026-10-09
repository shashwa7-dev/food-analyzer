// Dev-only UI audit (pnpm ui:audit): visits every screen and the key interactive states in headless
// Chrome at 390×844 and 1280×800, in the Dark and Light themes (the eatri8-theme cookie), plus System
// under both OS schemes on /today, and checks spec §3's rules on each (see scripts/lib/audit-probe.ts):
// buttons never wrap, lime is never text, text contrast meets WCAG AA, tap targets are ≥ 44 px; and on
// /today, every meal card is the same height (±1 px), filled or empty, collapsed or with one expanded.
// Saves a screenshot of each to docs/design/qa/{page}-{w}-{theme}.png (git-ignored) and exits 1 on any
// offender. Read-only, except for a fixture: it posts two gym workouts for the demo user (a baseline
// and a session that beats it, so the summary shows a PR) before the runs and deletes both after.
//   pnpm ui:audit [--only name,name] [--w 390|1280] [--theme dark|light|system] [--no-shots]
// Needs pnpm dev running and pnpm seed:demo's cookies (the demo user, plus Fresh and Starter for the workouts states).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import type { Theme } from "../lib/theme";
import { probe, type Finding, type ProbeResult } from "./lib/audit-probe";
import { type DemoUser, FAKE_CAMERA_FLAGS, assertDev, baseUrl, demoCookie, goto, launch, newPage, setCookies, sleep } from "./lib/browser";

const OUT = resolve("docs/design/qa");
const WIDTHS = [390, 1280] as const;
const CONCURRENCY = 3;

type Ids = { aptamil: string; dal: string; paneer: string; spinach: string; milk: string; scanLabel: string; scanBarcode: string; scanMeal: string; scanFailed: string; workout: string };
type Scenario = {
  name: string;
  path: (ids: Ids) => string;
  signedIn?: boolean;
  /** Whose session to send (default "demo"): "fresh" has no fitness setup, "starter" has no workouts. */
  user?: DemoUser;
  /** Puts the page in the state to audit (opens a sheet, types a query…). Must not change data. */
  setup?: (page: Page) => Promise<void>;
  /** Shoot the viewport (overlays) rather than the full page. */
  viewportShot?: boolean;
  /** Only in these themes (default dark + light). */
  looks?: Look[];
  /** Extra page-specific checks, run after the probe at the real viewport size. */
  check?: (page: Page) => Promise<Finding[]>;
  /**
   * Only with the Pro gates on ("locked": dev started with PRO_GATES_ENFORCED=true, the demo user on
   * Basic) or only with them off ("open"). Detected from GET /api/v1/progress?range=month (403 = locked).
   */
  gates?: "locked" | "open";
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

/** Click after centring: scrolled only just into view, a control sits under the phone's fixed bottom nav, which takes the click. */
async function centreClick(page: Page, selector: string) {
  await page.$eval(selector, (b) => b.scrollIntoView({ block: "center" }));
  await page.click(selector);
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
  // Centre it first: scrolled only just into view, it sits under the phone's fixed bottom nav, which takes the click.
  await page.$eval("[data-meal-card] button[aria-expanded=false]", (b) => b.scrollIntoView({ block: "center" }));
  await page.click("[data-meal-card] button[aria-expanded=false]");
  await page.waitForSelector("[data-meal-card] button[aria-expanded=true]", { timeout: 5_000 });
  await sleep(200);
}

/** Every selector must be on the page: the Pro locks (and the targets notice) while the gates are on. */
const expectAll = (...selectors: string[]) => async (page: Page): Promise<Finding[]> => {
  const out: Finding[] = [];
  for (const sel of selectors) if (!(await page.$(sel))) out.push({ rule: "missing", selector: sel, text: "", detail: "expected on this page while the Pro gates are on" });
  return out;
};
/**
 * The home page (also /sign-in). On a phone the sign-in bar is pinned to the bottom: the Google
 * button must be on screen before any scrolling, and at the end of the page the bar must not cover
 * the last feature row or the links under it. From 900 px the page is one screen with no bar.
 */
async function landingBar(page: Page): Promise<Finding[]> {
  return page.evaluate(async (): Promise<Finding[]> => {
    const out: Finding[] = [];
    const bar = document.querySelector<HTMLElement>("[data-signin-bar]");
    const button = bar?.querySelector("button");
    if (!bar || !button) return [{ rule: "missing", selector: "[data-signin-bar] button", text: "", detail: "the landing page's sign-in bar" }];
    const b = button.getBoundingClientRect();
    if (b.top < 0 || b.bottom > innerHeight) out.push({ rule: "missing", selector: "[data-signin-bar] button", text: button.textContent ?? "", detail: "Continue with Google is off screen before scrolling" });
    if (getComputedStyle(bar).position !== "fixed") return out;
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 200));
    const buttonTop = button.getBoundingClientRect().top;
    for (const sel of ["main ul > li:last-child", "main nav:last-of-type a:last-child"]) {
      const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.getBoundingClientRect().width > 0);
      if (!el) out.push({ rule: "missing", selector: sel, text: "", detail: "expected on the landing page" });
      else if (el.getBoundingClientRect().bottom > buttonTop) out.push({ rule: "missing", selector: sel, text: el.textContent ?? "", detail: "covered by the pinned sign-in bar at the end of the page" });
    }
    scrollTo(0, 0);
    return out;
  });
}
/** /workouts for a user who hasn't set up training: the setup form, every input labelled. */
async function workoutsSetup(page: Page): Promise<Finding[]> {
  return page.evaluate((): Finding[] => {
    const out: Finding[] = [];
    const h1 = document.querySelector("h1")?.textContent?.trim();
    if (h1 !== "Set up your training") out.push({ rule: "missing", selector: "h1", text: h1 ?? "", detail: 'expected "Set up your training"' });
    for (const i of document.querySelectorAll<HTMLInputElement>("input:not([type=hidden])")) {
      const named = i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.labels?.length;
      if (!named) out.push({ rule: "label", selector: `input${i.name ? `[name=${i.name}]` : ""}`, text: i.placeholder, detail: "input has no label" });
    }
    return out;
  });
}
/** /workouts for a user with no workouts yet: the empty hub (no History), six preset links. */
async function workoutsEmpty(page: Page): Promise<Finding[]> {
  return page.evaluate((): Finding[] => {
    const out: Finding[] = [];
    // Inside <main>: the app's own nav also has a History link.
    const history = [...document.querySelectorAll("main *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim() === "History"));
    if (history.length) out.push({ rule: "unexpected", selector: history[0]!.tagName.toLowerCase(), text: "History", detail: "the empty hub shouldn't show History" });
    const presets = document.querySelectorAll("a[href^='/workouts/session?preset='], a[href='/workouts/session']").length;
    if (presets !== 6) out.push({ rule: "missing", selector: "a[href^='/workouts/session']", text: `${presets} links`, detail: "expected 6 preset links" });
    return out;
  });
}
/** /workouts with the Pro gates on: one blurred preview with "See Pro"; no live tablist outside an aria-hidden subtree. */
async function workoutsLocked(page: Page): Promise<Finding[]> {
  return page.evaluate((): Finding[] => {
    const out: Finding[] = [];
    if (![...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "See Pro")) out.push({ rule: "missing", selector: "button", text: "See Pro", detail: "expected the preview's See Pro button" });
    const live = [...document.querySelectorAll("[role=tablist]")].filter((t) => !t.closest("[aria-hidden]"));
    if (live.length) out.push({ rule: "unexpected", selector: "[role=tablist]", text: "", detail: "a live tablist is reachable while Trends is locked" });
    return out;
  });
}
/**
 * A done scan's result: one h1 (the name) in a title row that holds the image tile (an img or the icon);
 * from md the add panel sits in an aside, and the phone bar is hidden. Phones have the sticky bar and no visible aside.
 */
async function scanResult(page: Page): Promise<Finding[]> {
  return page.evaluate((): Finding[] => {
    const out: Finding[] = [];
    const miss = (selector: string, detail: string) => out.push({ rule: "missing", selector, text: "", detail });
    const visible = (el: Element | null) => !!el && (el as HTMLElement).getClientRects().length > 0;
    const h1s = document.querySelectorAll("h1").length;
    if (h1s !== 1) miss("h1", `expected one h1, found ${h1s}`);
    const title = document.querySelector("[data-scan-title]");
    const tile = title?.querySelector("[data-scan-image]");
    if (!title || !tile || !title.contains(document.querySelector("h1"))) miss("[data-scan-title] [data-scan-image]", "the title row needs the image tile beside the name");
    else if (tile.tagName === "IMG" ? !(tile as HTMLImageElement).alt.endsWith(", scan photo") : tile.getAttribute("aria-hidden") !== "true") miss("[data-scan-image]", "an image tile needs alt text; the icon tile must be aria-hidden");
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const aside = document.querySelector("aside");
    const bar = document.querySelector("[data-sticky-actions]");
    if (desktop) {
      if (!aside || !visible(aside)) miss("aside", "expected the add panel in an aside on desktop");
      else if (![...aside.querySelectorAll("button")].some((b) => /^Add to /.test(b.textContent?.trim() ?? ""))) miss("aside button", "the aside needs an Add to {meal} button");
      if (visible(bar)) out.push({ rule: "unexpected", selector: "[data-sticky-actions]", text: "", detail: "no floating bar on desktop" });
    } else {
      if (visible(aside)) out.push({ rule: "unexpected", selector: "aside", text: "", detail: "the add panel is desktop only" });
      if (!visible(bar)) miss("[data-sticky-actions]", "expected the phone add bar");
    }
    return out;
  });
}
/** A failed scan: the card with its one recovery action; none of the result layout (no tile, no aside, no add bar). */
async function scanFailed(page: Page): Promise<Finding[]> {
  return page.evaluate((): Finding[] => {
    const out: Finding[] = [];
    if (!document.querySelector("[role=alert]")) out.push({ rule: "missing", selector: "[role=alert]", text: "", detail: "expected the failure message" });
    for (const sel of ["aside", "[data-scan-image]", "[data-sticky-actions]"]) if (document.querySelector(sel)) out.push({ rule: "unexpected", selector: sel, text: "", detail: "a failed scan has no result layout" });
    return out;
  });
}
const MONTH_LOCK = "button[aria-label='Month, a Pro feature']";
const EXPORT_LOCK = "button[aria-label='Export data, a Pro feature']";
const NOTICE = "section[aria-label='Targets notice']";
async function openRow(page: Page, label: string) {
  await clickText(page, "button[aria-haspopup=dialog]", label);
  await dialog(page);
}

const SCENARIOS: Scenario[] = [
  { name: "today", path: () => "/today", check: equalMealCards },
  { name: "today-energy", path: () => "/today", check: expectAll("section[aria-label^='Energy balance']", "section[aria-labelledby] a[href='/workouts/new']") },
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
  // Phones fold the vitamins after six; opened here.
  { name: "food-spinach-all", path: (i) => `/foods/${i.spinach}`, setup: async (p) => {
    await p.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")].find((b) => b.textContent?.startsWith("Show all"))?.click());
    await sleep(200);
  } },
  // More than five unit options: the add panel's unit select.
  { name: "food-milk", path: (i) => `/foods/${i.milk}` },
  {
    name: "scan", path: () => "/scan", viewportShot: true,
    setup: async (p) => { await p.waitForFunction(() => { const v = document.querySelector("video"); return !!v && v.videoWidth > 0; }, { timeout: 20_000 }); await sleep(600); },
  },
  { name: "scan-label", path: (i) => `/scans/${i.scanLabel}`, check: scanResult },
  { name: "scan-barcode", path: (i) => `/scans/${i.scanBarcode}`, check: scanResult },
  { name: "scan-meal", path: (i) => `/scans/${i.scanMeal}`, check: scanResult },
  { name: "scan-failed", path: (i) => `/scans/${i.scanFailed}`, check: scanFailed },
  { name: "progress", path: () => "/progress", setup: () => sleep(1200) },
  { name: "progress-month", path: () => "/progress?range=month", setup: () => sleep(1200) },
  { name: "workouts", path: () => "/workouts", setup: () => sleep(1200), check: expectAll("section[aria-label='Weekly goal']", "a[href='/weight']") },
  { name: "workouts-setup", user: "fresh", path: () => "/workouts", check: workoutsSetup },
  { name: "workouts-empty", user: "starter", path: () => "/workouts", check: workoutsEmpty },
  { name: "workouts-month", gates: "open", path: () => "/workouts?range=month", setup: () => sleep(1200), check: expectAll("[role=tablist]", "[role=list][aria-label=Calendar]") },
  { name: "workouts-volume", gates: "open", path: () => "/workouts", viewportShot: false, setup: async (p) => { await clickText(p, "[role=tab]", "Volume"); await p.waitForSelector("svg[role=img]", { visible: true, timeout: 5_000 }); await sleep(600); }, check: expectAll("svg[role=img]") },
  { name: "workouts-locked", gates: "locked", path: () => "/workouts", setup: () => sleep(1200), check: workoutsLocked },
  { name: "weight", path: () => "/weight", setup: () => sleep(1200), check: expectAll("[aria-label^='Weight over the last 30 days']", "button[aria-label^='Delete ']") },
  { name: "weight-log-sheet", path: () => "/weight", viewportShot: true, setup: async (p) => { await clickText(p, "button[aria-haspopup=dialog]", "Log weight"); await dialog(p); }, check: expectAll("[role=dialog] input[aria-label='Weight, kg']", "[role=dialog] input[type=date]") },
  { name: "weight-delete-confirm", path: () => "/weight", viewportShot: true, setup: async (p) => { await p.click("button[aria-label^='Delete ']"); await dialog(p, "alertdialog"); } },
  { name: "workouts-new", path: () => "/workouts/new" },
  { name: "workouts-activity-sheet", path: () => "/workouts/new", viewportShot: true, setup: async (p) => { await p.click("button[aria-haspopup=dialog]"); await dialog(p); } },
  // A gym session in progress: a draft in localStorage (this run's context only) shows the resume banner.
  { name: "workouts-resume", path: () => "/workouts/new", setup: async (p) => {
    await p.evaluate(async () => {
      const s = (await (await fetch("/api/auth/get-session")).json()) as { user: { id: string } };
      const startedAt = new Date(Date.now() - 23 * 60_000).toISOString();
      localStorage.setItem(`eatri8-workout-draft:${s.user.id}`, JSON.stringify({ version: 1, preset: "push", title: "Push day", startedAt, date: startedAt.slice(0, 10), intensity: "moderate", exercises: [] }));
    });
    await p.reload();
    await p.waitForSelector("section[aria-label='Session in progress']");
  } },
  // The live session on the push preset, one set filled and ticked. The draft stays in this run's
  // context only; nothing is posted.
  { name: "workouts-session", path: () => "/workouts/session?preset=push", setup: async (p) => {
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("eatri8-workout-draft")) localStorage.removeItem(k); });
    await goto(p, "/workouts/session?preset=push");
    const kg = await p.waitForSelector("input[aria-label='Set 1 weight, kg']", { visible: true, timeout: 15_000 });
    await kg!.type("60");
    await p.type("input[aria-label='Set 1 reps']", "8");
    await p.click("button[aria-label='Set 1 done']");
    await p.waitForSelector("button[aria-label='Set 1 done'][aria-pressed=true]");
    await sleep(200);
  } },
  // A saved gym session with a PR and a set left undone (the fixture below), and its editor.
  { name: "workouts-summary", path: (i) => `/workouts/${i.workout}` },
  { name: "workouts-edit", path: (i) => `/workouts/${i.workout}/edit`, setup: async (p) => { await p.waitForSelector("input[aria-label='Duration, minutes']"); } },
  { name: "history", path: () => "/history" },
  { name: "me", path: () => "/me" },
  { name: "me-fitness-sheet", path: () => "/me", viewportShot: true, setup: (p) => openRow(p, "Fitness"), check: expectAll("[role=dialog] input[aria-label^='Goal weight']") },
  { name: "me-credits", path: () => "/me/credits", setup: () => sleep(800) },
  { name: "me-export-sheet", path: () => "/me", gates: "open", viewportShot: true, setup: (p) => openRow(p, "Export data") },
  { name: "onboarding", path: () => "/onboarding?redo=1" },
  // Pro gates on, Basic plan (spec §B): every lock shows, and opens the upgrade sheet.
  { name: "today-locked", path: () => "/today", gates: "locked", check: expectAll(NOTICE) },
  { name: "progress-locked", path: () => "/progress", gates: "locked", setup: () => sleep(1200), check: expectAll(MONTH_LOCK) },
  { name: "progress-upgrade-sheet", path: () => "/progress", gates: "locked", viewportShot: true, setup: async (p) => { await p.click(MONTH_LOCK); await dialog(p); } },
  { name: "me-locked", path: () => "/me", gates: "locked", check: expectAll(NOTICE, EXPORT_LOCK) },
  { name: "me-goal-locked", path: () => "/me", gates: "locked", viewportShot: true, setup: (p) => openRow(p, "Goal"), check: expectAll("[role=dialog] button[aria-label='Custom targets: part of Pro. See plans']") },
  { name: "me-export-upgrade", path: () => "/me", gates: "locked", viewportShot: true, setup: async (p) => { await centreClick(p, EXPORT_LOCK); await dialog(p); } },
  { name: "me-scans-upsell", path: () => "/me", gates: "locked", viewportShot: true, setup: (p) => openRow(p, "AI scans a month") },
  { name: "home", path: () => "/", signedIn: false, check: landingBar },
  { name: "privacy", path: () => "/privacy", signedIn: false },
  { name: "terms", path: () => "/terms", signedIn: false },
  { name: "about-data", path: () => "/about/data", signedIn: false },
  { name: "sign-in", path: () => "/sign-in", signedIn: false, check: landingBar },
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

/** POST/DELETE as the demo user (the workout fixture only). */
async function send<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const [name, value] = demoCookie();
  const res = await fetch(new URL(path, baseUrl()), { method, headers: { cookie: `${name}=${value}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok && !(method === "DELETE" && res.status === 404)) throw new Error(`${method} ${path} → ${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/**
 * The workout fixture: a baseline bench session yesterday, then today's push day that beats it (a PR),
 * with a custom exercise and an exercise whose only set wasn't done. Returns every id created, the
 * summary's last; the caller deletes them all.
 */
async function createWorkoutFixture(created: string[]): Promise<string> {
  const s = (weightKg: number | null, reps: number | null, done = true) => ({ weightKg, reps, done });
  const now = Date.now();
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  type Res = { workout: { id: string } };
  const post = async (body: unknown) => {
    const { workout } = await send<Res>("POST", "/api/v1/workouts", body);
    created.push(workout.id);
    return workout.id;
  };
  await post({ kind: "gym", date: day(now - 86_400_000), preset: "push", durationMin: 40, startedAt: new Date(now - 86_400_000).toISOString(), exercises: [{ exerciseKey: "bench_press", sets: [s(60, 8)] }] });
  return post({
    kind: "gym", date: day(now), preset: "push", durationMin: 48, startedAt: new Date(now - 60 * 60_000).toISOString(),
    exercises: [
      { exerciseKey: "bench_press", sets: [s(62.5, 8), s(62.5, 7), s(62.5, 6)] },
      { exerciseKey: "overhead_press", sets: [s(35, 8), s(35, 8), s(35, 7)] },
      { exerciseKey: "lateral_raise", sets: [s(8, 12, false)] },
      { name: "Cable fly", sets: [s(15, 12), s(15, 12)] },
    ],
  });
}

async function resolveIds(): Promise<Omit<Ids, "workout">> {
  type Hit = { id: string; name: string };
  const foods = async (q: string) => (await api<{ results: Hit[] }>(`/api/v1/foods?q=${encodeURIComponent(q)}`)).results;
  const aptamil = (await foods("Aptamil")).find((f) => f.name.startsWith("Aptamil Gold Stage 3")) ?? (await foods("Aptamil"))[0];
  const dal = (await foods("dal")).find((f) => f.name === "Dal") ?? (await foods("dal"))[0];
  type BrandHit = Hit & { brand: string | null; source: string };
  const paneers = (await foods("paneer")) as BrandHit[];
  const paneer = paneers.find((f) => f.name === "Paneer" && f.brand === "Vallhabha") ?? paneers.find((f) => f.source === "off");
  const spinach = (await foods("spinach raw")).find((f) => f.name === "Spinach, raw");
  const milk = (await foods("milk whole")).find((f) => f.name === "Milk, whole");
  const { scans } = await api<{ scans: { id: string; status: string; inputKind: string }[] }>("/api/v1/scans");
  const done = (kind: string) => scans.find((s) => s.status === "done" && s.inputKind === kind)?.id;
  const failed = scans.find((s) => s.status === "failed")?.id;
  const ids = { aptamil: aptamil?.id, dal: dal?.id, paneer: paneer?.id, spinach: spinach?.id, milk: milk?.id, scanLabel: done("label"), scanBarcode: done("barcode"), scanMeal: done("meal"), scanFailed: failed };
  const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Demo data missing ${missing.join(", ")}: run pnpm seed:demo`);
  return ids as Omit<Ids, "workout">;
}

/** "locked" when the server enforces the Pro gates for the (Basic) demo user. */
async function gatesMode(): Promise<"locked" | "open"> {
  const [name, value] = demoCookie();
  const res = await fetch(new URL("/api/v1/progress?range=month", baseUrl()), { headers: { cookie: `${name}=${value}` } });
  if (res.status === 403) return "locked";
  if (!res.ok) throw new Error(`GET /api/v1/progress?range=month → ${res.status}`);
  return "open";
}

type Run = { scenario: Scenario; width: number; look: Look };
type Outcome = { run: Run; result?: ProbeResult; error?: string; status?: number };

async function audit(browser: Browser, run: Run, ids: Ids, shots: boolean): Promise<Outcome> {
  const { scenario, width, look } = run;
  const context = await browser.createBrowserContext();
  try {
    await setCookies(context, { theme: look.theme, signedIn: scenario.signedIn !== false, user: scenario.user });
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
  const gates = await gatesMode();
  const scenarios = SCENARIOS.filter((s) => (!s.gates || s.gates === gates) && (!args.only.length || args.only.includes(s.name)));
  const created: string[] = [];
  try {
    const needsWorkout = scenarios.some((s) => s.name.startsWith("workouts-summary") || s.name.startsWith("workouts-edit"));
    const ids: Ids = { ...(await resolveIds()), workout: needsWorkout ? await createWorkoutFixture(created) : "" };
    await run(args, scenarios, ids, gates);
  } finally {
    for (const id of created.reverse()) await send("DELETE", `/api/v1/workouts/${id}`).catch((e: unknown) => console.error(`Couldn't delete fixture workout ${id}:`, e));
  }
}

async function run(args: ReturnType<typeof parseArgs>, scenarios: Scenario[], ids: Ids, gates: "locked" | "open") {
  const runs: Run[] = [];
  for (const scenario of scenarios) {
    for (const width of args.widths) {
      for (const look of scenario.looks ?? [DARK, LIGHT]) {
        if (args.themes.length && !args.themes.includes(look.theme)) continue;
        runs.push({ scenario, width, look });
      }
    }
  }
  console.log(`ui:audit — ${scenarios.length} screens, ${runs.length} runs against ${baseUrl().origin} (Pro gates ${gates})`);

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
