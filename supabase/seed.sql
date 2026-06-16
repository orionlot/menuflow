-- Seed data for local development. owner_id is linked afterwards by
-- scripts/seed-users.mjs (which creates the auth users via the admin API).
-- telegram_chat_* are left null here on purpose: a fake chat id makes the bot
-- call Telegram and get "400 chat not found" (notifications silently fail).
-- seed-users.mjs fills them from TELEGRAM_CHAT_* in .env.local, so your real
-- chat ids survive a `db:reset`.

-- ── Restaurant 1: Pizzeria Mario — base plan, NO online payments (case A) ──
insert into public.restaurants
  (id, slug, nome, sottotitolo, colore_primario, tema, piano, multilingua, lingue,
   pagamenti_attivi, telegram_chat_ordini, attivo)
values
  ('11111111-1111-1111-1111-111111111111', 'pizzeria-mario', 'Pizzeria da Mario',
   'Forno a legna dal 1987', '#c8453b', 'light', 'base', false, '{it}', false,
   null, true)
on conflict (id) do nothing;

insert into public.menu_items (restaurant_id, categoria, nome, descrizione, prezzo, disponibile, ordine) values
  ('11111111-1111-1111-1111-111111111111', 'Antipasti', 'Bruschette al pomodoro', 'Pane casereccio, pomodoro fresco, basilico', 5.50, true, 1),
  ('11111111-1111-1111-1111-111111111111', 'Antipasti', 'Tagliere misto', 'Salumi e formaggi del territorio', 12.00, true, 2),
  ('11111111-1111-1111-1111-111111111111', 'Pizze', 'Margherita', 'Pomodoro, mozzarella, basilico', 7.00, true, 1),
  ('11111111-1111-1111-1111-111111111111', 'Pizze', 'Diavola', 'Pomodoro, mozzarella, salame piccante', 9.00, true, 2),
  ('11111111-1111-1111-1111-111111111111', 'Pizze', 'Quattro Formaggi', 'Mozzarella, gorgonzola, fontina, parmigiano', 10.00, true, 3),
  ('11111111-1111-1111-1111-111111111111', 'Bevande', 'Acqua naturale 0,5L', null, 1.50, true, 1),
  ('11111111-1111-1111-1111-111111111111', 'Bevande', 'Coca-Cola', null, 3.00, true, 2),
  ('11111111-1111-1111-1111-111111111111', 'Bevande', 'Birra artigianale', 'Bionda alla spina', 5.00, false, 3),
  ('11111111-1111-1111-1111-111111111111', 'Dolci', 'Tiramisù della casa', null, 5.00, true, 1);

-- ── Restaurant 2: Bar Luna — plus plan, payments ON, multilingua (it/en) ──
insert into public.restaurants
  (id, slug, nome, sottotitolo, colore_primario, tema, piano, multilingua, lingue,
   pagamenti_attivi, telegram_chat_ordini, telegram_chat_pagamenti, attivo)
values
  ('22222222-2222-2222-2222-222222222222', 'bar-luna', 'Bar Luna',
   'Cocktail & Vini', '#caa45d', 'dark', 'plus', true, '{it,en}', true,
   null, null, true)
on conflict (id) do nothing;

insert into public.menu_items (restaurant_id, categoria, nome, nome_i18n, descrizione, descrizione_i18n, prezzo, disponibile, ordine) values
  ('22222222-2222-2222-2222-222222222222', 'Caffetteria', 'Espresso', '{"en":"Espresso"}', 'Miscela arabica', '{"en":"Arabica blend"}', 1.20, true, 1),
  ('22222222-2222-2222-2222-222222222222', 'Caffetteria', 'Cappuccino', '{"en":"Cappuccino"}', 'Latte montato a vapore', '{"en":"Steamed milk"}', 1.80, true, 2),
  ('22222222-2222-2222-2222-222222222222', 'Aperitivi', 'Spritz', '{"en":"Spritz"}', 'Aperol, prosecco, soda', '{"en":"Aperol, prosecco, soda"}', 6.00, true, 1),
  ('22222222-2222-2222-2222-222222222222', 'Aperitivi', 'Negroni', '{"en":"Negroni"}', 'Gin, vermouth, bitter', '{"en":"Gin, vermouth, bitter"}', 8.00, true, 2),
  ('22222222-2222-2222-2222-222222222222', 'Panini', 'Toast prosciutto e formaggio', '{"en":"Ham & cheese toastie"}', null, null, 4.50, true, 1),
  ('22222222-2222-2222-2222-222222222222', 'Panini', 'Club sandwich', '{"en":"Club sandwich"}', 'Pollo, bacon, insalata', '{"en":"Chicken, bacon, lettuce"}', 7.50, false, 2);

-- Demo custom domain (admin display; not locally reachable without DNS/hosts).
insert into public.custom_domains (domain, restaurant_id)
values ('menu.barluna.it', '22222222-2222-2222-2222-222222222222')
on conflict (domain) do nothing;

-- ───────────── Demo: foto (Unsplash) + allergeni + opzioni + coperto/mancia ─────────────
do $$
declare img text := 'https://images.unsplash.com/photo-%s?w=600&q=80&auto=format&fit=crop';
begin
  -- Pizzeria
  update public.menu_items set foto_url=format(img,'1572695157366-5e585ab2b69f'), allergeni='{glutine}'        where nome='Bruschette al pomodoro';
  update public.menu_items set foto_url=format(img,'1631379578550-7038263db699'), allergeni='{latte}'          where nome='Tagliere misto';
  update public.menu_items set foto_url=format(img,'1513104890138-7c749659a591'), allergeni='{glutine,latte}',
    opzioni='[{"id":"impasto","nome":"Impasto","tipo":"single","obbligatorio":true,"scelte":[{"nome":"Classico","prezzo":0},{"nome":"Integrale","prezzo":1},{"nome":"Senza glutine","prezzo":2}]}]'
    where nome='Margherita';
  update public.menu_items set foto_url=format(img,'1628840042765-356cda07504e'), allergeni='{glutine,latte}'  where nome='Diavola';
  update public.menu_items set foto_url=format(img,'1565299624946-b28f40a0ae38'), allergeni='{glutine,latte}'  where nome='Quattro Formaggi';
  update public.menu_items set foto_url=format(img,'1559839734-2b71ea197ec2')                                  where nome='Acqua naturale 0,5L';
  update public.menu_items set foto_url=format(img,'1554866585-cd94860890b7')                                  where nome='Coca-Cola';
  update public.menu_items set foto_url=format(img,'1608270586620-248524c67de9'), allergeni='{glutine}'        where nome='Birra artigianale';
  update public.menu_items set foto_url=format(img,'1571877227200-a0d98ea607e9'), allergeni='{glutine,uova,latte}' where nome='Tiramisù della casa';
  -- Bar Luna
  update public.menu_items set foto_url=format(img,'1560512823-829485b8bf24'), allergeni='{solfiti}'           where nome='Spritz';
  update public.menu_items set foto_url=format(img,'1551024709-8f23befc6f87')                                  where nome='Negroni';
  update public.menu_items set foto_url=format(img,'1510707577719-ae7c14805e3a')                               where nome='Espresso';
  update public.menu_items set foto_url=format(img,'1572442388796-11668a67e53d'), allergeni='{latte}'          where nome='Cappuccino';
  update public.menu_items set foto_url=format(img,'1528735602780-2552fd46c7af'), allergeni='{glutine,latte}',
    opzioni='[{"id":"agg","nome":"Aggiunte","tipo":"multi","obbligatorio":false,"scelte":[{"nome":"Uovo","prezzo":1},{"nome":"Doppio formaggio","prezzo":1}]}]'
    where nome='Toast prosciutto e formaggio';
  update public.menu_items set foto_url=format(img,'1567234669003-dce7a7a88821'), allergeni='{glutine,uova,latte}' where nome='Club sandwich';

  update public.restaurants set coperto=1.50, coperto_modalita='persona', accetta_mancia=false where slug='pizzeria-mario';
  update public.restaurants set coperto=0,    coperto_modalita='nessuno', accetta_mancia=true  where slug='bar-luna';

  -- Demo: aggiunte di categoria (es. patatine su tutte le Pizze).
  update public.restaurants set aggiunte =
    '[{"id":"extra","nome":"Aggiunte","tipo":"multi","obbligatorio":false,"categorie":["Pizze"],"scelte":[{"nome":"Patatine fritte","prezzo":3},{"nome":"Bibita","prezzo":2.5}]}]'::jsonb
    where slug='pizzeria-mario';
end $$;

-- ───────────── Demo: prodotto componibile "Poke" (Pizzeria) ─────────────
-- "Componibili" è un add-on Plus; sul piano base lo abilitiamo via override admin
-- + interruttore del ristoratore, così la demo è subito provabile.
update public.restaurants
  set funzionalita = funzionalita || '{"componibili": true}'::jsonb,
      funzionalita_admin = funzionalita_admin || '{"componibili": true}'::jsonb
  where slug = 'pizzeria-mario';

insert into public.ingredients (id, restaurant_id, nome, prezzo, scorta, unita, ordine) values
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Riso sushi',        0,   null, 'porzione', 1),
  ('aaaa0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Riso venere',       0.5, null, 'porzione', 2),
  ('aaaa0001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Tonno',             2,   3,    'porzione', 3),
  ('aaaa0001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Salmone',           1.5, 6,    'porzione', 4),
  ('aaaa0001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Tofu',              1,   null, 'porzione', 5),
  ('aaaa0001-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Avocado',           1,   8,    'porzione', 6),
  ('aaaa0001-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Edamame',           0,   null, 'porzione', 7),
  ('aaaa0001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Mango',             0.5, 5,    'porzione', 8),
  ('aaaa0001-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Salsa di soia',     0,   null, 'porzione', 9),
  ('aaaa0001-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Maionese piccante', 0,   null, 'porzione', 10)
on conflict (id) do nothing;

insert into public.menu_items (id, restaurant_id, categoria, nome, descrizione, prezzo, disponibile, ordine, foto_url) values
  ('bbbb0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Poke', 'Poke Bowl',
   'Crea la tua poke: scegli base, proteine, topping e salse', 9.50, true, 1,
   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80&auto=format&fit=crop')
on conflict (id) do nothing;

update public.restaurants set composizione = '[
  {"id":"g-base","nome":"Base","categorie":["Poke"],"min":1,"max":1,"ingredienti":[
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000001"},
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000002"}]},
  {"id":"g-prot","nome":"Proteine","categorie":["Poke"],"min":1,"max":2,"ingredienti":[
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000003"},
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000004"},
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000005"}]},
  {"id":"g-top","nome":"Topping","categorie":["Poke"],"min":0,"max":3,"ingredienti":[
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000006"},
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000007"},
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000008"}]},
  {"id":"g-salse","nome":"Salse","categorie":["Poke"],"min":0,"max":2,"ingredienti":[
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000009"},
    {"ingredient_id":"aaaa0001-0000-0000-0000-000000000010"}]}
]'::jsonb
where slug = 'pizzeria-mario';

-- Sizes (Medium / Large) for the Poke: each caps the max selections per group
-- and may add a price surcharge on top of the item's base price (Large +3,00 €).
update public.restaurants set composizione_taglie = '[
  {"id":"taglia-medium","nome":"Medium","categorie":["Poke"],
   "max":{"g-base":1,"g-prot":1,"g-top":3,"g-salse":2},"prezzo":0},
  {"id":"taglia-large","nome":"Large","categorie":["Poke"],
   "max":{"g-base":1,"g-prot":2,"g-top":5,"g-salse":2},"prezzo":3}
]'::jsonb
where slug = 'pizzeria-mario';

-- ───────────── Demo: ingredienti per prodotti "semplici" + scorte ─────────────
-- I prodotti non componibili possono elencare i propri ingredienti: quelli con
-- scorta attiva vengono scalati automaticamente a ogni ordine (Pomodoro e
-- Mozzarella tracciati; Basilico illimitato per mostrare che gli ingredienti
-- senza scorta vengono ignorati). "ingredienti" è una funzione base: basta
-- l'interruttore del ristoratore.
update public.restaurants
  set funzionalita = funzionalita || '{"ingredienti": true}'::jsonb
  where slug = 'pizzeria-mario';

insert into public.ingredients (id, restaurant_id, nome, prezzo, scorta, unita, ordine) values
  ('cccc0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Pomodoro',   0, 40,   null, 21),
  ('cccc0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mozzarella', 0, 30,   null, 22),
  ('cccc0001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Basilico',   0, null, null, 23)
on conflict (id) do nothing;

update public.menu_items
  set ingredienti =
    '["cccc0001-0000-0000-0000-000000000001","cccc0001-0000-0000-0000-000000000002","cccc0001-0000-0000-0000-000000000003"]'::jsonb
  where restaurant_id = '11111111-1111-1111-1111-111111111111' and nome = 'Margherita';
