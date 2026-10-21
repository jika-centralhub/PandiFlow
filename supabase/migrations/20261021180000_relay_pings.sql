-- =====================================================================
--  PandiFlow — passage de pandiflow.com à www.pandiflow.com
--  Chaque connexion (un appareil d'un parent) laisse un signe ici dès que js/relais.js a écrit
--  le cookie qui fera suivre sa connexion vers www. On change l'adresse principale seulement
--  quand toutes les connexions actives ont signé : personne n'aura à se reconnecter.
--  Table provisoire : à supprimer une fois le https actif sur www.
--  Envoi : supabase db query --linked --file supabase/migrations/20261021180000_relay_pings.sql
-- =====================================================================

create table if not exists public.relay_pings (
  session_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  host text,
  at timestamptz not null default now()
);

alter table public.relay_pings enable row level security;
revoke all on public.relay_pings from anon, authenticated;
grant insert on public.relay_pings to authenticated;

drop policy if exists relay_pings_insert on public.relay_pings;
create policy relay_pings_insert on public.relay_pings
  for insert to authenticated with check (user_id = auth.uid() and session_id = (auth.jwt() ->> 'session_id')::uuid);
