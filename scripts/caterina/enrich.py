#!/usr/bin/env python3
import json, uuid, hashlib, os

NS = uuid.uuid5(uuid.NAMESPACE_URL, "caterinasalaconsilina.com")
RID = str(uuid.uuid5(NS, "restaurant"))
def mid(cat, nome): return str(uuid.uuid5(NS, "item:" + cat + ":" + nome))
IMG = set(os.listdir("public/menu/caterina")) if os.path.isdir("public/menu/caterina") else set()

PHOTO = {
  "Uova e Bacon": "uova-bacon.webp",
  "Pancake Sciroppo d'Acero e Frutti di Bosco": "pancake-sciroppo-d_acero-frutti-bosco.webp",
  "Pancake Sciroppo d'Acero e Fragole": "pancake-sciroppo-acero-fragole.webp",
  "Pancake Cioccolato Bianco e Frutti di Bosco": "colazione-pancake-cioccolatobiancoefruttidibosco.webp",
  "Avocado Toast": "avocado-toast.webp", "Toast": "toast.webp", "French Toast": "colazione-frenchtoast.webp",
  "Cacio alla Piastra": "caciocavallo-piastra-img.jpg", "Classico|Antipasti": "classico.webp",
  "Polpette al Sugo": "secondi-polpette-al-sugo.webp", "Orecchiette al Pesto": "ristorante-orecchietteallarrabbiata.webp",
  "Pennette Gamberetti e Zucchine": "primi-fusilli-alla-siciliana-1.webp", "Cotoletta e Patatine": "Copia-di-milanese.webp",
  "Salmone alla Piastra": "salmone.png", "Tonno alla Piastra": "img-tuna-teriaki.png",
  "Caprese": "panino-caprese-1.webp", "Classico|Panini": "panino-classico-2.webp", "Mediterraneo": "panino-mediterraneo-2.webp",
  "Mediterrasia": "poke-meditterasia.webp", "Salmone Creamy": "salmone.png", "Fritto Gustoso": "poke-fritto-gustoso.webp",
  "Leggero": "poke-leggero.webp", "Tuna Teriaki": "img-tuna-teriaki.png", "Gambero Spicy": "gambero.png",
  "Componi la Tua Pokè": "Copia-di-bowl-1.webp",
}
CAT_FALLBACK = {
  "Colazione": "colazione-img.webp", "Antipasti": "antipasti-img.webp", "Primi": "primi-img.webp",
  "Secondi": "secondi-cat-img.webp", "Contorni": "contorni-img.webp", "Dolci": "dolci-img.webp",
  "Panini": "panini-img.webp", "Pokè": "componi-poke-img.webp",
  "Birre": "birre-cat-img.webp", "Cocktails": "cocktails-cat-img-1.webp", "Soft Drink": "soft-drinks-cat-img.webp",
}
def photo_url(cat, nome):
    f = PHOTO.get(nome + "|" + cat) or PHOTO.get(nome)
    if not (f and f in IMG):
        cf = CAT_FALLBACK.get(cat)
        f = cf if (cf and cf in IMG) else None
    return "/menu/caterina/" + f if f else None

REPARTO = {"Colazione":"cucina","Antipasti":"cucina","Primi":"cucina","Secondi":"rosticceria","Contorni":"cucina",
           "Dolci":"cucina","Panini":"rosticceria","Pokè":"pokeria","Birre":"bar","Cocktails":"bar","Soft Drink":"bar"}
TEMPO = {"Colazione":8,"Antipasti":8,"Primi":14,"Secondi":18,"Contorni":6,"Dolci":4,"Panini":6,"Pokè":9,
         "Birre":2,"Cocktails":4,"Soft Drink":2}
def scorta(nome):
    return 5 + int(hashlib.md5(nome.encode("utf-8")).hexdigest(), 16) % 21  # 5..25 deterministico

MEAT_FISH = ["pollo","bacon","prosciutto","guanciale","scottona","manzo","bovino","macinato","salmone","tonno","gamber","pesce","sgombro","acciug","speck","wurst"]
CONSIGLIATI = {"Mediterrasia","Tagliata di Bovino alla Piastra","Rigatoni alla Carbonara","Cacio alla Piastra"}
def labels(cat, nome, ingredienti, descr):
    text = (nome + " " + (descr or "") + " " + " ".join(i["nome"] for i in ingredienti)).lower()
    out = []
    if cat in ("Birre", "Cocktails"): out.append("Alcolico")
    elif cat == "Soft Drink": out.append("Analcolico")
    else:
        if "vegan" in nome.lower(): out.append("Vegano")
        elif not any(m in text for m in MEAT_FISH): out.append("Vegetariano")
        if ("piccant" in text or "spicy" in text): out.append("Piccante")
        if "crudo" in text and ("salmone" in text or "tonno" in text): out.append("Pesce crudo")
    if nome in CONSIGLIATI: out.append("Consigliato")
    return out[:2]

# ---- build item list: food (from nutrition data) + drinks ----
data = json.load(open("/tmp/caterina-nutri.json"))
items = []
for c in data["categories"]:
    for it in c["items"]:
        items.append({"cat": c["categoria"], "nome": it["nome"], "descr": it.get("descrizione",""), "ingredienti": it["ingredienti"]})
DRINKS = {
  "Birre": ["Becks alla spina 20cl","Stella Artois 33cl","Corona 33cl","Becks alla spina 40cl","Birra Cilentana Rossa 33cl"],
  "Cocktails": ["Campari Spritz","Select Spritz","Aperol Spritz","Americano","Hugo Spritz","Negroni","Margarita","Moscow Mule","Paloma","Pina Colada","Espresso Martini"],
  "Soft Drink": ["Acqua naturale 50cl","Acqua frizzante 50cl","Tonica","Coca-Cola","Fanta","Succo di frutta"],
}
for cat, names in DRINKS.items():
    for n in names:
        items.append({"cat": cat, "nome": n, "descr": "", "ingredienti": []})

def jb(o): return "'" + json.dumps(o, ensure_ascii=False).replace("'", "''") + "'::jsonb"
def q(s): return "null" if s is None else "'" + str(s).replace("'", "''") + "'"

REPARTI = [
  {"id":"cucina","nome":"Cucina","colore":"#d97706"},
  {"id":"rosticceria","nome":"Rosticceria","colore":"#dc2626"},
  {"id":"pokeria","nome":"Pokeria","colore":"#16a34a"},
  {"id":"bar","nome":"Bar","colore":"#2563eb"},
]
ETICHETTE_CAT = ["Consigliato","Vegetariano","Vegano","Piccante","Pesce crudo","Alcolico","Analcolico"]
FLAGS = {"etichette": True, "reparto": True, "scorte": True, "tempo_stimato": True, "attesa_stimata": True, "piatto_consigliato": True}

sql = []
sql.append("-- 0038: enrich the Caterina menu — reparti (Cucina/Bar/Rosticceria/Pokeria), etichette,")
sql.append("-- tempo di preparazione, scorte random (5-25), and a photo for EVERY product.")
sql.append("-- UPDATE migration (the rows already exist from 0037); idempotent; safe in prod.")
sql.append("")
sql.append("update public.restaurants set")
sql.append("  reparti = " + jb(REPARTI) + ",")
sql.append("  etichette = " + jb(ETICHETTE_CAT) + ",")
sql.append("  funzionalita = coalesce(funzionalita, '{}'::jsonb) || " + jb(FLAGS))
sql.append("where id = " + q(RID) + ";")
sql.append("")

n_with_photo = 0
for it in items:
    iid = mid(it["cat"], it["nome"])
    rep = REPARTO.get(it["cat"], "cucina")
    tempo = TEMPO.get(it["cat"], 10)
    sc = scorta(it["nome"])
    labs = labels(it["cat"], it["nome"], it["ingredienti"], it["descr"])
    foto = photo_url(it["cat"], it["nome"])
    if foto: n_with_photo += 1
    sql.append(
        "update public.menu_items set "
        + "reparto = " + q(rep) + ", "
        + "tempo_preparazione = " + str(tempo) + ", "
        + "scorta = " + str(sc) + ", "
        + "etichette = " + jb(labs) + ", "
        + "foto_url = coalesce(foto_url, " + q(foto) + ") "
        + "where id = " + q(iid) + ";"
    )
# Note: foto_url uses coalesce so a specific photo already set by 0037 is kept;
# only items WITHOUT a photo get the category fallback.

open("supabase/migrations/0038_caterina_enrich.sql", "w").write("\n".join(sql) + "\n")
print("items:", len(items), "| con foto (dopo enrich):", n_with_photo, "| reparti:", len(REPARTI), "| etichette catalog:", len(ETICHETTE_CAT))
print("wrote supabase/migrations/0038_caterina_enrich.sql")
