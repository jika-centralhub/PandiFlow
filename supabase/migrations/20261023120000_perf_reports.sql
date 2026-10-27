-- =====================================================================
--  Pandi — mesures du compteur de performance caché (js/lib/perf.js, allumé avec ?perf)
--  Une ligne par lancement de l'app sur un appareil, mise à jour pendant la session :
--  démarrage, images par seconde, temps des taps, coût de la 3D, appareil. Jamais de donnée d'enfant.
--  Envoi : supabase db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/migrations/20261023120000_perf_reports.sql
-- =====================================================================

create table if not exists public.perf_reports (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  app_version text not null,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  report jsonb not null check (pg_column_size(report) < 200000)
);
create index if not exists perf_reports_family_idx on public.perf_reports (family_id, started_at);

alter table public.perf_reports enable row level security;

drop policy if exists "mesures : lecture" on public.perf_reports;
create policy "mesures : lecture" on public.perf_reports for select to authenticated using (public.is_family_member(family_id));
drop policy if exists "mesures : ajout" on public.perf_reports;
create policy "mesures : ajout" on public.perf_reports for insert to authenticated
  with check (public.is_family_member(family_id) and user_id = auth.uid());
drop policy if exists "mesures : mise à jour" on public.perf_reports;
create policy "mesures : mise à jour" on public.perf_reports for update to authenticated
  using (user_id = auth.uid()) with check (public.is_family_member(family_id) and user_id = auth.uid());
