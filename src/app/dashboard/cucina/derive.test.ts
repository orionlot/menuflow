import { describe, it, expect } from "vitest";
import {
  itemStageOf,
  orderStageOf,
  rollupTimestamps,
  applyItemStageLocal,
  groupByTable,
} from "./derive";

const T0 = "2026-06-22T10:00:00.000Z";
const T1 = "2026-06-22T10:05:00.000Z";
const T2 = "2026-06-22T10:10:00.000Z";

describe("itemStageOf", () => {
  it("derives the stage from the stamps", () => {
    expect(itemStageOf({})).toBe("da_preparare");
    expect(itemStageOf({ preparazione_at: T0 })).toBe("in_preparazione");
    expect(itemStageOf({ preparazione_at: T0, pronto_at: T1 })).toBe("pronti");
    expect(itemStageOf({ servito_at: T2 })).toBe("serviti");
  });
});

describe("orderStageOf", () => {
  it("is da_preparare with no items or no stamps", () => {
    expect(orderStageOf([])).toBe("da_preparare");
    expect(orderStageOf([{}, {}])).toBe("da_preparare");
  });
  it("is in_preparazione when at least one item started", () => {
    expect(orderStageOf([{ preparazione_at: T0 }, {}])).toBe("in_preparazione");
  });
  it("is pronti only when every item is ready (pronto or served)", () => {
    expect(orderStageOf([{ pronto_at: T1 }, { preparazione_at: T0 }])).toBe("in_preparazione");
    expect(orderStageOf([{ pronto_at: T1 }, { servito_at: T2 }])).toBe("pronti");
  });
  it("is serviti only when every item is served", () => {
    expect(orderStageOf([{ servito_at: T2 }, { pronto_at: T1 }])).toBe("pronti");
    expect(orderStageOf([{ servito_at: T2 }, { servito_at: T1 }])).toBe("serviti");
  });
});

describe("rollupTimestamps", () => {
  it("preparazione_at = earliest started item", () => {
    expect(rollupTimestamps([{ preparazione_at: T1 }, { preparazione_at: T0 }]).preparazione_at).toBe(T0);
  });
  it("pronto_at is null until all ready, then the latest ready time", () => {
    expect(rollupTimestamps([{ pronto_at: T0 }, { preparazione_at: T1 }]).pronto_at).toBeNull();
    expect(rollupTimestamps([{ pronto_at: T0 }, { servito_at: T2 }]).pronto_at).toBe(T2);
  });
  it("servito_at is null until all served, then the latest", () => {
    expect(rollupTimestamps([{ servito_at: T0 }, { pronto_at: T1 }]).servito_at).toBeNull();
    expect(rollupTimestamps([{ servito_at: T0 }, { servito_at: T2 }]).servito_at).toBe(T2);
  });
});

describe("applyItemStageLocal", () => {
  it("preserves forward stamps and clears going back", () => {
    const a = applyItemStageLocal({ nome: "x", preparazione_at: T0 }, "pronti", T1);
    expect(a.preparazione_at).toBe(T0);
    expect(a.pronto_at).toBe(T1);
    const b = applyItemStageLocal(a, "da_preparare", T2);
    expect(b.preparazione_at).toBeNull();
    expect(b.pronto_at).toBeNull();
  });
});

describe("groupByTable", () => {
  it("groups same-tavolo orders and isolates asporto orders", () => {
    const g = groupByTable([
      { id: "o1", tavolo: "3", created_at: T0 },
      { id: "o2", tavolo: "3", created_at: T1 },
      { id: "o3", tavolo: null, asporto: true, created_at: T0 },
    ]);
    const tav3 = g.find((x) => x.tavolo === "3");
    expect(tav3?.orders.map((o) => o.id)).toEqual(["o1", "o2"]); // sorted by created_at
    expect(g.filter((x) => x.asporto)).toHaveLength(1);
  });
});
