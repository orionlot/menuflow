import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { markOrderPaid } from "./orders";

type Row = Record<string, unknown>;

/**
 * Minimal chainable stub of the admin client for markOrderPaid:
 *  orders: .select("*").eq(...).maybeSingle()  → the order
 *          .update(patch).eq().neq().select("*").maybeSingle() → updated row
 *  restaurants: .select("*").eq(...).maybeSingle() → null (skips notify/decrement)
 */
function stub(
  order: Row | null,
  opts: { selectError?: boolean; updateError?: boolean } = {},
) {
  const state = { updateCalls: 0 };
  const admin = {
    from(table: string) {
      if (table === "restaurants") {
        return {
          select: () => ({
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        };
      }
      // orders
      return {
        select: () => ({
          eq() {
            return this;
          },
          maybeSingle: async () =>
            opts.selectError
              ? { data: null, error: { message: "select boom" } }
              : { data: order, error: null },
        }),
        update: (patch: Row) => ({
          eq() {
            return this;
          },
          neq() {
            return this;
          },
          select() {
            return this;
          },
          maybeSingle: async () => {
            state.updateCalls++;
            return opts.updateError
              ? { data: null, error: { message: "update boom" } }
              : { data: { ...order, ...patch }, error: null };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { admin, state };
}

const order = (over: Row = {}): Row => ({
  id: "o1",
  restaurant_id: "r1",
  totale: 18,
  stato: "in_attesa_pagamento",
  items: [],
  ...over,
});

describe("markOrderPaid — payment-truth amount check", () => {
  it("marks paid when the captured amount matches the total (eur)", async () => {
    const { admin, state } = stub(order());
    const res = await markOrderPaid(admin, { paymentIntentId: "pi", paidAmountCents: 1800, currency: "eur" });
    expect(res?.stato).toBe("pagato");
    expect(state.updateCalls).toBe(1);
  });

  it("does NOT mark paid when the captured amount is short", async () => {
    const { admin, state } = stub(order());
    const res = await markOrderPaid(admin, { paymentIntentId: "pi", paidAmountCents: 1700, currency: "eur" });
    expect(res).toBeNull();
    expect(state.updateCalls).toBe(0); // never flipped the row
  });

  it("does NOT mark paid on a wrong currency", async () => {
    const { admin } = stub(order());
    const res = await markOrderPaid(admin, { paymentIntentId: "pi", paidAmountCents: 1800, currency: "usd" });
    expect(res).toBeNull();
  });

  it("BYPASS: marks paid when no amount is supplied (dev simulator path)", async () => {
    const { admin, state } = stub(order());
    const res = await markOrderPaid(admin, { orderId: "o1" });
    expect(res?.stato).toBe("pagato");
    expect(state.updateCalls).toBe(1);
  });

  it("is idempotent: an already-paid order is returned without a second update", async () => {
    const { admin, state } = stub(order({ stato: "pagato" }));
    const res = await markOrderPaid(admin, { paymentIntentId: "pi", paidAmountCents: 1800 });
    expect(res?.stato).toBe("pagato");
    expect(state.updateCalls).toBe(0);
  });

  it("returns null when the order is not found", async () => {
    const { admin } = stub(null);
    expect(await markOrderPaid(admin, { paymentIntentId: "pi" })).toBeNull();
  });

  it("throws on a DB read error (so the webhook can 500 and Stripe retries)", async () => {
    const { admin } = stub(order(), { selectError: true });
    await expect(markOrderPaid(admin, { paymentIntentId: "pi" })).rejects.toThrow();
  });

  it("throws on a DB update error", async () => {
    const { admin } = stub(order(), { updateError: true });
    await expect(markOrderPaid(admin, { paymentIntentId: "pi", paidAmountCents: 1800 })).rejects.toThrow();
  });
});
