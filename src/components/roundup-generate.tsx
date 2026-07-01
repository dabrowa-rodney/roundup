"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";

export function GenerateRoundupButton({
  week,
  label = "Generate Roundup",
}: {
  week: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/roundups/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to generate");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to generate");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink disabled:opacity-60"
      >
        <Sparkles size={15} /> {loading ? "Generating…" : label}
      </button>
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
