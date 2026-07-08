"use client";

import { useEffect, useState } from "react";
import { Plus, TicketPercent } from "lucide-react";

interface Discount {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  duration: string;
  durationMonths: number | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: number | null;
}

const inputClass =
  "rounded-[9px] border border-line bg-bg px-3 py-[9px] text-[14px] text-ink";

function durationLabel(d: Discount): string {
  if (d.duration === "once") return "first payment";
  if (d.duration === "forever") return "forever";
  return `${d.durationMonths} month${d.durationMonths === 1 ? "" : "s"}`;
}

export function DiscountsManager() {
  const [discounts, setDiscounts] = useState<Discount[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");
  const [duration, setDuration] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/console/discounts")
      .then(async (r) => {
        if (r.status === 503) setUnavailable(true);
        else if (r.ok) setDiscounts((await r.json()).discounts);
      })
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/console/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          percentOff: Number(percent),
          duration:
            duration === "once" || duration === "forever"
              ? duration
              : Number(duration),
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setCode("");
        load();
      } else {
        setError(d.error || "Couldn't create the code");
      }
    } catch {
      setError("Couldn't create the code");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (d: Discount) => {
    await fetch("/api/console/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, active: !d.active }),
    }).catch(() => {});
    load();
  };

  if (unavailable) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-muted">
        Discount codes need Stripe — add STRIPE_SECRET_KEY first.
      </div>
    );
  }

  return (
    <div>
      {/* Create */}
      <div className="mb-6 rounded-card border border-line bg-surface px-[26px] py-6">
        <div className="mb-4 font-head text-[16px] font-bold">New code</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH20"
              className={`${inputClass} w-[160px] font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              % off
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className={`${inputClass} w-[80px]`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Applies for
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="once">First payment only</option>
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? "" : "s"}
                </option>
              ))}
              <option value="forever">Forever</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Max uses <span className="font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="∞"
              className={`${inputClass} w-[90px]`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Expires <span className="font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            onClick={create}
            disabled={busy || code.trim().length < 3}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink disabled:opacity-40"
          >
            <Plus size={15} /> {busy ? "Creating…" : "Create code"}
          </button>
        </div>
        <div className="mt-2 min-h-[18px] text-[12.5px]">
          {error ? (
            <span className="font-medium text-bad">{error}</span>
          ) : (
            <span className="text-muted">
              Customers type the code on the Stripe payment page.
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {!discounts ? (
        <div className="py-8 text-center text-muted">Loading…</div>
      ) : discounts.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-muted">
          <TicketPercent size={20} className="mx-auto mb-2" />
          No discount codes yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <div className="grid min-w-[720px] grid-cols-[1.2fr_0.7fr_1fr_1fr_0.9fr_100px] gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>CODE</span>
            <span>DISCOUNT</span>
            <span>APPLIES FOR</span>
            <span>REDEMPTIONS</span>
            <span>EXPIRES</span>
            <span />
          </div>
          {discounts.map((d) => (
            <div
              key={d.id}
              className={`grid min-w-[720px] grid-cols-[1.2fr_0.7fr_1fr_1fr_0.9fr_100px] items-center gap-3.5 border-t border-line px-[22px] py-3.5 ${
                d.active ? "" : "opacity-50"
              }`}
            >
              <span className="font-mono text-[13.5px] font-bold">{d.code}</span>
              <span className="text-[13.5px] font-semibold">{d.percentOff}% off</span>
              <span className="text-[13.5px]">{durationLabel(d)}</span>
              <span className="text-[13.5px]">
                {d.timesRedeemed}
                {d.maxRedemptions ? ` / ${d.maxRedemptions}` : ""}
              </span>
              <span className="text-[13px] text-muted">
                {d.expiresAt
                  ? new Date(d.expiresAt * 1000).toLocaleDateString("en-GB")
                  : "—"}
              </span>
              <button
                onClick={() => toggle(d)}
                className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-ink"
              >
                {d.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
