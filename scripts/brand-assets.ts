// Dev-only: writes the static brand files that are committed with the app — the icons, the share
// card (Open Graph and Twitter) and the home page's phone screenshots.
//   pnpm brand:assets
// The screenshots come from pnpm ui:audit's 390 px shots in docs/design/qa/ (git-ignored), so run
// that first (it needs pnpm dev and pnpm seed:demo). Uses the installed Chrome through
// puppeteer-core for the share card, and needs the network once for the Geist font.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { SHARE_IMAGE_ALT } from "../lib/site";
import { markSvg } from "./brand/mark";
import { shareCardHtml } from "./brand/share-card";
import { launch } from "./lib/browser";

const QA = "docs/design/qa";
/** Home page name → the UI audit scenario it is cut from. */
const SHOTS = { today: "today", scan: "scan-label", workouts: "workouts" } as const;
type ShotName = keyof typeof SHOTS;
const THEMES = ["dark", "light"] as const;
/** The top of each 390 px (2×) screenshot, at twice the widest phone frame on the home page. */
const CROP = { width: 780, height: 1620 };
const SHOT_WIDTH = 584;
const LIMITS = { shareCard: 400_000, shot: 60_000 };

const written: string[] = [];
function write(file: string, data: Buffer | string) {
  const path = resolve(file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  written.push(file);
}

const source = (name: ShotName, theme: (typeof THEMES)[number]) => resolve(QA, `${SHOTS[name]}-390-${theme}.png`);

const png = (svg: string, size: number) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toBuffer();

/** A one-image .ico: the 6-byte header, one 16-byte directory entry, then the PNG itself. */
function ico(image: Buffer, size: number): Buffer {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // image count
  head.writeUInt8(size, 6); // width
  head.writeUInt8(size, 7); // height
  head.writeUInt8(0, 8); // palette size
  head.writeUInt8(0, 9); // reserved
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(image.length, 14);
  head.writeUInt32LE(22, 18); // offset of the image
  return Buffer.concat([head, image]);
}

async function landingShots() {
  for (const name of Object.keys(SHOTS) as ShotName[]) {
    for (const theme of THEMES) {
      const out = await sharp(source(name, theme))
        .extract({ left: 0, top: 0, ...CROP })
        .resize(SHOT_WIDTH)
        .webp({ quality: 80 })
        .toBuffer();
      write(`public/landing/${name}-${theme}.webp`, out);
    }
  }
}

async function icons() {
  const rounded = markSvg({ rounded: true });
  const square = markSvg({ rounded: false });
  write("app/icon.svg", `${rounded}\n`);
  write("app/favicon.ico", ico(await png(rounded, 32), 32));
  write("app/apple-icon.png", await png(square, 180));
  write("public/icons/icon-192.png", await png(rounded, 192));
  write("public/icons/icon-512.png", await png(rounded, 512));
  write("public/icons/icon-maskable-512.png", await png(markSvg({ rounded: false, scale: 0.7 }), 512));
}

async function shareCard() {
  const dataUri = async (name: ShotName) => {
    const buf = await sharp(source(name, "dark")).extract({ left: 0, top: 0, ...CROP }).resize(SHOT_WIDTH).png().toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  };
  const html = shareCardHtml({ today: await dataUri("today"), scan: await dataUri("scan"), workouts: await dataUri("workouts") });
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const geist = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 40px "Geist"'); });
    if (!geist) throw new Error("The Geist font didn't load (the share card needs the network once).");
    const shot = await page.screenshot({ type: "png" });
    const card = await sharp(shot).png({ compressionLevel: 9 }).toBuffer();
    write("app/opengraph-image.png", card);
    write("app/twitter-image.png", card);
    write("app/opengraph-image.alt.txt", `${SHARE_IMAGE_ALT}\n`);
    write("app/twitter-image.alt.txt", `${SHARE_IMAGE_ALT}\n`);
  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("brand:assets is dev only.");
  const missing = (Object.keys(SHOTS) as ShotName[]).flatMap((n) => THEMES.map((t) => source(n, t))).filter((f) => !existsSync(f));
  if (missing.length) throw new Error(`Missing screenshots:\n  ${missing.join("\n  ")}\nRun pnpm ui:audit first (needs pnpm dev and pnpm seed:demo).`);

  await landingShots();
  await icons();
  await shareCard();

  const tooBig: string[] = [];
  for (const file of written) {
    const bytes = statSync(resolve(file)).size;
    console.log(`${String(Math.round(bytes / 1024)).padStart(5)} KB  ${file}`);
    const limit = file.endsWith("-image.png") ? LIMITS.shareCard : file.startsWith("public/landing/") ? LIMITS.shot : Infinity;
    if (bytes > limit) tooBig.push(`${file} is ${Math.round(bytes / 1024)} KB (limit ${Math.round(limit / 1024)} KB)`);
  }
  if (tooBig.length) throw new Error(tooBig.join("\n"));
}

main().then(() => process.exit(0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
