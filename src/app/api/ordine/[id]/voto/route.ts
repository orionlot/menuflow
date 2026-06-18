import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Customer leaves a 1–5 star vote on their order (once). Public, scoped by id. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await hitRateLimit(`voto:${clientIp(req.headers)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }
  let body: { voto?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const voto = Math.round(Number(body.voto));
  if (!Number.isInteger(voto) || voto < 1 || voto > 5) {
    return NextResponse.json({ ok: false, error: "Voto non valido." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // Idempotent + race-safe: only the first vote wins (UPDATE … WHERE voto IS NULL).
  // Two concurrent posts can't both overwrite — the loser matches 0 rows.
  const { data, error } = await admin
    .from("orders")
    .update({ voto })
    .eq("id", id)
    .is("voto", null)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  // No row updated → order missing or already voted; either way the vote is a no-op.
  if (!data) return NextResponse.json({ ok: true, already: true });
  return NextResponse.json({ ok: true });
}
