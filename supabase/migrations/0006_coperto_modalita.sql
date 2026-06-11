-- Coperto configurabile per ristorante.
--  coperto_modalita: 'nessuno' | 'persona' | 'ordine' | 'servizio'
--  coperto: importo (€ a persona / € a ordine) oppure percentuale (servizio)
--  coperto_label: etichetta mostrata (es. "Coperto", "Pane e coperto", "Servizio")
alter table public.restaurants
  add column if not exists coperto_modalita text not null default 'nessuno',
  add column if not exists coperto_label    text not null default 'Coperto';

-- Importo coperto effettivamente applicato a un ordine (per ricevuta/Ordini).
alter table public.orders
  add column if not exists coperto_tot numeric(8,2) not null default 0;

-- Migrazione dati esistenti: chi aveva un importo > 0 passa a "per persona".
update public.restaurants
  set coperto_modalita = 'persona'
  where coperto > 0 and coperto_modalita = 'nessuno';

-- Demo: il bar non fa pagare il coperto (mostra il caso "nessuno").
update public.restaurants
  set coperto_modalita = 'nessuno', coperto = 0
  where slug = 'bar-luna';
