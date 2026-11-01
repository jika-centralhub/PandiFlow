-- =====================================================================
--  Pandi — la date de naissance et l'anniversaire de l'enfant
--  children.birthdate : la date de naissance (facultative pour les enfants déjà inscrits). L'âge en
--    est calculé ; la colonne age reste écrite par l'app (les anciennes versions et les statistiques
--    la lisent toujours).
--  ledger.kind : nouveau type « birthday » (les pandi offerts le soir de l'anniversaire, une ligne
--    par enfant et par an : id birthday-<enfant>-<année>, evening_date = le soir de la fête).
--  owned_items.source : nouvelle valeur « birthday » (le cadeau d'anniversaire, choisi dans tout le
--    catalogue ; distinct du cadeau d'entrée d'un thème, source « gift »).
--  Envoi : supabase db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/migrations/20261101090000_anniversaire.sql
-- =====================================================================

alter table public.children add column if not exists birthdate date;
alter table public.children drop constraint if exists children_birthdate_check;
alter table public.children add constraint children_birthdate_check
  check (birthdate between date '2000-01-01' and date '2100-01-01');

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('perfect', 'purchase', 'manual', 'challenge', 'behavior', 'team', 'help', 'gift', 'pot', 'potbuy', 'tsedaka', 'tsedakapaid', 'teamcard', 'birthday'));

alter table public.owned_items drop constraint if exists owned_items_source_check;
alter table public.owned_items add constraint owned_items_source_check
  check (source in ('shop', 'challenge', 'gift', 'pot', 'team', 'birthday'));
