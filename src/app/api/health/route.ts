import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Lightweight backend health probe. The public menu client calls this before
 * enabling ordering; on failure it shows the maintenance notice instead of the
 * cart (briefing §5). Returns 503 if the DB is unreachable.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("restaurants").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
