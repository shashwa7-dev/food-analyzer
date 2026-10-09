import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import { user, session, account, verification } from "@/lib/db/auth-schema";
import { env } from "@/lib/env";

/** How long a session is trusted from its cookie before the database is asked again. */
export const SESSION_CACHE_SECONDS = 5 * 60;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  secret: env().BETTER_AUTH_SECRET,
  baseURL: env().BETTER_AUTH_URL,
  trustedOrigins: [env().BETTER_AUTH_URL],
  socialProviders: {
    google: { clientId: env().GOOGLE_CLIENT_ID, clientSecret: env().GOOGLE_CLIENT_SECRET, prompt: "select_account" },
  },
  // The session rides in a signed cookie for five minutes, so a request reads it without touching
  // the database. The cost: signing out (or deleting the account) on one device can take up to five
  // minutes to reach another. Route handlers refresh the cookie; components/session-keep-alive.tsx
  // makes sure one runs often enough, since pages themselves cannot set cookies.
  session: { cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS } },
  plugins: [nextCookies()],
});
