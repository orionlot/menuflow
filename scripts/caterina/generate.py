#!/usr/bin/env python3
import json, re, uuid, os

NS = uuid.uuid5(uuid.NAMESPACE_URL, "caterinasalaconsilina.com")
RID = str(uuid.uuid5(NS, "restaurant"))
def iid(canon): return str(uuid.uuid5(NS, "ing:" + canon))
def mid(cat, nome): return str(uuid.uuid5(NS, "item:" + cat + ":" + nome))

IMG_DIR = "public/menu/caterina"
have_img = set(os.listdir(IMG_DIR)) if os.path.isdir(IMG_DIR) else set()

# Final photo mapping (override workflow guesses; only map files we actually downloaded).
PHOTO = {
  "Uova e Bacon": "uova-bacon.webp",
  "Pancake Sciroppo d'Acero e Frutti di Bosco": "pancake-sciroppo-d_acero-frutti-bosco.webp",
  "Pancake Sciroppo d'Acero e Fragole": "pancake-sciroppo-acero-fragole.webp",
  "Pancake Cioccolato Bianco e Frutti di Bosco": "colazione-pancake-cioccolatobiancoefruttidibosco.webp",
  "Avocado Toast": "avocado-toast.webp",
  "Toast": "toast.webp",
  "French Toast": "colazione-frenchtoast.webp",
  "Cacio alla Piastra": "caciocavallo-piastra-img.jpg",
  "Classico|Antipasti": "classico.webp",
  "Polpette al Sugo": "secondi-polpette-al-sugo.webp",
  "Orecchiette al Pesto": "ristorante-orecchietteallarrabbiata.webp",
  "Pennette Gamberetti e Zucchine": "primi-fusilli-alla-siciliana-1.webp",
  "Cotoletta e Patatine": "Copia-di-milanese.webp",
  "Salmone alla Piastra": "salmone.png",
  "Tonno alla Piastra": "img-tuna-teriaki.png",
  "Caprese": "panino-caprese-1.webp",
  "Classico|Panini": "panino-classico-2.webp",
  "Mediterraneo": "panino-mediterraneo-2.webp",
  "Mediterrasia": "poke-meditterasia.webp",
  "Salmone Creamy": "salmone.png",
  "Fritto Gustoso": "poke-fritto-gustoso.webp",
  "Leggero": "poke-leggero.webp",
  "Tuna Teriaki": "img-tuna-teriaki.png",
  "Gambero Spicy": "gambero.png",
  "Componi la Tua Pokè": "Copia-di-bowl-1.webp",
}
def photo_for(cat, nome):
    f = PHOTO.get(nome + "|" + cat) or PHOTO.get(nome)
    if f and f in have_img:
        return "/menu/caterina/" + f
    return None

ALLOWED_ALLERGENI = {"glutine","crostacei","uova","pesce","arachidi","soia","latte","sedano","senape","sesamo","solfiti","lupini","molluschi","frutta_a_guscio"}

SYN = {
  "olio evo": "olio extravergine d'oliva",
  "olio extravergine d oliva": "olio extravergine d'oliva",
  "olio extravergine d'oliva": "olio extravergine d'oliva",
}
def canon(name):
    n = name.strip().lower()
    n = re.sub(r"\s*\(.*?\)\s*", " ", n).strip()
    n = re.sub(r"\s+", " ", n)
    return SYN.get(n, n)

data = json.load(open("/tmp/caterina-nutri.json"))
cats = data["categories"]

# ---- Build ingredient catalog (dedup by canon) ----
catalog = {}  # canon -> {id, nome, kcal, peso}
def reg_ing(nome, kcal, grammi):
    c = canon(nome)
    if c not in catalog:
        catalog[c] = {"id": iid(c), "nome": nome.strip(), "kcal": int(kcal), "peso": int(grammi)}
    return catalog[c]["id"]

COMPOSABLE = "Componi la Tua Pokè"
items = []  # built menu_items
for cat in cats:
    for it in cat["items"]:
        recipe = []
        for ing in it["ingredienti"]:
            i_id = reg_ing(ing["nome"], ing["kcal_per_100g"], ing["grammi"])
            recipe.append({"id": i_id, "grammi": int(ing["grammi"])})
        allerg = [a for a in it["allergeni"] if a in ALLOWED_ALLERGENI]
        composable = bool(it.get("composabile"))
        items.append({
            "id": mid(cat["categoria"], it["nome"]),
            "categoria": cat["categoria"],
            "nome": it["nome"],
            "descrizione": it.get("descrizione") or None,
            "prezzo": float(it["prezzo"]),
            "ordine": int(it["ordine"]),
            "foto_url": photo_for(cat["categoria"], it["nome"]),
            "allergeni": allerg,
            "ingredienti": recipe,
            # composable item: dynamic nutrition (no fixed override); fixed dishes: override = workflow totals
            "peso": None if composable else int(it["peso_g"]),
            "kcal": None if composable else int(it["kcal"]),
            "composizione": [] if not composable else None,  # filled below for composable
        })

# ---- Composable "Componi la Tua Pokè": groups referencing catalog ingredients ----
def ing_id_if(name):
    c = canon(name)
    return catalog[c]["id"] if c in catalog else None
GROUPS_SPEC = [
  ("Base", 1, 1, ["Riso basmati", "Riso sushi"]),
  ("Proteine", 1, 2, ["Pollo arrosto", "Salmone crudo", "Tonno crudo", "Gamberi", "Pollo fritto"]),
  ("Topping", 0, 3, ["Avocado", "Carote", "Pomodorini", "Zucchine grigliate", "Cetrioli"]),
  ("Salse", 0, 2, ["Salsa teriyaki", "Spicy mayo"]),
]
compo_groups = []
for gi, (gname, gmin, gmax, names) in enumerate(GROUPS_SPEC):
    ings = [{"ingredient_id": ing_id_if(n)} for n in names if ing_id_if(n)]
    if ings:
        compo_groups.append({"id": "g-" + str(gi), "nome": gname, "categorie": [], "min": gmin, "max": gmax, "ingredienti": ings})
for it in items:
    if it["composizione"] is None:
        it["composizione"] = compo_groups

# ---- Drinks (no nutrition) ----
DRINKS = [
  ("Birre", [("Becks alla spina 20cl",2.0),("Stella Artois 33cl",2.5),("Corona 33cl",3.0),("Becks alla spina 40cl",4.0),("Birra Cilentana Rossa 33cl",6.0)]),
  ("Cocktails", [("Campari Spritz",6.0),("Select Spritz",6.0),("Aperol Spritz",6.0),("Americano",6.0),("Hugo Spritz",7.0),("Negroni",7.0),("Margarita",9.0),("Moscow Mule",9.0),("Paloma",9.0),("Pina Colada",9.0),("Espresso Martini",9.0)]),
  ("Soft Drink", [("Acqua naturale 50cl",1.0),("Acqua frizzante 50cl",1.0),("Tonica",2.5),("Coca-Cola",3.0),("Fanta",3.0),("Succo di frutta",3.0)]),
]
for cat, lst in DRINKS:
    for o,(nome,prezzo) in enumerate(lst, start=1):
        items.append({"id": mid(cat, nome), "categoria": cat, "nome": nome, "descrizione": None,
                      "prezzo": float(prezzo), "ordine": o, "foto_url": None, "allergeni": [],
                      "ingredienti": [], "peso": None, "kcal": None, "composizione": []})

# ---------- SQL emit ----------
def q(s):
    if s is None: return "null"
    return "'" + str(s).replace("'", "''") + "'"
def jb(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"
def num(n):
    return "null" if n is None else str(n)

sql = []
sql.append("-- Caterina Sala Consilina — full menu seed (data migration).")
sql.append("-- Generated from caterinasalaconsilina.com: real dishes/prices/descriptions/photos;")
sql.append("-- calories + per-ingredient grams are realistic ESTIMATES (shown as '~stima' in the UI).")
sql.append("-- Idempotent (fixed UUIDs + on conflict do nothing). Photos live in public/menu/caterina/.")
sql.append("")
funz = {"peso": True, "kcal": True, "ingredienti": True, "componibili": True}
sql.append("insert into public.restaurants (id, slug, nome, sottotitolo, colore_primario, tema, piano, multilingua, lingue, pagamenti_attivi, attivo, funzionalita) values")
sql.append(f"  ({q(RID)}, {q('caterina-sala-consilina')}, {q('Caterina')}, {q('Sala Consilina')}, {q('#1f6f43')}, {q('light')}, {q('pro')}, false, '{{\"it\"}}'::text[], false, true, {jb(funz)})")
sql.append("on conflict (id) do nothing;")
sql.append("")
sql.append("insert into public.custom_domains (domain, restaurant_id) values")
sql.append(f"  ({q('caterinasalaconsilina.com')}, {q(RID)}),")
sql.append(f"  ({q('www.caterinasalaconsilina.com')}, {q(RID)})")
sql.append("on conflict (domain) do nothing;")
sql.append("")
# ingredients
sql.append("insert into public.ingredients (id, restaurant_id, nome, prezzo, scorta, unita, peso, kcal_per_100g, ordine) values")
rows = []
for o, c in enumerate(sorted(catalog.values(), key=lambda x: x["nome"].lower()), start=1):
    rows.append(f"  ({q(c['id'])}, {q(RID)}, {q(c['nome'])}, 0, null, 'porzione', {num(c['peso'])}, {num(c['kcal'])}, {o})")
sql.append(",\n".join(rows))
sql.append("on conflict (id) do nothing;")
sql.append("")
# menu_items
sql.append("insert into public.menu_items (id, restaurant_id, categoria, nome, descrizione, prezzo, disponibile, ordine, foto_url, allergeni, ingredienti, composizione, peso, kcal) values")
rows = []
for it in items:
    allerg_sql = "'{" + ",".join('"'+a+'"' for a in it["allergeni"]) + "}'::text[]" if it["allergeni"] else "'{}'::text[]"
    rows.append("  (" + ", ".join([
        q(it["id"]), q(RID), q(it["categoria"]), q(it["nome"]), q(it["descrizione"]),
        str(it["prezzo"]), "true", str(it["ordine"]), q(it["foto_url"]),
        allerg_sql, jb(it["ingredienti"]), jb(it["composizione"]),
        num(it["peso"]), num(it["kcal"]),
    ]) + ")")
sql.append(",\n".join(rows))
sql.append("on conflict (id) do nothing;")
sql.append("")

open("supabase/migrations/0037_caterina_menu.sql", "w").write("\n".join(sql))

# ---------- Import-tool JSON (export format; dish-level peso/kcal since the catalog can't travel) ----------
imp = {"version": 1, "restaurant": "caterina-sala-consilina", "items": []}
for it in items:
    imp["items"].append({
        "categoria": it["categoria"], "nome": it["nome"], "descrizione": it["descrizione"],
        "prezzo": it["prezzo"], "disponibile": True, "ordine": it["ordine"], "foto_url": it["foto_url"],
        "allergeni": it["allergeni"], "ingredienti": it["ingredienti"], "composizione": it["composizione"],
        "peso": it["peso"], "kcal": it["kcal"],
    })
os.makedirs("docs/caterina", exist_ok=True)
json.dump(imp, open("docs/caterina/caterina-import.json", "w"), ensure_ascii=False, indent=2)

print("restaurant_id:", RID)
print("ingredients in catalog:", len(catalog))
print("menu_items:", len(items), " (food:", sum(1 for i in items if i['ingredienti']), ")")
print("items with photo:", sum(1 for i in items if i["foto_url"]))
print("composable groups:", len(compo_groups))
print("wrote supabase/migrations/0037_caterina_menu.sql + docs/caterina/caterina-import.json")
