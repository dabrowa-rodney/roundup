import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Host-based routing. console.roundup.work serves the business-owner console
// (the same deployment — we rewrite its root to /console). This is also where
// per-org subdomain routing will land.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("console.") && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/console", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Root only — auth routes, assets and app pages pass through untouched.
  matcher: "/",
};
