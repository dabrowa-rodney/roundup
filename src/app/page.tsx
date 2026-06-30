import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Land authenticated users on their dashboard; everyone else on the login screen.
export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/my-reports" : "/login");
}
