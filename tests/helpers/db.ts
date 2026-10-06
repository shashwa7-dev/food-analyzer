import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/auth-schema";
import { profile } from "@/lib/db/schema";

export const testDb = () => db;

export async function resetDb() {
  await db.execute(sql`TRUNCATE food_log, user_food_stats, food, profile, "session", "account", "verification", "user" RESTART IDENTITY CASCADE`);
}

export async function createUser(id = `u_${Math.random().toString(36).slice(2, 10)}`) {
  await db.insert(user).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(profile).values({ userId: id });
  return id;
}
