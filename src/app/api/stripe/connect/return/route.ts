import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountChargesEnabled } from "@/lib/stripe/connect";
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/** Browser return from Stripe Express onboarding. Re-checks charges_enabled and
 *  flips pagamenti_attivi; the webhook (account.updated) is the async backstop. */
export async function GET() {
  const origin = await appOrigin();
  const dash = `${origin}/dashboard/funzionalita`;
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) return NextResponse.redirect(`${origin}/dashboard/login`);
  if (!isStripeConfigured() || !restaurant.stripe_connect_id) {
    return NextResponse.redirect(`${dash}?connect=incompleto`);
  }
  try {
    if (await accountChargesEnabled(restaurant.stripe_connect_id)) {
      const admin = createAdminClient();
      await admin.from("restaurants").update({ pagamenti_attivi: true }).eq("id", restaurant.id);
      return NextResponse.redirect(`${dash}?connect=ok`);
    }
  } catch {
    /* fall through */
  }
  return NextResponse.redirect(`${dash}?connect=incompleto`);
}
