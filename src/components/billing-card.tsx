"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";

interface BillingInfo {
  tier: "free" | "team" | "business";
  label: string;
  paidPlan: string;
  planStatus: string | null;
  isComplimentary: boolean;
  complimentaryUntil: string | null;
  isTrial: boolean;
  trialDaysLeft: number;
  hasStripeCustomer: boolean;
  available: boolean;
}

const TIERS = [
  {
    key: "team" as const,
    name: "Team",
    monthly: "£29",
    annual: "£290/yr",
    monthlyKey: "team_monthly",
    annualKey: "team_annual",
    features: ["Up to 25 members", "Unlimited report templates", "AI-written Roundups included"],
  },
  {
    key: "business" as const,
    name: "Business",
    monthly: "£79",
    annual: "£790/yr",
    monthlyKey: "business_monthly",
    annualKey: "business_annual",
    features: ["Unlimited members", "Everything in Team", "Own-domain support (coming soon)"],
  },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "14 Jan 2027" from an ISO string (UTC calendar day). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Billing card for the Settings page: current plan + upgrade / manage. */
export function BillingCard() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Redeem-a-code box state.
  const [code, setCode] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeemNote, setRedeemNote] = useState("");

  const loadInfo = useCallback(() => {
    return fetch("/api/org")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.org?.billing && setInfo(d.org.billing))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  if (!info) return null;

  const go = async (path: string, body?: unknown, busyKey = path) => {
    setBusy(busyKey);
    setError("");
    // Pre-apply a redeemed discount code at checkout (not on the portal call).
    const finalBody =
      path === "/api/billing/checkout" && promoCode
        ? { ...(body as Record<string, unknown>), promoCode }
        : body;
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: finalBody ? JSON.stringify(finalBody) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) {
        window.location.assign(d.url);
        return;
      }
      setError(d.error || "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setBusy(null);
  };

  const apply = async () => {
    const value = code.trim();
    if (!value) return;
    setBusy("redeem");
    setRedeemError("");
    setRedeemNote("");
    try {
      const res = await fetch("/api/billing/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRedeemError(d.error || "That code isn't valid.");
      } else if (d.kind === "complimentary") {
        setRedeemNote(d.message || "Complimentary access unlocked.");
        setCode("");
        await loadInfo();
      } else if (d.kind === "discount") {
        setPromoCode(d.code);
        setCode("");
        setRedeemNote("Discount applied — pick a plan below.");
      }
    } catch {
      setRedeemError("Something went wrong — try again.");
    }
    setBusy(null);
  };

  const paidActive = info.paidPlan === "team" || info.paidPlan === "business";
  const permanentComplimentary = info.isComplimentary && !info.complimentaryUntil;
  const showRedeem = !permanentComplimentary;

  return (
    <div className="mb-4 rounded-card border border-line bg-surface px-[26px] py-6">
      <div className="font-head text-[16px] font-bold">
        Plan &amp; billing
        <span className="ml-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          Admin
        </span>
      </div>

      {/* Current plan line */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold text-accent">
          {info.isComplimentary ? "Complimentary" : info.label}
          {info.isTrial ? " (trial)" : ""}
        </span>
        {info.isTrial && (
          <span className="text-[13px] text-muted">
            {info.trialDaysLeft} day{info.trialDaysLeft === 1 ? "" : "s"} of
            your free Team trial left — after that you&apos;re on Free unless
            you subscribe.
          </span>
        )}
        {info.isComplimentary && (
          <span className="text-[13px] text-muted">
            {info.complimentaryUntil
              ? `Complimentary until ${formatDate(info.complimentaryUntil)}`
              : "Full access, on the house."}
          </span>
        )}
        {info.paidPlan === "team" || info.paidPlan === "business" ? (
          <span className="text-[13px] text-muted">
            Status: {info.planStatus}
          </span>
        ) : null}
      </div>

      {info.isComplimentary ? null : !info.available ? (
        <p className="mt-3 text-[13px] text-muted">
          Paid plans are coming soon.
        </p>
      ) : paidActive ? (
        <button
          onClick={() => go("/api/billing/portal")}
          disabled={busy !== null}
          className="mt-4 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-accent disabled:opacity-50"
        >
          <CreditCard size={15} />
          {busy ? "Opening…" : "Manage billing & invoices"}
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {TIERS.map((t) => (
            <div key={t.key} className="rounded-xl border border-line p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-head text-[16px] font-bold">{t.name}</span>
                <span className="font-head text-[15px] font-bold text-accent">
                  {t.monthly}
                  <span className="text-[12px] font-semibold text-muted">/mo</span>
                </span>
              </div>
              <ul className="mb-3.5 mt-2.5 flex flex-col gap-1.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[12.5px] text-muted">
                    <Check size={13} className="mt-0.5 flex-shrink-0 text-good" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => go("/api/billing/checkout", { price: t.monthlyKey }, t.monthlyKey)}
                  disabled={busy !== null}
                  className="rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-bold text-accent-ink disabled:opacity-50"
                >
                  {busy === t.monthlyKey ? "Opening…" : "Choose monthly"}
                </button>
                <button
                  onClick={() => go("/api/billing/checkout", { price: t.annualKey }, t.annualKey)}
                  disabled={busy !== null}
                  className="rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-accent disabled:opacity-50"
                >
                  {busy === t.annualKey ? "Opening…" : `${t.annual} — 2 months free`}
                </button>
              </div>
            </div>
          ))}
          <p className="text-[12px] text-muted sm:col-span-2">
            <Sparkles size={12} className="mr-1 inline" />
            Prices shown in GBP; USD is applied automatically at checkout for
            non-UK cards. Have a discount or complimentary code? Enter it above.
          </p>
        </div>
      )}

      {/* Redeem a code */}
      {showRedeem && (
        <div className="mt-5 border-t border-line pt-4">
          <label
            htmlFor="redeem-code"
            className="text-[12.5px] font-semibold text-muted"
          >
            Have a code?
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="redeem-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder="Redeem a code"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[13.5px] text-ink placeholder:text-muted"
            />
            <button
              onClick={apply}
              disabled={busy !== null || !code.trim()}
              className="rounded-full bg-accent px-4 py-2 text-[12.5px] font-bold text-accent-ink disabled:opacity-50"
            >
              {busy === "redeem" ? "Applying…" : "Apply"}
            </button>
          </div>
          {redeemError && (
            <p className="mt-2 text-[13px] font-medium text-bad">{redeemError}</p>
          )}
          {redeemNote && (
            <p className="mt-2 text-[13px] font-medium text-good">{redeemNote}</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2.5 text-[13px] font-medium text-bad">{error}</p>
      )}
    </div>
  );
}
