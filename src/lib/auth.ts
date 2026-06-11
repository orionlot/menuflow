import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/env";
import type { Restaurant } from "@/types/db";
import type { User } from "@supabase/supabase-js";

export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export function isAdmin(user: User | null): boolean {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
}

/** The restaurant owned by the current user (RLS-scoped). Null if none. */
export async function getOwnedRestaurant(): Promise<Restaurant | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  return (data as Restaurant) ?? null;
}

/** Guard for the dashboard: requires a logged-in restaurateur. */
export async function requireOwner(): Promise<{
  user: User;
  restaurant: Restaurant;
}> {
  const user = await getUser();
  if (!user) redirect("/dashboard/login");
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) redirect("/dashboard/login?norestaurant=1");
  return { user, restaurant };
}

/** Guard for the admin area. */
export async function requireAdmin(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if (!isAdmin(user)) redirect("/admin/login?forbidden=1");
  return user;
}
