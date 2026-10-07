// pnpm r2:lifecycle — sets the photo bucket's lifecycle rule (spec §A Lifecycle): every object under
// `display/` (the 1080 px display copies) expires 30 days after it was uploaded; `thumb/` is untouched
// (thumbnails stay until the scan is deleted). Idempotent: run it again any time. Other rules already
// on the bucket are kept; only the rule with our ID is replaced.
//   pnpm r2:lifecycle            apply, then read the bucket's rules back
//   pnpm r2:lifecycle --print    print the rule's XML only (no credentials needed)
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET (.env.local), with a token
// allowed to change the bucket's configuration (see README → Scan photos on Cloudflare R2).
import { r2Config } from "../lib/env";
import { DISPLAY_PREFIX, PHOTO_RETENTION_DAYS } from "../lib/storage/keys";
import { r2Client } from "../lib/storage/r2";

const RULE_ID = "eatri8-display-30d";

const RULE_XML =
  `<Rule><ID>${RULE_ID}</ID><Filter><Prefix>${DISPLAY_PREFIX}</Prefix></Filter><Status>Enabled</Status>` +
  `<Expiration><Days>${PHOTO_RETENTION_DAYS}</Days></Expiration></Rule>`;

const DENIED =
  "R2 refused the lifecycle change (401/403): this token can't change the bucket's settings. Object Read & Write " +
  "tokens may not be allowed to. Either run this once with an Admin Read & Write token (then revoke it), or add the " +
  `rule in the dashboard: R2 → the bucket → Settings → Object lifecycle rules → prefix "${DISPLAY_PREFIX}", delete after ${PHOTO_RETENTION_DAYS} days.`;

/** The bucket's current rules, minus ours (so re-running replaces it instead of adding a second one). */
function otherRules(xml: string): string[] {
  return [...xml.matchAll(/<Rule>[\s\S]*?<\/Rule>/g)].map((m) => m[0]).filter((r) => !r.includes(`<ID>${RULE_ID}</ID>`));
}

async function main() {
  if (process.argv.includes("--print")) {
    console.log(RULE_XML);
    return;
  }
  const cfg = r2Config();
  if (!cfg) throw new Error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET (e.g. in .env.local) first.");
  const c = r2Client(cfg);

  const current = await c.aws.fetch(`${c.base}?lifecycle`, { method: "GET" });
  let existing: string[] = [];
  if (current.ok) existing = otherRules(await current.text());
  else if (current.status === 401 || current.status === 403) throw new Error(DENIED);
  else if (current.status !== 404) throw new Error(`Reading the lifecycle rules failed: ${current.status} ${(await current.text()).slice(0, 300)}`);
  if (existing.length > 0) console.log(`Keeping ${existing.length} other rule(s) already on the bucket.`);

  const body = `<?xml version="1.0" encoding="UTF-8"?><LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${[...existing, RULE_XML].join("")}</LifecycleConfiguration>`;
  await c.bucketXml("lifecycle", "PUT", body, "PutBucketLifecycleConfiguration").catch((e: unknown) => {
    throw e instanceof Error && / 40[13] /.test(e.message) ? new Error(DENIED) : e;
  });

  const check = await c.send(`${c.base}?lifecycle`, { method: "GET" }, "GetBucketLifecycleConfiguration");
  const after = await check.text();
  if (!after.includes(RULE_ID)) throw new Error(`The rule didn't stick. The bucket now reports:\n${after}`);
  console.log(`Done: objects under ${DISPLAY_PREFIX} in ${cfg.bucket} expire after ${PHOTO_RETENTION_DAYS} days (rule ${RULE_ID}).`);
}

main().then(() => process.exit(0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
