-- Telegram forum Topics: each restaurant uses ONE forum group with two topics
-- ("Ordini" and "Pagamenti"). The two global bots post to the same group but to
-- different topics via message_thread_id. These columns hold those thread ids.
-- (If a restaurant uses two separate groups instead, leave the topic ids null
--  and just set different telegram_chat_* group ids.)
alter table public.restaurants
  add column if not exists telegram_topic_ordini    int,
  add column if not exists telegram_topic_pagamenti  int;
