import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { fetchSheetPreview } from "@/lib/sheets";

// GET /api/sheets/preview?url=... — admin-only. Reads a Google Sheet and returns
// the metrics it would contribute to a Roundup (for sanity-checking a connection).
// Only ever fetches docs.google.com URLs (sheetCsvUrl rejects anything else).
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!url) {
    return NextResponse.json({ ok: false, reason: "invalid_url", metrics: [] });
  }

  const preview = await fetchSheetPreview(url);
  return NextResponse.json(preview);
}
