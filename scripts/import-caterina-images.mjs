/**
 * Import product photos from caterinasalaconsilina.com into a venue's menu.
 *
 * Scrapes the public menu page, matches each photo to a menu item by name,
 * downloads it, optimizes it (resize ≤1000px → webp via sharp), uploads it to
 * Supabase Storage and sets menu_items.foto_url. Run against any DB by pointing
 * the env at it (local or production):
 *
 *   node --env-file=.env.local scripts/import-caterina-images.mjs <slug> [--dry]
 *
 * Flags:
 *   --dry        Print the name→image matches without downloading/uploading.
 *   --force      Overwrite photos even if a product already has a foto_url.
 *   --url=<u>    Override the source page (default the Caterina list page).
 *
 * Idempotent: re-running re-uploads to the same storage path (upsert).
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "menu-photos";
const DEFAULT_SOURCE = "https://www.caterinasalaconsilina.com/list/";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const dry = args.includes("--dry");
const force = args.includes("--force");
const sourceUrl = (args.find((a) => a.startsWith("--url=")) || `--url=${DEFAULT_SOURCE}`).slice(6);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!slug || !url || !serviceKey) {
  console.error(
    "Usage: node --env-file=.env.local scripts/import-caterina-images.mjs <slug> [--dry] [--force]\n" +
      "Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Normalize a product/photo name for fuzzy matching. */
function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Strip a WordPress "-WIDTHxHEIGHT" thumbnail suffix to get the full image. */
function fullRes(u) {
  return u.replace(/-\d+x\d+(\.(?:webp|jpe?g|png))(?=$|\?)/i, "$1");
}

/** Parse <img> tags from the page → [{ url, alt }] (de-duped, full-res). */
function parseImages(html) {
  const out = [];
  const seen = new Set();
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const alt = (/\balt\s*=\s*"([^"]*)"/i.exec(tag) || [])[1] || "";
    // candidate sources: src, data-src, data-lazy-src
    const srcs = [];
    for (const attr of ["data-src", "data-lazy-src", "src"]) {
      const v = (new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, "i").exec(tag) || [])[1];
      if (v) srcs.push(v);
    }
    const photo = srcs.find((s) => /wp-content\/uploads\/[^"]+\.(?:webp|jpe?g|png)/i.test(s));
    if (!photo) continue;
    const full = fullRes(photo.startsWith("http") ? photo : new URL(photo, sourceUrl).href);
    if (seen.has(full)) continue;
    seen.add(full);
    // filename slug (without size suffix/extension) as a fallback match key
    const file = norm(decodeURIComponent(full.split("/").pop() || "").replace(/\.[a-z]+$/i, ""));
    out.push({ url: full, alt: norm(alt), file });
  }
  return out;
}

/** A substring match only counts when the shorter string is specific enough
 *  (≥6 chars), so a generic banner alt/file like "pizza" can't claim every
 *  product whose name contains it. */
function subMatch(a, b) {
  if (!a || !b) return false;
  return (a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 6;
}

/** Best UNUSED image for a product name; null if nothing is close enough. */
function matchImage(name, images, used) {
  const n = norm(name);
  if (!n) return null;
  let best = null;
  let bestScore = 0;
  for (const img of images) {
    if (used.has(img.url)) continue;
    let score = 0;
    if (img.alt && img.alt === n) score = 100;
    else if (subMatch(img.alt, n)) score = 85;
    else if (img.file === n) score = 80;
    else if (subMatch(img.file, n)) score = 70;
    else {
      // word-overlap fallback: ignore connectives, count a hit when a name word
      // equals OR is a prefix of a candidate word (cacio → caciocavallo).
      const stop = new Set(["alla", "alle", "allo", "con", "del", "della", "delle", "dei", "di", "in", "la", "il", "lo", "le", "gli"]);
      const nw = n.split(" ").filter((w) => w.length > 2 && !stop.has(w));
      const fw = (img.alt || img.file || "").split(" ").filter((w) => w.length > 2 && !stop.has(w));
      const hit = nw.filter((w) =>
        fw.some((f) => f === w || (w.length >= 4 && f.length >= 4 && (f.startsWith(w) || w.startsWith(f)))),
      ).length;
      if (hit && nw.length) score = Math.round((hit / nw.length) * 70);
    }
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }
  return bestScore >= 50 ? { ...best, score: bestScore } : null;
}

async function run() {
  // 1) Resolve the venue + its items.
  const { data: rest, error: rErr } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!rest) {
    console.error(`Locale "${slug}" non trovato su questo DB.`);
    process.exit(1);
  }
  const { data: items, error: iErr } = await admin
    .from("menu_items")
    .select("id, nome, foto_url")
    .eq("restaurant_id", rest.id);
  if (iErr) throw iErr;

  // 2) Fetch + parse the source page.
  const res = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0 MenuFlow-import" } });
  if (!res.ok) throw new Error(`Fetch ${sourceUrl} → ${res.status}`);
  const html = await res.text();
  const images = parseImages(html);
  console.log(`Sorgente: ${images.length} immagini trovate · ${items.length} prodotti nel menu\n`);

  let matched = 0,
    uploaded = 0,
    skipped = 0;
  const unmatched = [];
  const used = new Set(); // each source image is assigned to at most one product

  for (const it of items) {
    const hit = matchImage(it.nome, images, used);
    if (!hit) {
      unmatched.push(it.nome);
      continue;
    }
    used.add(hit.url);
    matched++;
    if (it.foto_url && !force) {
      console.log(`• ${it.nome} → già con foto (usa --force per sovrascrivere)`);
      skipped++;
      continue;
    }
    console.log(`✓ ${it.nome}  ←  ${hit.url}  [${hit.score}]`);
    if (dry) continue;

    try {
      const imgRes = await fetch(hit.url, { headers: { "user-agent": "Mozilla/5.0 MenuFlow-import" } });
      const srcBuf = imgRes.ok
        ? Buffer.from(await imgRes.arrayBuffer())
        : null;
      if (!srcBuf) throw new Error(`download ${imgRes.status}`);
      const webp = await sharp(srcBuf)
        .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const path = `${rest.id}/item-${it.id}.webp`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, webp, { contentType: "image/webp", upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      const { error: updErr } = await admin
        .from("menu_items")
        .update({ foto_url: pub.publicUrl })
        .eq("id", it.id);
      if (updErr) throw updErr;
      uploaded++;
    } catch (e) {
      console.log(`  ⚠ ${it.nome}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(
    `\n${dry ? "[DRY] " : ""}Match: ${matched}/${items.length} · caricate: ${uploaded} · saltate: ${skipped}`,
  );
  if (unmatched.length)
    console.log(`Senza immagine (${unmatched.length}): ${unmatched.join(", ")}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
