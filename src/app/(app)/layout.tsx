import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SettingsProvider } from "@/components/settings-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the whole app shell behind authentication.
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <SettingsProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="sc h-screen min-w-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SettingsProvider>
  );
}
