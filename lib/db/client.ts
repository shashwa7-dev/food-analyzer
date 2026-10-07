import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const fullSchema = { ...schema, ...authSchema };

function isLocal(url: string) {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "db";
}

// Both drivers expose the same query builder and interactive transactions. Everything is typed as the
// node-postgres flavour (the union of the two generic types doesn't type-check for .transaction()).
export function createDb(url: string): Db {
  if (isLocal(url)) return drizzlePg(new PgPool({ connectionString: url, max: 5 }), { schema: fullSchema });
  neonConfig.webSocketConstructor = ws;
  return drizzleNeon(new NeonPool({ connectionString: url }), { schema: fullSchema }) as unknown as Db;
}

export type Db = NodePgDatabase<typeof fullSchema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const MISSING_URL = "DATABASE_URL is missing or invalid. Set it to a postgres:// connection string (see .env.example).";

export function databaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error(MISSING_URL);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(MISSING_URL);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error(MISSING_URL);
  return raw;
}

const globalForDb = globalThis as unknown as { __db?: Db };
function getDb(): Db {
  globalForDb.__db ??= createDb(databaseUrl(process.env.DATABASE_URL));
  return globalForDb.__db;
}

// Created on first use, so importing this module (e.g. during `next build` without env) never connects or throws.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value: unknown = Reflect.get(real, prop, real);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
});
