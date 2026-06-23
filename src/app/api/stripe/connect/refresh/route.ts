import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";
import { createAccountOnboardingLink } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

/** Re-issue an onboarding link (AccountLinks expire) and bounce the user back in. */
export async function GET() {
  const origin = await appOrigin();
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) return NextResponse.redirect(`${origin}/dashboard/login`);
  if (!isStripeConfigured() || !restaurant.stripe_connect_id) {
    return NextResponse.redirect(`${origin}/dashboard/funzionalita?connect=incompleto`);
  }
  try {
    const url = await createAccountOnboardingLink({
      accountId: restaurant.stripe_connect_id,
      refreshUrl: `${origin}/api/stripe/connect/refresh`,
      returnUrl: `${origin}/api/stripe/connect/return`,
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(`${origin}/dashboard/funzionalita?connect=incompleto`);
  }
}
