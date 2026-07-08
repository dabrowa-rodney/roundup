"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Sparkles } from "lucide-react";
import { slugProblem } from "@/lib/org";

interface OrgInfo {
  name: string;
  slug: string;
  hasAnthropicKey: boolean;
}

const inputClass =
  "w-full rounded-[9px] border border-line bg-bg px-3 py-[9px] text-[14px] text-ink";

/** Organisation identity + BYO Anthropic key cards for the Settings page. */
export function OrgSettingsCards() {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [slug, setSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);
  const [slugError, setSlugError] = useState("");

  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    fetch("/api/org")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.org) {
          setOrg(d.org);
          setName(d.org.name);
          setSlug(d.org.slug);
        }
      })
      .catch(() => {});
  }, []);

  if (!org) return null;

  const saveName = async () => {
    setSavingName(true);
    setNameSaved(false);
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.org) {
        setOrg(d.org);
        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 2000);
      }
    } finally {
      setSavingName(false);
    }
  };

  const saveSlug = async () => {
    setSavingSlug(true);
    setSlugSaved(false);
    setSlugError("");
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.org) {
        setOrg(d.org);
        setSlug(d.org.slug);
        setSlugSaved(true);
        setTimeout(() => setSlugSaved(false), 2000);
      } else {
        setSlugError(d.error || "Couldn't save the workspace URL — try again.");
      }
    } catch {
      setSlugError("Couldn't save the workspace URL — try again.");
    } finally {
      setSavingSlug(false);
    }
  };

  const saveKey = async (value: string | null) => {
    setKeyBusy(true);
    setKeyError("");
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.org) {
        setOrg(d.org);
        setKeyInput("");
      } else {
        setKeyError(d.error || "Couldn't save the key — try again.");
      }
    } catch {
      setKeyError("Couldn't save the key — try again.");
    } finally {
      setKeyBusy(false);
    }
  };

  return (
    <>
      {/* Organisation */}
      <div className="mb-4 rounded-card border border-line bg-surface px-[26px] py-6">
        <div className="font-head text-[16px] font-bold">
          Organisation
          <span className="ml-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            Admin
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            onClick={saveName}
            disabled={savingName || name.trim().length < 2 || name === org.name}
            className="rounded-full bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink disabled:opacity-40"
          >
            {savingName ? "Saving…" : nameSaved ? "Saved ✓" : "Save"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Workspace URL
            </label>
            <div className="flex items-center overflow-hidden rounded-[9px] border border-line bg-bg">
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase());
                  setSlugError("");
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-[9px] font-mono text-[13.5px] text-ink outline-none"
              />
              <span className="whitespace-nowrap px-3 font-mono text-[13px] text-muted">
                .roundup.work
              </span>
            </div>
          </div>
          <button
            onClick={saveSlug}
            disabled={
              savingSlug ||
              slug === org.slug ||
              !!slugProblem(slug.trim())
            }
            className="rounded-full bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink disabled:opacity-40"
          >
            {savingSlug ? "Saving…" : slugSaved ? "Saved ✓" : "Save"}
          </button>
        </div>
        <div className="mt-2 min-h-[18px] text-[12.5px]">
          {slugError || (slug !== org.slug && slugProblem(slug.trim())) ? (
            <span className="font-medium text-bad">
              {slugError || slugProblem(slug.trim())}
            </span>
          ) : (
            <span className="text-muted">
              Changing this changes your workspace address — links to the old
              one will stop working.
            </span>
          )}
        </div>
      </div>

      {/* AI generation */}
      <div className="mb-4 rounded-card border border-line bg-surface px-[26px] py-6">
        <div className="font-head text-[16px] font-bold">
          AI generation
          <span className="ml-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            Admin
          </span>
        </div>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-muted">
          On the Team and Business plans, Roundups are written by Claude — a
          natural headline and summary, week-over-week changes, and charts
          picked from your connected sheets. It&apos;s included in the plan;
          there&apos;s nothing to set up. Optionally, connect your own
          Anthropic API key below to have AI usage billed to your account
          instead.
        </p>

        {org.hasAnthropicKey ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-good-soft px-3.5 py-2 text-[13px] font-semibold text-good-ink">
              <Sparkles size={14} /> Your own Anthropic key connected — usage
              billed to your account
            </span>
            <button
              onClick={() => saveKey(null)}
              disabled={keyBusy}
              className="rounded-full border border-line px-3.5 py-2 text-[13px] font-semibold text-muted disabled:opacity-40"
            >
              {keyBusy ? "Removing…" : "Remove key"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <KeyRound
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-ant-…"
                  type="password"
                  autoComplete="off"
                  className={`${inputClass} pl-9 font-mono text-[13px]`}
                />
              </div>
              <button
                onClick={() => saveKey(keyInput)}
                disabled={keyBusy || !keyInput.trim().startsWith("sk-ant-")}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink disabled:opacity-40"
              >
                {keyBusy ? (
                  "Checking…"
                ) : (
                  <>
                    <Check size={14} /> Connect
                  </>
                )}
              </button>
            </div>
            <div className="mt-2 min-h-[18px] text-[12.5px]">
              {keyError ? (
                <span className="font-medium text-bad">{keyError}</span>
              ) : (
                <span className="text-muted">
                  Optional — create one at console.anthropic.com. It&apos;s
                  stored encrypted and never shown again.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
