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
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'pizzeria-mario', 'Pizzeria da Mario',
   'Forno a legna dal 1987', '#c8453b', 'light', 'base', false, '{it}', false,
   null, true)
on conflict (id) do nothing;

insert into public.menu_items (restaurant_id, categoria, nome, descrizione, prezzo, disponibile, ordine) values
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Antipasti', 'Bruschette al pomodoro', 'Pane casereccio, pomodoro fresco, basilico', 5.50, true, 1),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Antipasti', 'Tagliere misto', 'Salumi e formaggi del territorio', 12.00, true, 2),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Pizze', 'Margherita', 'Pomodoro, mozzarella, basilico', 7.00, true, 1),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Pizze', 'Diavola', 'Pomodoro, mozzarella, salame piccante', 9.00, true, 2),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Pizze', 'Quattro Formaggi', 'Mozzarella, gorgonzola, fontina, parmigiano', 10.00, true, 3),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Bevande', 'Acqua naturale 0,5L', null, 1.50, true, 1),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Bevande', 'Coca-Cola', null, 3.00, true, 2),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Bevande', 'Birra artigianale', 'Bionda alla spina', 5.00, false, 3),
  ('700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Dolci', 'Tiramisù della casa', null, 5.00, true, 1);

-- ── Restaurant 2: Bar Luna — plus plan, payments ON, multilingua (it/en) ──
insert into public.restaurants
  (id, slug, nome, sottotitolo, colore_primario, tema, piano, multilingua, lingue,
   pagamenti_attivi, telegram_chat_ordini, telegram_chat_pagamenti, attivo)
values
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'bar-luna', 'Bar Luna',
   'Cocktail & Vini', '#caa45d', 'dark', 'plus', true, '{it,en}', true,
   null, null, true)
on conflict (id) do nothing;

insert into public.menu_items (restaurant_id, categoria, nome, nome_i18n, descrizione, descrizione_i18n, prezzo, disponibile, ordine) values
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'Caffetteria', 'Espresso', '{"en":"Espresso"}', 'Miscela arabica', '{"en":"Arabica blend"}', 1.20, true, 1),
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'Caffetteria', 'Cappuccino', '{"en":"Cappuccino"}', 'Latte montato a vapore', '{"en":"Steamed milk"}', 1.80, true, 2),
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'Aperitivi', 'Spritz', '{"en":"Spritz"}', 'Aperol, prosecco, soda', '{"en":"Aperol, prosecco, soda"}', 6.00, true, 1),
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'Aperitivi', 'Negroni', '{"en":"Negroni"}', 'Gin, vermouth, bitter', '{"en":"Gin, vermouth, bitter"}', 8.00, true, 2),
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'Panini', 'Toast prosciutto e formaggio', '{"en":"Ham & cheese toastie"}', null, null, 4.50, true, 1),
  ('804614bd-48e1-4f50-a431-bcedc5589042', 'Panini', 'Club sandwich', '{"en":"Club sandwich"}', 'Pollo, bacon, insalata', '{"en":"Chicken, bacon, lettuce"}', 7.50, false, 2);

-- Demo custom domain (admin display; not locally reachable without DNS/hosts).
insert into public.custom_domains (domain, restaurant_id)
values ('menu.barluna.it', '804614bd-48e1-4f50-a431-bcedc5589042')
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
  ('8abd81c1-e90d-413b-ac75-8e0acd84d425', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Riso sushi',        0,   null, 'porzione', 1),
  ('ddc5c518-cc01-42ca-928e-d2d38aa0f329', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Riso venere',       0.5, null, 'porzione', 2),
  ('f03ace0b-9d49-456a-980a-d890221775e8', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Tonno',             2,   3,    'porzione', 3),
  ('af8bdd67-c550-4083-9364-708cacf7feaa', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Salmone',           1.5, 6,    'porzione', 4),
  ('47723a14-65fc-4bf3-a226-46935bd0f137', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Tofu',              1,   null, 'porzione', 5),
  ('b65acabd-c5dc-4dc0-8236-0c485a4b127c', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Avocado',           1,   8,    'porzione', 6),
  ('f9233f98-9912-42a3-a683-81610f5a0752', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Edamame',           0,   null, 'porzione', 7),
  ('d35c4588-d332-4016-8afa-f02036b3ae18', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Mango',             0.5, 5,    'porzione', 8),
  ('016c7b50-3f26-4d30-a08e-beda5027e64a', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Salsa di soia',     0,   null, 'porzione', 9),
  ('f368ea8b-89b8-404c-a63a-015e8d60ecc9', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Maionese piccante', 0,   null, 'porzione', 10)
on conflict (id) do nothing;

insert into public.menu_items (id, restaurant_id, categoria, nome, descrizione, prezzo, disponibile, ordine, foto_url) values
  ('6cf7e0c3-23db-4c6f-a5c6-48f4013dfe8a', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Poke', 'Poke Bowl',
   'Crea la tua poke: scegli base, proteine, topping e salse', 9.50, true, 1,
   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80&auto=format&fit=crop')
on conflict (id) do nothing;

update public.restaurants set composizione = '[
  {"id":"g-base","nome":"Base","categorie":["Poke"],"min":1,"max":1,"ingredienti":[
    {"ingredient_id":"8abd81c1-e90d-413b-ac75-8e0acd84d425"},
    {"ingredient_id":"ddc5c518-cc01-42ca-928e-d2d38aa0f329"}]},
  {"id":"g-prot","nome":"Proteine","categorie":["Poke"],"min":1,"max":2,"ingredienti":[
    {"ingredient_id":"f03ace0b-9d49-456a-980a-d890221775e8"},
    {"ingredient_id":"af8bdd67-c550-4083-9364-708cacf7feaa"},
    {"ingredient_id":"47723a14-65fc-4bf3-a226-46935bd0f137"}]},
  {"id":"g-top","nome":"Topping","categorie":["Poke"],"min":0,"max":3,"ingredienti":[
    {"ingredient_id":"b65acabd-c5dc-4dc0-8236-0c485a4b127c"},
    {"ingredient_id":"f9233f98-9912-42a3-a683-81610f5a0752"},
    {"ingredient_id":"d35c4588-d332-4016-8afa-f02036b3ae18"}]},
  {"id":"g-salse","nome":"Salse","categorie":["Poke"],"min":0,"max":2,"ingredienti":[
    {"ingredient_id":"016c7b50-3f26-4d30-a08e-beda5027e64a"},
    {"ingredient_id":"f368ea8b-89b8-404c-a63a-015e8d60ecc9"}]}
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
  ('51fed758-8178-45d5-9c1c-15a9f35aacc1', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Pomodoro',   0, 40,   null, 21),
  ('552164b0-6a9a-4774-8df2-0cdcca13f8b3', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Mozzarella', 0, 30,   null, 22),
  ('adafc57b-d4da-4b8d-b582-d0f0b6649e81', '700df593-7de9-4ec8-8e5d-4164e6fdc68c', 'Basilico',   0, null, null, 23)
on conflict (id) do nothing;

update public.menu_items
  set ingredienti =
    '["51fed758-8178-45d5-9c1c-15a9f35aacc1","552164b0-6a9a-4774-8df2-0cdcca13f8b3","adafc57b-d4da-4b8d-b582-d0f0b6649e81"]'::jsonb
  where restaurant_id = '700df593-7de9-4ec8-8e5d-4164e6fdc68c' and nome = 'Margherita';

-- ───────────── Demo: scorte per-prodotto (anche prodotti semplici) ─────────────
-- "Scorte semplici" (menu_items.scorta): porzioni disponibili per prodotto, con
-- auto-esaurito a 0. È un add-on Plus; pizzeria-mario è sul piano base, quindi
-- come per i componibili lo abilitiamo via override admin + interruttore del
-- ristoratore. Diamo una scorta demo a un paio di prodotti semplici per renderla
-- provabile (gli altri restano illimitati / scorta null).
update public.restaurants
  set funzionalita = funzionalita || '{"scorte": true}'::jsonb,
      funzionalita_admin = funzionalita_admin || '{"scorte": true}'::jsonb
  where slug = 'pizzeria-mario';

update public.menu_items set scorta = 8
  where restaurant_id = '700df593-7de9-4ec8-8e5d-4164e6fdc68c' and nome = 'Tiramisù della casa';
update public.menu_items set scorta = 12
  where restaurant_id = '700df593-7de9-4ec8-8e5d-4164e6fdc68c' and nome = 'Diavola';
