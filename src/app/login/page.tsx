"use client";

import { signIn } from "next-auth/react";

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 5.1 29.4 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 5.1 29.4 3 24 3 16 3 9.1 7.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 35.9 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-6.9l-6.5 5C9.1 41.5 16 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C39.9 36.3 45 30 45 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[1.05fr_0.95fr]">
      {/* Left panel — brand */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-accent px-[60px] py-14 text-accent-ink md:flex">
        <div className="relative z-[2] flex items-center gap-[11px]">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-accent-ink font-head text-[18px] font-extrabold text-accent">
            R
          </div>
          <span className="text-[18px] font-bold tracking-[-0.01em]">
            Roundup
          </span>
        </div>
        <div className="relative z-[2] max-w-[430px]">
          <div className="font-head text-[46px] font-bold leading-[1.05] tracking-[-0.025em]">
            Your team&apos;s week, in one place.
          </div>
          <p className="mt-[18px] text-[16px] leading-[1.6] opacity-85">
            Each lead files a short weekly update. Roundup gathers them, folds in
            your data, and writes the summary your senior team actually reads.
          </p>
        </div>
        <div className="relative z-[2] text-[13px] opacity-75">
          Updates close Sundays at 20:00 · London
        </div>
        <div className="absolute -bottom-[120px] -right-[120px] h-[420px] w-[420px] rounded-full bg-white/[0.07]" />
        <div className="absolute -top-[90px] right-10 h-[240px] w-[240px] rounded-full bg-white/[0.06]" />
      </div>

      {/* Right panel — sign in */}
      <div className="flex items-center justify-center p-10">
        <div className="fade-up w-full max-w-[380px]">
          <div className="font-head text-[28px] font-bold tracking-[-0.02em]">
            Welcome back
          </div>
          <p className="mb-[30px] mt-2 text-[15px] text-muted">
            Sign in to file your weekly update.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/my-reports" })}
            className="flex w-full items-center justify-center gap-3 rounded-[13px] border border-line bg-surface px-3.5 py-3.5 text-[15px] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-accent"
          >
            <GoogleG />
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-[13px] text-muted">
            <div className="h-px flex-1 bg-line" />
            company workspace
            <div className="h-px flex-1 bg-line" />
          </div>
          <p className="text-center text-[13px] leading-[1.6] text-muted">
            Only invited members of your organisation can sign in. Speak to an
            administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
