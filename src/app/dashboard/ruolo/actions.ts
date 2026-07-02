"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { homeForRole, parseRuolo, RUOLO_COOKIE, RUOLO_COOKIE_MAX_AGE } from "@/lib/ruoli";

/** Persist the device role (All view / Cameriere / Cuoco) in an httpOnly
 *  cookie, then land on that role's home. Focus filter, not security. */
export async function setRuolo(formData: FormData) {
  await requireOwner();
  const ruolo = parseRuolo(formData.get("ruolo"));
  if (!ruolo) throw new Error("Ruolo non valido.");
  (await cookies()).set(RUOLO_COOKIE, ruolo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RUOLO_COOKIE_MAX_AGE,
  });
  redirect(homeForRole(ruolo));
}
