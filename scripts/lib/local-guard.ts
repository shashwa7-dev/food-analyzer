// The local-only guard for dev scripts that write to the database (seed:demo, plan:set): refuses to
// run in production or against a database that isn't on localhost.

export function assertLocalDb(script: string, raw: string | undefined = process.env.DATABASE_URL, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === "production") throw new Error(`${script} refuses to run with NODE_ENV=production.`);
  let host = "";
  let overridesHost = true;
  try {
    const u = new URL(raw ?? "");
    host = u.hostname;
    // pg copies query params onto the connection config, so ?host=… or ?hostaddr=… would redirect a "localhost" URL.
    overridesHost = [...u.searchParams.keys()].some((k) => /^(host|hostaddr|service)$/i.test(k));
  } catch { /* reported below */ }
  if (overridesHost || (host !== "localhost" && host !== "127.0.0.1")) {
    throw new Error(`${script} only runs against a local database (DATABASE_URL host must be localhost or 127.0.0.1, with no host/hostaddr/service params).`);
  }
}
