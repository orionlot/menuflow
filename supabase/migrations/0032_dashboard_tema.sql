-- Dashboard (restaurateur back-office) theme, independent of the public menu's
-- `tema`. null/'light' = light, 'dark' = dark.
alter table public.restaurants
  add column if not exists dashboard_tema text;
