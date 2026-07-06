"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify, slugProblem } from "@/lib/org";

export function OnboardingForm({ needsName = false }: { needsName?: boolean }) {
  const router = useRouter();
  const [ownName, setOwnName] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const problem =
    name.trim().length >= 2 && effectiveSlug
      ? slugProblem(effectiveSlug)
      : null;

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: effectiveSlug,
          userName: ownName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Session picks the new user row up on the next server render.
        router.push("/reports");
        router.refresh();
      } else {
        setError(data.error || "Couldn't create the organisation — try again.");
        setBusy(false);
      }
    } catch {
      setError("Couldn't create the organisation — try again.");
      setBusy(false);
    }
  };

  const disabled =
    busy ||
    name.trim().length < 2 ||
    !!problem ||
    (needsName && ownName.trim().length < 2);

  return (
    <div className="rounded-card border border-line bg-surface px-7 py-7">
      <div className="font-head text-[16px] font-bold">
        Create your organisation
      </div>
      <p className="mb-5 mt-1 text-[13px] text-muted">
        Your team files weekly updates; Roundup turns them into a leadership
        summary.
      </p>

      {needsName && (
        <>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
            Your name
          </label>
          <input
            value={ownName}
            onChange={(e) => setOwnName(e.target.value)}
            placeholder="e.g. Alex Taylor"
            autoFocus
            className="mb-4 w-full rounded-[10px] border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink"
          />
        </>
      )}

      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
        Organisation name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Acme Ltd"
        autoFocus={!needsName}
        className="mb-4 w-full rounded-[10px] border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink"
      />

      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted">
        Workspace URL
      </label>
      <div className="mb-1 flex items-center overflow-hidden rounded-[10px] border border-line bg-bg">
        <input
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="acme"
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-mono text-[13.5px] text-ink outline-none"
        />
        <span className="whitespace-nowrap px-3.5 font-mono text-[13px] text-muted">
          .roundup.work
        </span>
      </div>
      <div className="mb-5 min-h-[18px] text-[12.5px]">
        {problem ? (
          <span className="text-bad">{problem}</span>
        ) : (
          <span className="text-muted">You can share this later.</span>
        )}
      </div>

      {error && (
        <div className="mb-3 text-[13px] font-medium text-bad">{error}</div>
      )}
      <button
        onClick={create}
        disabled={disabled}
        className="w-full rounded-full bg-accent py-3 text-[14.5px] font-bold text-accent-ink disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create organisation"}
      </button>
    </div>
  );
}
