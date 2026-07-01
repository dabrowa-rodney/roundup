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

export function GoogleSignInButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/my-reports" })}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-3.5 py-3.5 text-[15px] font-semibold text-ink shadow-[0_1px_2px_rgba(39,50,94,0.07)] transition-colors hover:border-accent"
    >
      <GoogleG />
      Continue with Google
    </button>
  );
}
