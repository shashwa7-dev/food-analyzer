import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://eatri8:eatri8@localhost:5432/eatri8_test";
  const admin = new Client({ connectionString: url.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  const name = new URL(url).pathname.slice(1);
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  const client = new Client({ connectionString: url });
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder: "./lib/db/migrations" });
  await client.end();
}
