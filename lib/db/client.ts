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

const globalForDb = globalThis as unknown as { __db?: Db };
export const db: Db = globalForDb.__db ?? createDb(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
