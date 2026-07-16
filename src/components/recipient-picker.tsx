"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

// Per-roundup recipient selection (design D6). Admin-only — rendered by the
// Roundup viewer next to Send. The trigger shows the current explicit
// selection (or the tree-derived default audience when none is set); the
// panel lists every org member with checkboxes and saves via
// PUT /api/roundups/[id]/recipients. Once the roundup is sent the list is a
// historical record: the panel goes read-only (the API 409s writes too).

type Member = {
  id: number;
  name: string | null;
  email: string;
};

export function RecipientPicker({
  roundupId,
  sent = false,
}: {
  roundupId: number;
  sent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [defaults, setDefaults] = useState<number[]>([]);
  const [locked, setLocked] = useState(sent);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Current selection + defaults — powers the trigger label.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/roundups/${roundupId}/recipients`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setSelected(Array.isArray(data.selected) ? data.selected : []);
          setDefaults(Array.isArray(data.defaults) ? data.defaults : []);
          setLocked(Boolean(data.sent));
        } else {
          setError(data.error || "Couldn't load recipients");
        }
      } catch {
        if (!cancelled) setError("Couldn't load recipients");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundupId]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openPanel = async () => {
    setError("");
    // Preload the checkboxes from the explicit selection, or the defaults
    // the send flow would otherwise use.
    setChecked(new Set(selected.length > 0 ? selected : defaults));
    setOpen(true);
    if (members === null) {
      try {
        const res = await fetch("/api/users");
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.users)) {
          setMembers(
            data.users.map((u: Member) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            })),
          );
        } else {
          setError(data.error || "Couldn't load members");
        }
      } catch {
        setError("Couldn't load members");
      }
    }
  };

  const toggle = (id: number) => {
    if (locked) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/roundups/${roundupId}/recipients`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [...checked] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSelected([...checked]);
        setOpen(false);
      } else {
        setError(data.error || "Couldn't save — try again.");
        if (res.status === 409) setLocked(true);
      }
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const label = !loaded
    ? "Recipients"
    : selected.length > 0
      ? `${selected.length} recipient${selected.length === 1 ? "" : "s"}`
      : `Default: ${defaults.length} ${defaults.length === 1 ? "person" : "people"}`;

  return (
    <div className="relative flex items-center gap-2.5">
      {!open && error && (
        <span className="max-w-[260px] text-right text-[12.5px] font-medium text-bad">
          {error}
        </span>
      )}
      <button
        onClick={openPanel}
        title={
          locked
            ? "Who this Roundup was sent to"
            : "Choose who receives this Roundup"
        }
        className="flex items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink"
      >
        <Users size={15} /> {label}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] rounded-card border border-line bg-surface shadow-lg">
            <div className="border-b border-line px-[18px] py-3.5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                Recipients
              </div>
              <div className="mt-1 text-[12px] leading-[1.5] text-muted">
                {locked
                  ? "This Roundup has been sent — its recipient list is final."
                  : "Who receives this Roundup when it's sent."}
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto p-2">
              {members === null ? (
                <div className="px-3 py-4 text-[12.5px] text-muted">
                  Loading members…
                </div>
              ) : members.length === 0 ? (
                <div className="px-3 py-4 text-[12.5px] text-muted">
                  No members in this organisation yet.
                </div>
              ) : (
                members.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                      locked ? "opacity-70" : "cursor-pointer hover:bg-bg"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={checked.has(m.id)}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 flex-shrink-0"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {m.name || m.email}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {m.email}
                      </span>
                    </span>
                    {defaults.includes(m.id) && (
                      <span className="flex-shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                        Default
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-[18px] py-3">
              {error ? (
                <span className="text-[12px] font-medium text-bad">{error}</span>
              ) : (
                <span className="text-[12px] text-muted">
                  {locked
                    ? `Sent to ${selected.length} ${selected.length === 1 ? "person" : "people"}`
                    : `${checked.size} selected`}
                </span>
              )}
              {locked ? (
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-muted"
                >
                  Close
                </button>
              ) : (
                <button
                  onClick={save}
                  disabled={saving || members === null}
                  className="rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
