import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { SettingsProvider } from "@/components/settings-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the whole app shell behind authentication…
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // …and behind membership: a signed-in identity without a user row hasn't
  // created/joined an organisation yet.
  const me = await getSessionUser();
  if (!me) redirect("/onboarding");

  // Contributors and recipients only complete reports, so they get a slim
  // top bar instead of the admin sidebar.
  const shell =
    me.role === "admin" ? (
      <div className="flex h-screen flex-col lg:flex-row">
        <Sidebar />
        <main className="sc min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    ) : (
      <div className="flex h-screen flex-col">
        <Topbar />
        <main className="sc min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    );

  return (
    <SettingsProvider>
      {/* <main> is the single scroll container in both shells, so each
          Screen's sticky header keeps working. */}
      {shell}
    </SettingsProvider>
  );
}
