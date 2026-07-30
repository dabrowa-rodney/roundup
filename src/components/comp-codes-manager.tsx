"use client";

import { useEffect, useState } from "react";
import { Gift, Plus } from "lucide-react";

interface CompCode {
  id: number;
  code: string;
  months: number;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
  active: boolean;
  redemptions?: { orgName: string; grantedUntil: string | null; redeemedAt: string }[];
}

const inputClass =
  "rounded-[9px] border border-line bg-bg px-3 py-[9px] text-[14px] text-ink";

export function CompCodesManager() {
  const [codes, setCodes] = useState<CompCode[] | null>(null);

  const [code, setCode] = useState("");
  const [months, setMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/console/comp-codes")
      .then(async (r) => {
        if (r.ok) setCodes((await r.json()).codes);
      })
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/console/comp-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          months: Number(months),
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

  const toggle = async (c: CompCode) => {
    await fetch("/api/console/comp-codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    }).catch(() => {});
    load();
  };

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
              placeholder="WONDEFREE"
              className={`${inputClass} w-[160px] font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Months
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {[1, 2, 3, 6, 12, 24, 36, 60].map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? "" : "s"}
                </option>
              ))}
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
              Teams redeem the code in Settings → Plan &amp; billing for free
              full access.
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {!codes ? (
        <div className="py-8 text-center text-muted">Loading…</div>
      ) : codes.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-muted">
          <Gift size={20} className="mx-auto mb-2" />
          No complimentary codes yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <div className="grid min-w-[720px] grid-cols-[1.2fr_1fr_1fr_0.9fr_100px] gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>CODE</span>
            <span>ACCESS</span>
            <span>REDEMPTIONS</span>
            <span>EXPIRES</span>
            <span />
          </div>
          {codes.map((c) => (
            <div
              key={c.id}
              className={`grid min-w-[720px] grid-cols-[1.2fr_1fr_1fr_0.9fr_100px] items-center gap-3.5 border-t border-line px-[22px] py-3.5 ${
                c.active ? "" : "opacity-50"
              }`}
            >
              <span className="font-mono text-[13.5px] font-bold">{c.code}</span>
              <span className="text-[13.5px] font-semibold">
                {c.months} month{c.months === 1 ? "" : "s"}
              </span>
              <span className="text-[13.5px]">
                {c.timesRedeemed}
                {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                {/* Which orgs actually redeemed it — the counter alone can't say. */}
                {c.redemptions && c.redemptions.length > 0 && (
                  <span
                    className="block text-[11.5px] text-muted"
                    title={c.redemptions
                      .map(
                        (r) =>
                          `${r.orgName} — ${new Date(r.redeemedAt).toLocaleDateString("en-GB")}`,
                      )
                      .join("\n")}
                  >
                    {c.redemptions
                      .slice(0, 2)
                      .map((r) => r.orgName)
                      .join(", ")}
                    {c.redemptions.length > 2
                      ? ` +${c.redemptions.length - 2} more`
                      : ""}
                  </span>
                )}
              </span>
              <span className="text-[13px] text-muted">
                {c.expiresAt
                  ? new Date(c.expiresAt).toLocaleDateString("en-GB")
                  : "—"}
              </span>
              <button
                onClick={() => toggle(c)}
                className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-ink"
              >
                {c.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
