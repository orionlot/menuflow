"use server";

import { getUser, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";

/**
 * Single upload entry point for logos and product photos. Works for BOTH the
 * restaurateur (must own the restaurant) and the admin (any restaurant). Writes
 * with the service role to `<restaurantId>/<kind>-...` so storage stays
 * tenant-scoped, and client-side direct writes are disabled (migration 0005).
 */
export async function uploadImage(
  formData: FormData,
): Promise<{ url: string }> {
  const user = await getUser();
  if (!user) throw new Error("Non autenticato.");

  const restaurantId = String(formData.get("restaurantId") || "");
  const kind = (String(formData.get("kind") || "img").match(/[a-z]+/i)?.[0] || "img").toLowerCase();
  const file = formData.get("file");
  if (!restaurantId) throw new Error("Ristorante mancante.");
  if (!(file instanceof File) || file.size === 0) throw new Error("File mancante.");
  if (file.size > 6 * 1024 * 1024) throw new Error("Immagine troppo grande (max 6MB).");

  // Reject SVG (can carry inline script and this lands in a PUBLIC bucket) and
  // anything that isn't a raster image. Accept the common raster types browsers
  // and phones produce — incl. iPhone HEIC/HEIF, GIF/AVIF/BMP/TIFF — by MIME, or
  // by filename extension when the browser sends an empty/odd type.
  const mime = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const RASTER_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "heic", "heif", "bmp", "tif", "tiff"]);
  const isSvg = mime === "image/svg+xml" || ext === "svg";
  const looksRaster = (mime.startsWith("image/") && !isSvg) || RASTER_EXT.has(ext);
  if (isSvg || !looksRaster)
    throw new Error("Formato non supportato: carica un'immagine (PNG, JPG, WEBP, HEIC…). Gli SVG non sono ammessi.");

  const admin = createAdminClient();

  // Authorize: admins can upload anywhere; owners only for their own restaurant.
  if (!isAdmin(user)) {
    const { data } = await admin
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Non autorizzato per questo ristorante.");
  }

  // Stored extension: the validated (non-SVG) filename extension, else a safe
  // default. Never an svg.
  const safeExt = RASTER_EXT.has(ext) ? (ext === "jpeg" ? "jpg" : ext) : "jpg";
  const path = `${restaurantId}/${kind}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      // Only ever serve a raster content-type, never image/svg+xml.
      contentType: mime.startsWith("image/") && !isSvg ? mime : "image/jpeg",
      upsert: true,
      // Filenames are immutable (timestamp + random), so cache hard for a year.
      cacheControl: "31536000",
    });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
