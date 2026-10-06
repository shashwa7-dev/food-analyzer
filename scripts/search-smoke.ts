import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/auth-schema";
import { profile } from "@/lib/db/schema";
import { searchFoods } from "@/lib/foods/service";
import cases from "@/tests/fixtures/search-in.json";

// Runs the search fixture against the real seeded DB (pnpm seed:foods), not CI. Creates a throwaway
// user, runs each query, prints PASS/FAIL per row on a case-insensitive substring match against the
// first result's name, then deletes the throwaway user (profile cascades) and exits non-zero if more
// than 3 of the fixture rows fail.

async function main() {
  const id = `smoke_${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(user).values({ id, name: "Smoke", email: `${id}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(profile).values({ userId: id });

  let failures = 0;
  try {
    for (const [query, expected] of cases as [string, string][]) {
      const results = await searchFoods(id, query, "IN");
      const first = results[0]?.name ?? "";
      const pass = first.toLowerCase().includes(expected.toLowerCase());
      if (!pass) failures++;
      console.log(`${pass ? "PASS" : "FAIL"}  "${query}" → "${first}" (expected to contain "${expected}")`);
    }
  } finally {
    await db.delete(user).where(eq(user.id, id));
  }

  console.log(`\n${cases.length - failures}/${cases.length} passed, ${failures} failed`);
  if (failures > 3) {
    console.error(`FAIL: more than 3 of ${cases.length} search fixtures failed`);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
