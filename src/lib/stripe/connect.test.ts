import { describe, it, expect } from "vitest";
import { buildCheckoutParams, checkoutSessionPaidArgs } from "@/lib/stripe/connect";

const base = {
  orderId: "ord-1",
  restaurantId: "rest-1",
  restaurantName: "Trattoria Da Test",
  tavolo: "5" as string | null,
  totaleCents: 4500,
  successUrl: "https://x.it/ordine/ord-1?pagato=1",
  cancelUrl: "https://x.it/ordine/ord-1",
};

describe("buildCheckoutParams", () => {
  it("builds a single EUR line item for the recomputed total", () => {
    const p = buildCheckoutParams(base);
    expect(p.mode).toBe("payment");
    expect(p.locale).toBe("it");
    expect(p.line_items).toHaveLength(1);
    const li = p.line_items![0];
    expect(li.quantity).toBe(1);
    expect(li.price_data!.currency).toBe("eur");
    expect(li.price_data!.unit_amount).toBe(4500);
  });

  it("carries order_id in BOTH session and payment_intent metadata", () => {
    const p = buildCheckoutParams(base);
    expect(p.metadata!.order_id).toBe("ord-1");
    expect(p.metadata!.restaurant_id).toBe("rest-1");
    expect(p.payment_intent_data!.metadata!.order_id).toBe("ord-1");
  });

  it("uses the given urls, sets no platform fee, and no explicit method list", () => {
    const p = buildCheckoutParams(base);
    expect(p.success_url).toBe(base.successUrl);
    expect(p.cancel_url).toBe(base.cancelUrl);
    expect(p.payment_intent_data!.application_fee_amount).toBeUndefined();
    expect(p.payment_method_types).toBeUndefined();
  });

  it("includes the table in the product name, and omits it when null", () => {
    expect(buildCheckoutParams(base).line_items![0].price_data!.product_data!.name)
      .toBe("Ordine — Trattoria Da Test · Tavolo 5");
    expect(buildCheckoutParams({ ...base, tavolo: null }).line_items![0].price_data!.product_data!.name)
      .toBe("Ordine — Trattoria Da Test");
  });
});

describe("checkoutSessionPaidArgs", () => {
  it("extracts orderId, amount, currency and PI id (string PI)", () => {
    expect(
      checkoutSessionPaidArgs({
        metadata: { order_id: "ord-9" },
        amount_total: 4500,
        currency: "eur",
        payment_intent: "pi_123",
      }),
    ).toEqual({ orderId: "ord-9", paidAmountCents: 4500, currency: "eur", paymentIntentId: "pi_123" });
  });

  it("handles an expanded payment_intent object and missing amount", () => {
    const args = checkoutSessionPaidArgs({
      metadata: { order_id: "ord-9" },
      amount_total: null,
      currency: null,
      payment_intent: { id: "pi_obj" },
    });
    expect(args.paymentIntentId).toBe("pi_obj");
    expect(args.paidAmountCents).toBeUndefined();
    expect(args.currency).toBeUndefined();
  });
});
