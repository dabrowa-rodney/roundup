import { NextRequest, NextResponse } from "next/server";
import { appUrl, emailConfigured, magicLinkEmail, sendEmail } from "@/lib/email";
import { createLoginToken } from "@/lib/magic-link";

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
