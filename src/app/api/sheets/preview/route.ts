import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fetchSheetPreview } from "@/lib/sheets";

// GET /api/sheets/preview?url=... — admin-only. Reads a Google Sheet and returns
// the metrics it would contribute to a Roundup (for sanity-checking a connection).
// Only ever fetches docs.google.com URLs (sheetCsvUrl rejects anything else).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const caller = (
    await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, session.user.email.toLowerCase()))
      .limit(1)
  )[0];
  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!url) {
    return NextResponse.json({ ok: false, reason: "invalid_url", metrics: [] });
  }

  const preview = await fetchSheetPreview(url);
  return NextResponse.json(preview);
}
