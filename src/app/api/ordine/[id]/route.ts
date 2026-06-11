import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Public order-status lookup by id (unguessable UUID). Returns only the
 * kitchen/payment lifecycle fields so the customer at the table can see
 * "in preparazione → pronto". No personal data.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("stato, pronto_at, servito_at")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
