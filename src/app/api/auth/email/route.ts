import { NextRequest, NextResponse } from "next/server";
import { appUrl, emailConfigured, magicLinkEmail, sendEmail } from "@/lib/email";
import { createLoginToken } from "@/lib/magic-link";
import { clientIp, rateLimit, retryAfterSeconds } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/email  { email: string, name?: string }
// Request a magic sign-in link. Responds identically whether or not the
// address is known — no account enumeration.
export async function POST(req: NextRequest) {
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email sign-in isn't available right now — use Google." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  // Unauthenticated and it sends mail, so it's abusable two ways: bombing one
  // address, and burning send quota in bulk. Limit per address (each request
  // also invalidates that address's previous link, so this protects a
  // legitimate user's in-flight link too) and per IP across addresses.
  // The response shape stays identical either way — still no enumeration.
  const perEmail = await rateLimit(`magic:email:${email}`, 5, 60 * 60 * 1000);
  const perIp = await rateLimit(
    `magic:ip:${clientIp(req.headers)}`,
    20,
    60 * 60 * 1000,
  );
  if (!perEmail.ok || !perIp.ok) {
    const blocked = !perEmail.ok ? perEmail : perIp;
    return NextResponse.json(
      { error: "Too many requests — try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds(blocked)) },
      },
    );
  }

  const token = await createLoginToken(email, name || null);
  const url = appUrl(
    `/auth/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
  );
  const sent = await sendEmail({ to: email, ...magicLinkEmail({ url }) });
  if (!sent) {
    return NextResponse.json(
      { error: "Couldn't send the email — try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
