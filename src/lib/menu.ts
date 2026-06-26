import { ALLERGENI_BY_ID } from "@/lib/config/allergeni";
import type {
  CategoryAddon,
  ComposizioneGruppo,
  ComposizioneScelta,
  ItemNota,
  ItemOption,
  MenuItem,
  NoteConfig,
  Reparto,
  RicettaVoce,
  Sala,
  SalaTavolo,
  TagliaComposizione,
} from "@/types/db";

/**
 * Effective option groups for an item = its own options + any category add-ons
 * that target the item's category. On a name clash, the item's own option wins.
 */
export function effectiveOptions(
  item: { categoria: string; opzioni?: ItemOption[] },
  aggiunte?: CategoryAddon[],
): ItemOption[] {
  const base = item.opzioni ?? [];
  const taken = new Set(base.map((g) => g.nome));
  const extra: ItemOption[] = (aggiunte ?? [])
    .filter((a) => a.categorie?.includes(item.categoria) && !taken.has(a.nome))
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      obbligatorio: a.obbligatorio,
      scelte: a.scelte,
    }));
  return [...base, ...extra];
}

export function sanitizeAggiunte(raw: unknown): CategoryAddon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<CategoryAddon>;
      const scelte = Array.isArray(o.scelte)
        ? o.scelte
            .slice(0, 20)
            .map((s) => ({
              nome: String(s?.nome ?? "").trim().slice(0, 40),
              prezzo: Math.max(0, Math.round(Number(s?.prezzo ?? 0) * 100) / 100),
            }))
            .filter((s) => s.nome)
        : [];
      const categorie = Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      return {
        id: String(o.id ?? `a${gi}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        tipo: o.tipo === "single" ? ("single" as const) : ("multi" as const),
        obbligatorio: Boolean(o.obbligatorio),
        scelte,
        categorie,
      };
    })
    .filter((g) => g.nome && g.scelte.length && g.categorie.length);
}

export interface ItemPatch {
  nome?: string;
  categoria?: string;
  descrizione?: string | null;
  prezzo?: number;
  disponibile?: boolean;
  foto_url?: string | null;
  ordine?: number;
  nome_i18n?: Record<string, string>;
  descrizione_i18n?: Record<string, string>;
  allergeni?: string[];
  opzioni?: ItemOption[];
  consigliato?: boolean;
  scorta?: number | null;
  ingredienti?: RicettaVoce[]; // the dish recipe: ingredient ids + grams used
  composizione?: ComposizioneGruppo[]; // per-item composition groups (category-less)
  composizione_taglie?: TagliaComposizione[]; // per-item size variants (category-less)
  nota?: ItemNota; // per-product customer-note override
  tempo_preparazione?: number | null;
  peso?: number | null; // manual total weight (g) — overrides the ingredient auto-sum
  kcal?: number | null; // manual total calories — overrides the ingredient auto-sum
  reparto?: string;
  prezzo_asporto?: number | null;
  etichette?: string[];
  solo_pranzo?: boolean;
  solo_cena?: boolean;
  in_vetrina?: boolean;
  vetrina_annuncio?: string | null;
}

export function sanitizeOpzioni(raw: unknown): ItemOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 10)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<ItemOption>;
      const scelte = Array.isArray(o.scelte)
        ? o.scelte
            .slice(0, 20)
            .map((s) => ({
              nome: String(s?.nome ?? "").trim().slice(0, 40),
              prezzo: Math.max(0, Math.round(Number(s?.prezzo ?? 0) * 100) / 100),
            }))
            .filter((s) => s.nome)
        : [];
      return {
        id: String(o.id ?? `g${gi}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        tipo: o.tipo === "single" ? ("single" as const) : ("multi" as const),
        obbligatorio: Boolean(o.obbligatorio),
        scelte,
      };
    })
    .filter((g) => g.nome && g.scelte.length);
}

/** Keep only lang-code keys with non-empty trimmed string values (e.g. for
 *  `nome_i18n`). Defensive: server actions never trust the client payload. */
export function sanitizeI18n(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Object.keys(out).length >= 24) break; // bound key count (sibling sanitizers all cap)
      if (/^[a-z]{2,5}$/.test(k) && typeof v === "string") {
        const t = v.trim().slice(0, 80);
        if (t) out[k] = t;
      }
    }
  }
  return out;
}

/** Per-category average prep minutes: { "Antipasti": 10 }. Keeps non-empty
 *  category names mapped to 1–600 min; caps at 60 categories. */
export function sanitizeCategoriaTempi(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Object.keys(out).length >= 60) break;
      const cat = String(k).trim().slice(0, 60);
      const min = Math.max(0, Math.min(600, Math.floor(Number(v) || 0)));
      if (cat && min > 0) out[cat] = min;
    }
  }
  return out;
}

/** Whitelist a custom category-order list: trimmed, de-duplicated, capped. */
export function sanitizeCategorieOrdine(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const name = String(v ?? "").trim().slice(0, 60);
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= 100) break;
  }
  return out;
}

/** Whitelist the "auto-ready" category list (same rules as the category order). */
export function sanitizeCategoriePronte(raw: unknown): string[] {
  return sanitizeCategorieOrdine(raw);
}

/** Stamp order lines whose category is configured as "ready to serve" as already
 *  prepared + ready, so the KDS shows them in "Pronti" the moment the order is
 *  created (e.g. water/drinks that need no preparation). Held ("a seguire") lines
 *  are never auto-readied — the waiter held them on purpose. Pure / no-op when the
 *  list is empty. */
export function markCategoriePronte<
  T extends {
    item_id: string;
    a_seguire?: boolean;
    preparazione_at?: string | null;
    pronto_at?: string | null;
  },
>(
  lines: T[],
  categoriaById: Record<string, string | null | undefined>,
  categoriePronte: string[],
  nowIso: string,
): T[] {
  if (!categoriePronte.length) return lines;
  const ready = new Set(categoriePronte);
  return lines.map((l) => {
    const cat = categoriaById[l.item_id];
    if (l.a_seguire || !cat || !ready.has(cat)) return l;
    return { ...l, preparazione_at: nowIso, pronto_at: nowIso };
  });
}

/** Coerce a menu item's `ingredienti` value READ FROM THE DB into the canonical
 *  RicettaVoce[] shape. Tolerates legacy bare-id strings (pre-0035 rows, seeds,
 *  or out-of-band writes) and drops malformed entries. Apply at every read
 *  boundary that hands menu items to a display surface, so the public menu and
 *  dashboard never silently lose ingredient names / nutrition on legacy data. */
export function normalizeRicetta(raw: unknown): RicettaVoce[] {
  if (!Array.isArray(raw)) return [];
  const out: RicettaVoce[] = [];
  for (const v of raw) {
    if (typeof v === "string") {
      const id = v.trim();
      if (id) out.push({ id, grammi: null });
    } else if (v && typeof v === "object") {
      const o = v as Partial<RicettaVoce>;
      const id = typeof o.id === "string" ? o.id.trim() : "";
      if (id)
        out.push({ id, grammi: typeof o.grammi === "number" && Number.isFinite(o.grammi) ? o.grammi : null });
    }
  }
  return out;
}

export function sanitizeItemPatch(patch: ItemPatch): ItemPatch {
  const out: ItemPatch = {};
  if (typeof patch.nome === "string") out.nome = patch.nome.trim().slice(0, 120);
  if (typeof patch.categoria === "string")
    out.categoria = patch.categoria.trim().slice(0, 60);
  if ("descrizione" in patch)
    out.descrizione = patch.descrizione
      ? String(patch.descrizione).slice(0, 400)
      : null;
  if (typeof patch.prezzo === "number" && patch.prezzo >= 0)
    out.prezzo = Math.round(patch.prezzo * 100) / 100;
  if (typeof patch.disponibile === "boolean") out.disponibile = patch.disponibile;
  if ("foto_url" in patch) out.foto_url = patch.foto_url || null;
  if (typeof patch.ordine === "number") out.ordine = patch.ordine;
  if (patch.nome_i18n && typeof patch.nome_i18n === "object")
    out.nome_i18n = patch.nome_i18n;
  if (patch.descrizione_i18n && typeof patch.descrizione_i18n === "object")
    out.descrizione_i18n = patch.descrizione_i18n;
  if (Array.isArray(patch.allergeni))
    out.allergeni = patch.allergeni.filter((a) => ALLERGENI_BY_ID.has(a)).slice(0, 14);
  if (Array.isArray(patch.opzioni)) out.opzioni = sanitizeOpzioni(patch.opzioni);
  if (typeof patch.consigliato === "boolean") out.consigliato = patch.consigliato;
  if ("scorta" in patch)
    out.scorta =
      patch.scorta == null ? null : Math.max(0, Math.floor(Number(patch.scorta) || 0));
  if (Array.isArray(patch.ingredienti))
    out.ingredienti = (patch.ingredienti as unknown[])
      .map((v): RicettaVoce | null => {
        // Accept both the new {id, grammi} shape and a legacy bare id string.
        if (typeof v === "string") {
          const id = v.trim().slice(0, 40);
          return id ? { id, grammi: null } : null;
        }
        const o = (v ?? {}) as Partial<RicettaVoce>;
        const id = String(o.id ?? "").trim().slice(0, 40);
        if (!id) return null;
        // Non-numeric/NaN grammi → null (fall back to the ingredient's default
        // portion), NOT 0 (which would mean "explicitly zero grams").
        const n = Number(o.grammi);
        const grammi = o.grammi == null || !Number.isFinite(n) ? null : Math.max(0, Math.min(100000, Math.round(n)));
        return { id, grammi };
      })
      .filter((v): v is RicettaVoce => v !== null)
      .slice(0, 40);
  if (Array.isArray(patch.composizione))
    out.composizione = sanitizeComposizione(patch.composizione, { requireCategorie: false });
  if (Array.isArray(patch.composizione_taglie))
    out.composizione_taglie = sanitizeTaglie(patch.composizione_taglie, { requireCategorie: false });
  if (patch.nota && typeof patch.nota === "object") out.nota = sanitizeNota(patch.nota);
  if ("tempo_preparazione" in patch)
    out.tempo_preparazione =
      patch.tempo_preparazione == null
        ? null
        : Math.max(0, Math.min(600, Math.floor(Number(patch.tempo_preparazione) || 0)));
  if ("peso" in patch)
    out.peso = patch.peso == null ? null : Math.max(0, Math.min(100000, Math.round(Number(patch.peso) || 0)));
  if ("kcal" in patch)
    out.kcal = patch.kcal == null ? null : Math.max(0, Math.min(100000, Math.round(Number(patch.kcal) || 0)));
  if (typeof patch.reparto === "string") out.reparto = patch.reparto.trim().slice(0, 40);
  if ("prezzo_asporto" in patch)
    out.prezzo_asporto =
      patch.prezzo_asporto == null
        ? null
        : Math.max(0, Math.round(Number(patch.prezzo_asporto) * 100) / 100);
  if (Array.isArray(patch.etichette))
    out.etichette = patch.etichette
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20);
  if (typeof patch.solo_pranzo === "boolean") out.solo_pranzo = patch.solo_pranzo;
  if (typeof patch.solo_cena === "boolean") out.solo_cena = patch.solo_cena;
  if (typeof patch.in_vetrina === "boolean") out.in_vetrina = patch.in_vetrina;
  if ("vetrina_annuncio" in patch) {
    const v = typeof patch.vetrina_annuncio === "string" ? patch.vetrina_annuncio.trim().slice(0, 140) : "";
    out.vetrina_annuncio = v || null;
  }
  return out;
}

/** Shape a per-product customer-note config. */
export function sanitizeNota(raw: unknown): ItemNota {
  const o = (raw ?? {}) as Partial<ItemNota>;
  const out: ItemNota = { attiva: Boolean(o.attiva) };
  if (typeof o.label === "string" && o.label.trim()) out.label = o.label.trim().slice(0, 60);
  if (o.obbligatoria) out.obbligatoria = true;
  return out;
}

/** Whitelist the category-scoped customer-note config. A row is kept only if it
 *  targets at least one category. */
export function sanitizeNoteConfig(raw: unknown): NoteConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<NoteConfig>;
      const categorie = Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      const out: NoteConfig = { id: String(o.id ?? `n${gi}`).slice(0, 40), categorie };
      if (typeof o.label === "string" && o.label.trim()) out.label = o.label.trim().slice(0, 60);
      if (o.obbligatoria) out.obbligatoria = true;
      return out;
    })
    .filter((g) => g.categorie.length);
}

/** Whitelist a dish-label catalog: trimmed, de-duped (case-insensitive), capped. */
export function sanitizeEtichette(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const v = String(x ?? "").trim().slice(0, 30);
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
    if (out.length >= 30) break;
  }
  return out;
}

/** Sanitize the restaurateur-configured kitchen departments (reparti).
 *  Each entry is { id, nome, colore }. Existing ids are preserved (dishes
 *  reference reparti by id); new entries get a slug id derived from the name,
 *  de-duplicated. Colour must be a #rrggbb hex, else a neutral default. */
export function sanitizeReparti(raw: unknown): Reparto[] {
  if (!Array.isArray(raw)) return [];
  const usedIds = new Set<string>();
  const out: Reparto[] = [];
  for (const x of raw) {
    const r = (x ?? {}) as { id?: unknown; nome?: unknown; colore?: unknown; capienza?: unknown };
    const nome = String(r.nome ?? "").trim().slice(0, 40);
    if (!nome) continue;
    // Prefer an existing id (keeps dish references stable); else slugify the name.
    let base = String(r.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (!base) {
      base =
        nome
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "reparto";
    }
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    const coloreRaw = String(r.colore ?? "").trim();
    const colore = /^#[0-9a-fA-F]{6}$/.test(coloreRaw) ? coloreRaw : "#64748b";
    const capienzaN = Math.floor(Number(r.capienza) || 0);
    const capienza = capienzaN > 0 ? Math.min(50, capienzaN) : undefined;
    out.push(capienza ? { id, nome, colore, capienza } : { id, nome, colore });
    if (out.length >= 20) break;
  }
  return out;
}

/** True when an item can't be ordered with a bare {item_id, qta} — it requires a
 *  mandatory option/add-on choice, a required size, or a min>=1 composition. Used
 *  to filter the manual-order / sala pickers (which don't collect choices). */
export function menuItemNeedsChoice(
  item: MenuItem,
  aggiunte: CategoryAddon[],
  composizione: ComposizioneGruppo[],
  composizioneTaglie: TagliaComposizione[],
  componibiliOn: boolean,
): boolean {
  if (effectiveOptions(item, aggiunte).some((g) => g.obbligatorio)) return true;
  if (componibiliOn) {
    const taglie = item.composizione_taglie?.length
      ? item.composizione_taglie
      : composizioneTaglie.filter((t) => t.categorie.includes(item.categoria));
    if (taglie.length) return true;
    const compo = item.composizione?.length
      ? item.composizione
      : composizione.filter((g) => g.categorie.includes(item.categoria));
    if (compo.some((g) => (g.min ?? 0) >= 1)) return true;
  }
  return false;
}

/** Slugify a string into a stable id, with a fallback when empty. */
function slugId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || fallback;
}

/** Sanitize the floor-plan rooms + tables (Sala builder). Stable slug ids are
 *  preserved (so an in-flight order's table label stays valid); x/y clamp to
 *  0–100 (% of canvas); names/counts are bounded. */
export function sanitizeSale(raw: unknown): Sala[] {
  if (!Array.isArray(raw)) return [];
  const usedRoom = new Set<string>();
  const out: Sala[] = [];
  const clamp = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : 50;
  };
  for (const r of raw) {
    const room = (r ?? {}) as { id?: unknown; nome?: unknown; tavoli?: unknown };
    const nome = String(room.nome ?? "").trim().slice(0, 40);
    if (!nome) continue;
    const roomBase = slugId(String(room.id ?? "").trim(), slugId(nome, "sala"));
    let id = roomBase;
    let n = 2;
    while (usedRoom.has(id)) id = `${roomBase}-${n++}`;
    usedRoom.add(id);

    const usedTable = new Set<string>();
    const tavoli: SalaTavolo[] = [];
    for (const tv of Array.isArray(room.tavoli) ? room.tavoli : []) {
      const t = (tv ?? {}) as {
        id?: unknown;
        nome?: unknown;
        x?: unknown;
        y?: unknown;
        posti?: unknown;
        note?: unknown;
        nota?: unknown;
        forma?: unknown;
      };
      const tnome = String(t.nome ?? "").trim().slice(0, 20);
      if (!tnome) continue;
      const tableBase = slugId(String(t.id ?? "").trim(), slugId(tnome, "t"));
      let tid = tableBase;
      let m = 2;
      while (usedTable.has(tid)) tid = `${tableBase}-${m++}`;
      usedTable.add(tid);
      const posti = Number(t.posti);
      // Notes: accept an array, fold a legacy single `nota` string, trim, drop
      // empties, cap each at 120 chars and the list at 5 bubbles.
      const rawNotes = Array.isArray(t.note) ? t.note : t.nota != null ? [t.nota] : [];
      const note = rawNotes
        .map((x) => String(x ?? "").trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 5);
      // Shape: only the non-default values are persisted (unset ⇒ rounded square).
      const formaRaw = String(t.forma ?? "");
      const forma = formaRaw === "rotondo" || formaRaw === "rettangolare" ? formaRaw : undefined;
      tavoli.push({
        id: tid,
        nome: tnome,
        x: clamp(t.x),
        y: clamp(t.y),
        ...(Number.isInteger(posti) && posti > 0 && posti <= 50 ? { posti } : {}),
        ...(note.length ? { note } : {}),
        ...(forma ? { forma } : {}),
      });
      if (tavoli.length >= 100) break;
    }
    out.push({ id, nome, tavoli });
    if (out.length >= 20) break;
  }
  return out;
}

/** Resolve the effective customer-note prompt for an item: its own `nota` wins
 *  (when active) over a category-level rule; null if no note applies. */
export function effectiveNota(
  item: { categoria: string; nota?: ItemNota | null },
  noteConfig?: NoteConfig[],
): { label: string; obbligatoria: boolean } | null {
  if (item.nota?.attiva)
    return { label: item.nota.label?.trim() || "Nota", obbligatoria: Boolean(item.nota.obbligatoria) };
  const rule = (noteConfig ?? []).find((c) => c.categorie.includes(item.categoria));
  if (rule) return { label: rule.label?.trim() || "Nota", obbligatoria: Boolean(rule.obbligatoria) };
  return null;
}

/** Whitelist a composition config (groups of ingredients). With
 *  `requireCategorie` (the default) a group must target ≥1 category — used for
 *  the per-category restaurant config. For per-item composition pass
 *  `{ requireCategorie: false }`: the item itself is the scope, so `categorie`
 *  is forced empty and not required. */
export function sanitizeComposizione(
  raw: unknown,
  { requireCategorie = true }: { requireCategorie?: boolean } = {},
): ComposizioneGruppo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<ComposizioneGruppo>;
      const ingredienti = Array.isArray(o.ingredienti)
        ? o.ingredienti
            .slice(0, 30)
            .map((s) => {
              const sc = (s ?? {}) as Partial<ComposizioneScelta>;
              const out: ComposizioneScelta = {
                ingredient_id: String(sc.ingredient_id ?? "").trim().slice(0, 40),
              };
              if (sc.prezzo != null && Number.isFinite(Number(sc.prezzo)))
                out.prezzo = Math.max(0, Math.round(Number(sc.prezzo) * 100) / 100);
              return out;
            })
            .filter((s) => s.ingredient_id)
        : [];
      const categorie = requireCategorie && Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      const max = Math.max(1, Math.floor(Number(o.max) || 1));
      const min = Math.min(max, Math.max(0, Math.floor(Number(o.min) || 0)));
      return {
        id: String(o.id ?? `c${gi}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        categorie,
        min,
        max,
        ingredienti,
      };
    })
    .filter((g) => g.nome && (requireCategorie ? g.categorie.length : true) && g.ingredienti.length);
}

/** Sanitize size variants. Caps counts and shapes the per-group max map.
 *  With `requireCategorie` (default) a size must target ≥1 category (per-category
 *  config). For per-item sizes pass `{ requireCategorie: false }`: `categorie` is
 *  forced empty and only a name is required. */
export function sanitizeTaglie(
  raw: unknown,
  { requireCategorie = true }: { requireCategorie?: boolean } = {},
): TagliaComposizione[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((t, ti) => {
      const o = (t ?? {}) as Partial<TagliaComposizione>;
      const categorie = requireCategorie && Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      const max: Record<string, number> = {};
      if (o.max && typeof o.max === "object") {
        for (const [k, v] of Object.entries(o.max).slice(0, 30)) {
          const n = Math.floor(Number(v));
          if (Number.isFinite(n) && n >= 0) max[String(k).slice(0, 40)] = Math.min(99, n);
        }
      }
      return {
        id: String(o.id ?? `t${ti}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        categorie,
        max,
        prezzo: Math.max(0, Math.round((Number(o.prezzo) || 0) * 100) / 100),
      };
    })
    .filter((t) => t.nome && (requireCategorie ? t.categorie.length : true));
}
