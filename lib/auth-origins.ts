/**
 * The origins allowed to call the auth endpoints with cookies (sign-out, for one): the address auth
 * is configured with, and the address the site is actually served from. They are normally the same.
 * When the site moves to a new domain before BETTER_AUTH_URL is updated they are not, and without
 * the second one every sign-out from the new domain is refused as "Invalid origin".
 */
export function trustedOrigins(authUrl: string, siteUrl: URL): string[] {
  return [...new Set([new URL(authUrl).origin, siteUrl.origin])];
}
