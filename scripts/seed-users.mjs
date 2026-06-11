/**
 * Seeds local auth users and links each restaurateur to their restaurant.
 * Run AFTER `supabase start` + `supabase db reset`:
 *
 *   node --env-file=.env.local scripts/seed-users.mjs
 *
 * Idempotent: re-running reuses existing users.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run with: node --env-file=.env.local scripts/seed-users.mjs",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return data.user;

  // Likely "already registered" — find the existing user.
  let page = 1;
  for (;;) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const found = list.users.find((u) => u.email === email);
    if (found) return found;
    if (list.users.length < 200) break;
    page += 1;
  }
  throw new Error(`Could not create or find user ${email}: ${error.message}`);
}

async function linkOwner(slug, userId) {
  const { error } = await admin
    .from("restaurants")
    .update({ owner_id: userId })
    .eq("slug", slug);
  if (error) throw error;
}

const accounts = [
  { email: "admin@menuflow.it", password: "menuflow-admin", slug: null },
  { email: "mario@pizzeria.it", password: "pizzeria-mario", slug: "pizzeria-mario" },
  { email: "luna@barluna.it", password: "bar-luna", slug: "bar-luna" },
];

for (const acc of accounts) {
  const user = await getOrCreateUser(acc.email, acc.password);
  if (acc.slug) {
    await linkOwner(acc.slug, user.id);
    console.log(`✓ ${acc.email} → owns "${acc.slug}"`);
  } else {
    console.log(`✓ ${acc.email} (admin)`);
  }
}

console.log("\nSeed users done.");
console.log("  Admin:  admin@menuflow.it / menuflow-admin");
console.log("  Mario:  mario@pizzeria.it / pizzeria-mario");
console.log("  Luna:   luna@barluna.it / bar-luna");
