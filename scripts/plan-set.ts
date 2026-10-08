// Dev-only (pnpm plan:set <email> pro|basic): puts one local account on a plan, so the Pro experience
// can be tried with PRO_GATES_ENFORCED on (spec §B "Dev-only"). There is no admin UI. Same local-only
// guard as seed:demo: refuses production and any database not on localhost. Changes only that
// account's plan column; nothing else is touched.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/auth-schema";
import { profile } from "@/lib/db/schema";
import { PLANS, type PlanKey } from "@/lib/credits/plan-features";
import { assertLocalDb } from "./lib/local-guard";

async function main() {
  assertLocalDb("plan:set");
  const [email, plan] = process.argv.slice(2);
  if (!email || !plan || !Object.hasOwn(PLANS, plan)) throw new Error("Usage: pnpm plan:set <email> pro|basic");
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!u) throw new Error(`No account with the email ${email}.`);
  const updated = await db.update(profile).set({ plan: plan as PlanKey, updatedAt: new Date() }).where(eq(profile.userId, u.id)).returning({ plan: profile.plan });
  if (!updated.length) throw new Error(`${email} has no profile yet: sign in once first.`);
  console.log(`${email} is now on ${plan}.`);
}

main().then(() => process.exit(0), (e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
