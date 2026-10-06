import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import { user, session, account, verification } from "@/lib/db/auth-schema";
import { env } from "@/lib/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  secret: env().BETTER_AUTH_SECRET,
  baseURL: env().BETTER_AUTH_URL,
  trustedOrigins: [env().BETTER_AUTH_URL],
  socialProviders: {
    google: { clientId: env().GOOGLE_CLIENT_ID, clientSecret: env().GOOGLE_CLIENT_SECRET, prompt: "select_account" },
  },
  plugins: [nextCookies()],
});
