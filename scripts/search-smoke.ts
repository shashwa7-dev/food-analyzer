import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/auth-schema";
import { profile } from "@/lib/db/schema";
import { searchFoods } from "@/lib/foods/service";
import cases from "@/tests/fixtures/search-in.json";

// Runs the search fixture against the real seeded DB (pnpm seed:foods), not CI. Creates a throwaway
// user, runs each query, and passes a row when any of the TOP 3 names contains (case-insensitive) one of
// the row's "|"-separated expected substrings. Deletes the throwaway user (profile cascades) and exits
// non-zero if more than 2 rows fail.
const TOP = 3;
const MAX_FAILURES = 2;

async function main() {
  const id = `smoke_${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(user).values({ id, name: "Smoke", email: `${id}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(profile).values({ userId: id });

  let failures = 0;
  try {
    for (const [query, expected] of cases as [string, string][]) {
      const top = (await searchFoods(id, query, "IN")).slice(0, TOP).map((h) => h.name);
      const wants = expected.toLowerCase().split("|");
      const pass = top.some((name) => wants.some((w) => name.toLowerCase().includes(w)));
      if (!pass) failures++;
      console.log(`${pass ? "PASS" : "FAIL"}  "${query}" → ${top.map((n) => `"${n}"`).join(", ")} (expected one to contain "${expected}")`);
    }
  } finally {
    await db.delete(user).where(eq(user.id, id));
  }

  console.log(`\n${cases.length - failures}/${cases.length} passed, ${failures} failed`);
  if (failures > MAX_FAILURES) {
    console.error(`FAIL: more than ${MAX_FAILURES} of ${cases.length} search fixtures failed`);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
