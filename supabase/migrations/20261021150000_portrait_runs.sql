-- =====================================================================
--  Pandi — journal des créations de visages 3D (Edge Function make-portrait)
--  Une ligne par visage demandé : réussite, durée, modèle, chemin (photo ou description)
--  et message d'erreur d'OpenAI. Jamais d'image. Invisible depuis l'app (service uniquement).
--  Envoi : supabase db query --linked --file supabase/migrations/20261021150000_portrait_runs.sql
-- =====================================================================

create table if not exists public.portrait_runs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  expr text not null,
  ok boolean not null,
  ms int,
  model text,
  via text,
  detail text
);

alter table public.portrait_runs enable row level security;
revoke all on public.portrait_runs from anon, authenticated;
