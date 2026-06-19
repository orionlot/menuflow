import { describe, it, expect } from "vitest";
import { validatePrenotazione } from "./prenotazioni";

const base = { nome: "Mario", telefono: "+39 333 1234567", data: "2999-12-31", ora: "20:30", coperti: 2 };

describe("validatePrenotazione", () => {
  it("accepts a well-formed request", () => {
    const r = validatePrenotazione(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ nome: "Mario", coperti: 2, sala: null, note: null });
  });

  it("rejects a missing/short name", () => {
    expect(validatePrenotazione({ ...base, nome: "" })).toMatchObject({ ok: false });
    expect(validatePrenotazione({ ...base, nome: "A" })).toMatchObject({ ok: false });
  });

  it("rejects an invalid phone", () => {
    expect(validatePrenotazione({ ...base, telefono: "abc" })).toMatchObject({ ok: false });
    expect(validatePrenotazione({ ...base, telefono: "" })).toMatchObject({ ok: false });
  });

  it("rejects bad date/time", () => {
    expect(validatePrenotazione({ ...base, data: "31-12-2999" })).toMatchObject({ ok: false });
    expect(validatePrenotazione({ ...base, ora: "25:00" })).toMatchObject({ ok: false });
  });

  it("rejects a past date when minDate is given", () => {
    expect(validatePrenotazione({ ...base, data: "2020-01-01" }, { minDate: "2026-06-19" })).toMatchObject({
      ok: false,
    });
    expect(validatePrenotazione({ ...base, data: "2026-06-19" }, { minDate: "2026-06-19" }).ok).toBe(true);
  });

  it("clamps invalid party size", () => {
    expect(validatePrenotazione({ ...base, coperti: 0 })).toMatchObject({ ok: false });
    expect(validatePrenotazione({ ...base, coperti: 999 })).toMatchObject({ ok: false });
  });

  it("trims optional sala/note to null when empty", () => {
    const r = validatePrenotazione({ ...base, sala: "  ", note: "" });
    expect(r.ok && r.value.sala).toBe(null);
    expect(r.ok && r.value.note).toBe(null);
  });
});
