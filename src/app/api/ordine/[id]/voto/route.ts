import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Customer leaves a 1–5 star vote on their order (once). Public, scoped by id. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await hitRateLimit(`voto:${req.headers.get("x-forwarded-for") ?? "anon"}`, 10, 60_000))) {
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

  const { data } = await admin.from("orders").select("voto").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ ok: false, error: "Ordine non trovato." }, { status: 404 });
  if ((data as { voto: number | null }).voto != null) {
    return NextResponse.json({ ok: true, already: true });
  }
  await admin.from("orders").update({ voto }).eq("id", id);
  return NextResponse.json({ ok: true });
}
