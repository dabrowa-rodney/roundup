import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { OnboardingForm } from "@/components/onboarding-form";

// Shown to a signed-in Google identity that has no user row yet: either they
// create a new organisation here, or they need an admin to invite their email.
export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const me = await getSessionUser();
  if (me) redirect("/my-reports"); // already onboarded

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 text-center">
          <div className="font-head text-[24px] font-bold tracking-[-0.02em]">
            Welcome to Roundup
          </div>
          <p className="mt-1.5 text-[14px] text-muted">
            Signed in as{" "}
            <span className="font-semibold text-ink">
              {session.user?.email}
            </span>
          </p>
        </div>
        <OnboardingForm />
        <p className="mt-5 text-center text-[13px] leading-[1.6] text-muted">
          Expecting to join an existing team? Ask your administrator to invite{" "}
          <span className="font-medium text-ink">{session.user?.email}</span>{" "}
          on their Team page, then sign in again.
        </p>
      </div>
    </div>
  );
}
