import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmailSignIn } from "@/components/email-sign-in";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[1.05fr_0.95fr]">
      {/* Left panel — brand */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-accent px-[60px] py-14 text-accent-ink md:flex">
        {/* Product mark + name — links back to the homepage */}
        <Link href="/" className="relative z-[2] flex w-fit items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/roundup-icon-white.svg"
            alt="Roundup"
            className="h-[34px] w-[34px]"
          />
          <span className="font-head text-[18px] font-bold tracking-[-0.01em]">
            Roundup
          </span>
        </Link>
        <div className="relative z-[2] max-w-[430px]">
          <div className="font-head text-[46px] font-bold leading-[1.05] tracking-[-0.025em]">
            Your team&apos;s week, in one place.
          </div>
          <p className="mt-[18px] text-[16px] leading-[1.6] opacity-85">
            Each lead files a short weekly update. Roundup gathers them, folds in
            your data, and writes the summary your senior team actually reads.
          </p>
        </div>
        <div className="absolute -bottom-[120px] -right-[120px] h-[420px] w-[420px] rounded-full bg-white/[0.07]" />
        <div className="absolute -top-[90px] right-10 h-[240px] w-[240px] rounded-full bg-white/[0.06]" />
      </div>

      {/* Right panel — sign in */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="fade-up w-full max-w-[380px]">
          {/* Brand row — only on mobile, where the brand panel is hidden */}
          <Link href="/" className="mb-8 flex w-fit items-center gap-3 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/roundup-icon.svg" alt="" className="h-9 w-9" />
            <span className="font-head text-[18px] font-bold tracking-[-0.01em]">
              Roundup
            </span>
          </Link>
          <div className="font-head text-[28px] font-bold tracking-[-0.02em]">
            Welcome back
          </div>
          <p className="mb-[30px] mt-2 text-[15px] text-muted">
            Sign in to your workspace — or create one for your organisation.
          </p>
          <GoogleSignInButton />
          <div className="my-5 flex items-center gap-3 text-[13px] text-muted">
            <div className="h-px flex-1 bg-line" />
            or
            <div className="h-px flex-1 bg-line" />
          </div>
          <EmailSignIn />
          <p className="mt-7 text-center text-[13px] leading-[1.6] text-muted">
            New here? Sign in either way and you can set up your organisation
            in under a minute. Joining an existing team? Ask an administrator
            to invite your email first.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-[7px] text-[13px] font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <ArrowLeft size={15} /> Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
