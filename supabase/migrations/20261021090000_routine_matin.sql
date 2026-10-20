-- =====================================================================
--  PandiFlow — routine du matin (réveil et départ à l'école)
--  Chaque tâche appartient à une routine : 'soir' (toutes les tâches existantes) ou 'matin'.
--  L'heure de départ à l'école est rangée dans families.settings (aucune colonne à ajouter).
--  Envoi : supabase db query --linked --file supabase/migrations/20261021090000_routine_matin.sql
-- =====================================================================

alter table public.tasks add column if not exists routine text not null default 'soir';

do $$
begin
  alter table public.tasks add constraint tasks_routine_check check (routine in ('soir', 'matin'));
exception when duplicate_object then null;
end $$;
