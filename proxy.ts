import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { APP_PREFIXES } from "@/lib/nav/app-prefixes";

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAppRoute = APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (isAppRoute && !getSessionCookie(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  if (isAppRoute) {
    return NextResponse.next({ request: { headers: new Headers({ ...Object.fromEntries(req.headers), "x-pathname": path }) } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
