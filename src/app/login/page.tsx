import { db } from "@/db";
import { settings } from "@/db/schema";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const SCHEDULE_DEFAULT = {
  closeDay: "Sunday",
  closeTime: "20:00",
  timezone: "Europe/London",
};

async function getCloseSchedule() {
  try {
    const row = (await db.select().from(settings).limit(1))[0];
    if (row) {
      return {
        closeDay: row.closeDay,
        closeTime: row.closeTime,
        timezone: row.timezone,
      };
    }
  } catch {
    // fall through to defaults if the DB isn't reachable
  }
  return SCHEDULE_DEFAULT;
}

function tzLabel(timezone: string): string {
  return timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
}

export default async function LoginPage() {
  const { closeDay, closeTime, timezone } = await getCloseSchedule();
  const closeLine = `Updates close ${closeDay}s at ${closeTime} · ${tzLabel(timezone)}`;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[1.05fr_0.95fr]">
      {/* Left panel — brand */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-accent px-[60px] py-14 text-accent-ink md:flex">
        {/* Wonde wordmark + product name */}
        <div className="relative z-[2] flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wonde-logo-white.svg"
            alt="Wonde"
            className="h-[26px] w-auto"
          />
          <span className="h-6 w-px bg-white/30" aria-hidden />
          <span className="font-head text-[18px] font-bold tracking-[-0.01em]">
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
        <div className="relative z-[2] text-[13px] opacity-75">{closeLine}</div>
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
          <GoogleSignInButton />
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
