import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/types/db";
import { decrementMenuItemStock } from "./menu-stock";

/** Records the consume_menu_item RPC calls. */
function stubAdmin() {
  const rpcCalls: { p_id: string; p_n: number }[] = [];
  const admin = {
    rpc: (_name: string, args: { p_id: string; p_n: number }) => {
      rpcCalls.push(args);
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  const consumed = () => Object.fromEntries(rpcCalls.map((c) => [c.p_id, c.p_n]));
  return { admin, rpcCalls, consumed };
}

const line = (over: Partial<OrderItem>): OrderItem => ({
  item_id: "x",
  nome: "X",
  qta: 1,
  prezzo: 1,
  ...over,
});

describe("decrementMenuItemStock", () => {
  it("consumes one unit of stock per ordered product unit", async () => {
    const { admin, consumed } = stubAdmin();
    await decrementMenuItemStock(admin, [
      line({ item_id: "pizza", qta: 3 }),
      line({ item_id: "tiramisu", qta: 1 }),
    ]);
    expect(consumed()).toEqual({ pizza: 3, tiramisu: 1 });
  });

  it("aggregates duplicate item lines into a single decrement", async () => {
    const { admin, rpcCalls, consumed } = stubAdmin();
    await decrementMenuItemStock(admin, [
      line({ item_id: "pizza", qta: 2 }),
      line({ item_id: "pizza", qta: 3 }),
    ]);
    // one RPC for "pizza" with the summed quantity — not two
    expect(rpcCalls).toHaveLength(1);
    expect(consumed()).toEqual({ pizza: 5 });
  });

  it("does nothing for an empty order", async () => {
    const { admin, rpcCalls } = stubAdmin();
    await decrementMenuItemStock(admin, []);
    expect(rpcCalls).toHaveLength(0);
  });
});
