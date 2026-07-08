import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { stripe, stripeConfigured } from "@/lib/stripe";

// Owner-managed discount codes, stored entirely in Stripe:
// a Coupon (the discount itself) wrapped in a Promotion Code (the string
// customers type at checkout). Checkout has allow_promotion_codes on, so
// redemption/expiry/proration are Stripe's job.

async function guard() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe isn't configured yet" },
      { status: 503 },
    );
  }
  return null;
}

function shape(pc: Stripe.PromotionCode) {
  // v22 API: the coupon hangs off `promotion`; only an object when expanded.
  const c =
    pc.promotion?.type === "coupon" && typeof pc.promotion.coupon === "object"
      ? pc.promotion.coupon
      : null;
  return {
    id: pc.id,
    code: pc.code,
    active: pc.active,
    percentOff: c?.percent_off ?? null,
    duration: c?.duration ?? "unknown", // 'once' | 'repeating' | 'forever'
    durationMonths: c?.duration_in_months ?? null,
    timesRedeemed: pc.times_redeemed,
    maxRedemptions: pc.max_redemptions,
    expiresAt: pc.expires_at,
  };
}

// GET /api/console/discounts — list all promotion codes.
export async function GET() {
  const err = await guard();
  if (err) return err;
  const codes = await stripe().promotionCodes.list({
    limit: 100,
    expand: ["data.promotion.coupon"],
  });
  return NextResponse.json({ discounts: codes.data.map(shape) });
}

// POST /api/console/discounts — create one.
//   { code, percentOff, duration: 'once'|'forever'|number-of-months,
//     maxRedemptions?, expiresAt? (ISO date) }
export async function POST(req: NextRequest) {
  const err = await guard();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const percentOff = Number(body.percentOff);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    return NextResponse.json(
      { error: "Code must be 3–30 letters/numbers (e.g. LAUNCH20)" },
      { status: 400 },
    );
  }
  if (!(percentOff > 0 && percentOff <= 100)) {
    return NextResponse.json(
      { error: "Percent off must be between 1 and 100" },
      { status: 400 },
    );
  }

  let couponParams: Stripe.CouponCreateParams;
  if (body.duration === "once" || body.duration === "forever") {
    couponParams = { percent_off: percentOff, duration: body.duration };
  } else {
    const months = Number(body.duration);
    if (!(Number.isInteger(months) && months >= 1 && months <= 36)) {
      return NextResponse.json(
        { error: "Duration must be 'once', 'forever' or 1–36 months" },
        { status: 400 },
      );
    }
    couponParams = {
      percent_off: percentOff,
      duration: "repeating",
      duration_in_months: months,
    };
  }

  try {
    const coupon = await stripe().coupons.create({
      ...couponParams,
      name: code,
    });
    const promo = await stripe().promotionCodes.create(
      {
        promotion: { type: "coupon", coupon: coupon.id },
        code,
        ...(body.maxRedemptions
          ? { max_redemptions: Number(body.maxRedemptions) }
          : {}),
        ...(body.expiresAt
          ? { expires_at: Math.floor(new Date(body.expiresAt).getTime() / 1000) }
          : {}),
      },
      undefined,
    );
    const expanded = await stripe().promotionCodes.retrieve(promo.id, {
      expand: ["promotion.coupon"],
    });
    return NextResponse.json({ discount: shape(expanded) }, { status: 201 });
  } catch (e) {
    const msg =
      e instanceof Error && /already exists/i.test(e.message)
        ? "That code already exists"
        : "Stripe rejected that code — check the values";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// PATCH /api/console/discounts — { id, active } toggle.
export async function PATCH(req: NextRequest) {
  const err = await guard();
  if (err) return err;
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const promo = await stripe().promotionCodes.update(body.id, {
    active: body.active,
  });
  return NextResponse.json({ discount: { id: promo.id, active: promo.active } });
}
