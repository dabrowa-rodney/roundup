"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

/** Exchanges a magic-link token for a session, then heads into the app. */
export function VerifyClient({ email, token }: { email: string; token: string }) {
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !email || !token) return;
    started.current = true; // tokens are single-use — never fire twice
    signIn("magic", { email, token, redirect: false }).then((res) => {
      if (res?.ok) {
        window.location.href = "/my-reports";
      } else {
        setFailed(true);
      }
    });
  }, [email, token]);

  if (!email || !token || failed) {
    return (
      <div className="w-full max-w-[420px] rounded-card border border-line bg-surface px-7 py-7 text-center">
        <div className="font-head text-[18px] font-bold">
          This sign-in link has expired
        </div>
        <p className="mt-2 text-[14px] leading-[1.6] text-muted">
          Links work once and last 15 minutes. Request a fresh one and try
          again.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-bold text-accent-ink"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="font-head text-[18px] font-bold">Signing you in…</div>
      <p className="mt-1.5 text-[13.5px] text-muted">One moment.</p>
    </div>
  );
}
