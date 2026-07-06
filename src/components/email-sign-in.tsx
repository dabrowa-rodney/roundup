"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

/** "Continue with email" — requests a magic sign-in link. */
export function EmailSignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const request = async () => {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("sent");
      } else {
        setState("idle");
        setError(data.error || "Couldn't send the link — try again.");
      }
    } catch {
      setState("idle");
      setError("Couldn't send the link — try again.");
    }
  };

  if (state === "sent") {
    return (
      <div className="rounded-[12px] border border-line bg-good-soft/40 px-4 py-3.5 text-center">
        <div className="text-[14px] font-semibold text-good-ink">
          Check your inbox
        </div>
        <p className="mt-1 text-[13px] leading-[1.5] text-muted">
          We&apos;ve emailed a sign-in link to{" "}
          <span className="font-medium text-ink">{email.trim()}</span>. It
          lasts 15 minutes.
        </p>
        <button
          onClick={() => setState("idle")}
          className="mt-2 text-[12.5px] font-semibold text-accent"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) request();
        }}
        className="flex gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Mail
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-full border border-line bg-bg py-[11px] pl-10 pr-4 text-[14px] text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={state === "sending" || !email.trim()}
          className="whitespace-nowrap rounded-full bg-accent px-4 py-[11px] text-[13.5px] font-bold text-accent-ink disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Email me a link"}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-[12.5px] font-medium text-bad">{error}</p>
      )}
    </div>
  );
}
