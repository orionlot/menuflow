import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { priceCartServerSide } from "./pricing";

/** Stub admin: resolves menu_items / ingredients selects (chainable, thenable). */
function stubAdmin(menuItems: unknown[], ingredients: unknown[]) {
  return {
    from(table: string) {
      const rows = table === "menu_items" ? menuItems : ingredients;
      const builder: Record<string, unknown> = {
        select: () => builder,
        in: () => builder,
        eq: () => builder,
        then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: rows, error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

// A product that is per-item composable with a REQUIRED group (min 1).
const makeItem = () => ({
  id: "p",
  nome: "Pizza",
  prezzo: 8,
  disponibile: true,
  restaurant_id: "r",
  categoria: "Pizze",
  opzioni: [],
  scorta: null,
  composizione: [
    { id: "g", nome: "Condimenti", categorie: [], min: 1, max: 2, ingredienti: [{ ingredient_id: "tonno" }] },
  ],
  composizione_taglie: [],
});
const ING = [{ id: "tonno", nome: "Tonno", prezzo: 2, scorta: 5 }];

describe("priceCartServerSide — componibili feature gate", () => {
  it("ignores stale per-item composition when the feature is OFF (order not blocked)", async () => {
    const admin = stubAdmin([makeItem()], ING);
    // No composizione sent (the public client hides the picker when off).
    const r = await priceCartServerSide(
      admin, "r", [{ item_id: "p", qta: 1 }], [], {}, [], [], /* componibili */ false,
    );
    expect(r.itemsTotaleCents).toBe(800); // plain base price, no required-group throw
  });

  it("enforces per-item composition when the feature is ON", async () => {
    const admin = stubAdmin([makeItem()], ING);
    // Required group with nothing chosen → must throw.
    await expect(
      priceCartServerSide(admin, "r", [{ item_id: "p", qta: 1 }], [], {}, [], [], true),
    ).rejects.toThrow(/Scegli almeno/);
  });

  it("prices the per-item composition when ON and a valid choice is sent", async () => {
    const admin = stubAdmin([makeItem()], ING);
    const r = await priceCartServerSide(
      admin, "r",
      [{ item_id: "p", qta: 1, composizione: [{ ingredient_id: "tonno", qta: 1 }] }],
      [], {}, [], [], true,
    );
    expect(r.itemsTotaleCents).toBe(800 + 200); // base + tonno €2
  });
});
