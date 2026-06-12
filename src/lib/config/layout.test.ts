import { describe, it, expect } from "vitest";
import { resolveLayout, DEFAULT_LAYOUT } from "@/lib/config/layout";

describe("resolveLayout", () => {
  it("returns defaults for empty or invalid input", () => {
    expect(resolveLayout({})).toEqual(DEFAULT_LAYOUT);
    expect(resolveLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(resolveLayout({ bordi: "xxx", font: "zzz", densita: "boh" })).toEqual(DEFAULT_LAYOUT);
  });
  it("keeps valid values and sanitizes hidden categories", () => {
    const l = resolveLayout({
      bordi: "squadrati",
      font: "elegante",
      densita: "compatta",
      foto_pos: "sopra",
      intestazione: "minimal",
      foto_categorie_nascoste: ["Bevande", "", "  Dolci  "],
    });
    expect(l.bordi).toBe("squadrati");
    expect(l.font).toBe("elegante");
    expect(l.densita).toBe("compatta");
    expect(l.foto_pos).toBe("sopra");
    expect(l.intestazione).toBe("minimal");
    expect(l.foto_categorie_nascoste).toEqual(["Bevande", "Dolci"]);
  });
});
