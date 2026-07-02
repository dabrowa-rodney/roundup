import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// GET /api/health — liveness + database connectivity check.
export async function GET() {
  let database = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "error";
  }

  const healthy = database === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
