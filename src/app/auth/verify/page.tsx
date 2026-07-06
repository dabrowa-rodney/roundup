import { VerifyClient } from "@/components/verify-client";

// Landing page for emailed magic links: exchanges the token for a session.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email = "", token = "" } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <VerifyClient email={email} token={token} />
    </div>
  );
}
