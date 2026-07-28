import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { complimentaryCodes } from "@/db/schema";
import { isSuperAdmin } from "@/lib/super-admin";

// Owner-minted complimentary codes (Roundup-internal — unlike discount codes,
// which live in Stripe). Redeemed on Settings → Plan & billing; each grants
// `months` of complimentary access. Super-admin only.

async function guard() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

// GET /api/console/comp-codes — list all complimentary codes.
export async function GET() {
  const err = await guard();
  if (err) return err;
  const codes = await db
    .select()
    .from(complimentaryCodes)
    .orderBy(desc(complimentaryCodes.createdAt));
  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      months: c.months,
      maxRedemptions: c.maxRedemptions,
      timesRedeemed: c.timesRedeemed,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      active: c.active,
    })),
  });
}

// POST /api/console/comp-codes
//   { code, months, maxRedemptions?, expiresAt? (ISO date) }
export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    return NextResponse.json(
      { error: "Code must be 3–30 letters/numbers (e.g. WONDEFREE)" },
      { status: 400 },
    );
  }
  const months = Number(body.months);
  if (!(Number.isInteger(months) && months >= 1 && months <= 60)) {
    return NextResponse.json(
      { error: "Months must be a whole number from 1 to 60" },
      { status: 400 },
    );
  }
  let maxRedemptions: number | null = null;
  if (body.maxRedemptions !== undefined && body.maxRedemptions !== null && body.maxRedemptions !== "") {
    const m = Number(body.maxRedemptions);
    if (!(Number.isInteger(m) && m >= 1)) {
      return NextResponse.json(
        { error: "Max redemptions must be a whole number (or leave blank for unlimited)" },
        { status: 400 },
      );
    }
    maxRedemptions = m;
  }
  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }
    expiresAt = d;
  }

  const existing = (
    await db
      .select({ id: complimentaryCodes.id })
      .from(complimentaryCodes)
      .where(eq(complimentaryCodes.code, code))
      .limit(1)
  )[0];
  if (existing) {
    return NextResponse.json({ error: "That code already exists" }, { status: 400 });
  }

  const [row] = await db
    .insert(complimentaryCodes)
    .values({ code, months, maxRedemptions, expiresAt, active: true })
    .returning();

  return NextResponse.json(
    {
      code: {
        id: row.id,
        code: row.code,
        months: row.months,
        maxRedemptions: row.maxRedemptions,
        timesRedeemed: row.timesRedeemed,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        active: row.active,
      },
    },
    { status: 201 },
  );
}

// PATCH /api/console/comp-codes — { id, active } toggle.
export async function PATCH(req: NextRequest) {
  const err = await guard();
  if (err) return err;
  const body = await req.json().catch(() => ({}));
  if (!Number.isInteger(body.id) || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const [row] = await db
    .update(complimentaryCodes)
    .set({ active: body.active })
    .where(eq(complimentaryCodes.id, body.id))
    .returning({ id: complimentaryCodes.id, active: complimentaryCodes.active });
  if (!row) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  return NextResponse.json({ code: row });
}
