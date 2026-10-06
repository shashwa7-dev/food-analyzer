import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const APP_PREFIXES = ["/today", "/foods", "/me", "/onboarding", "/history", "/scan"];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) && !getSessionCookie(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
