import { NextResponse } from "next/server";

// NextAuth's signout only clears the session-cookie variant it is currently
// configured with (domain-scoped to .roundup.work in production). Sessions
// issued before that scoping live in a host-only cookie with the same name,
// which the browser keeps sending — making "sign out" appear to do nothing.
// This route runs as the post-signout redirect and expires every variant.
const SESSION_COOKIES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

export function GET(request: Request) {
  const url = new URL(request.url);
  const res = NextResponse.redirect(new URL("/login", url.origin));

  const parts = url.hostname.split(".");
  const rootDomain =
    parts.length >= 2 ? "." + parts.slice(-2).join(".") : null;

  for (const name of SESSION_COOKIES) {
    // __Secure- prefixed cookies are only accepted with the Secure attribute,
    // deletions included.
    const secure = name.startsWith("__Secure-") ? "; Secure" : "";
    res.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
    );
    if (rootDomain) {
      res.headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Domain=${rootDomain}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      );
    }
  }
  return res;
}
