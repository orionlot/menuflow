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

  // Allow-list image types by MIME. Reject SVG (can carry inline script and this
  // lands in a public bucket) and anything non-raster.
  const ALLOWED_TYPES = new Map<string, string>([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
  ]);
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(mime))
    throw new Error("Formato non supportato: usa PNG, JPG o WEBP.");

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

  // Extension derived from the validated MIME (not the attacker-controlled filename).
  const ext = ALLOWED_TYPES.get(mime)!;
  const path = `${restaurantId}/${kind}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      upsert: true,
      // Filenames are immutable (timestamp + random), so cache hard for a year.
      cacheControl: "31536000",
    });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
