-- =====================================================================
--  PandiFlow — sexe de l'enfant et tsedaka
--  children.sex : 'garcon' | 'fille' | null (non précisé). Il accorde les textes, aide OpenAI pour
--    le personnage 3D et adapte la boutique (kippas et talit katan pour les garçons).
--  Nouveaux types d'écritures dans la cagnotte (ledger) :
--    tsedaka (pandi donnés par l'enfant, montant négatif, note = association choisie),
--    tsedakapaid (don versé par les parents : montant 0, id = 'tsedakapaid-' || id du don).
--  Le taux (pandi par euro) et la liste des associations sont dans families.settings.
--  Envoi : supabase db query --linked --file supabase/migrations/20261022090000_sexe_tsedaka.sql
-- =====================================================================

alter table public.children add column if not exists sex text;

do $$
begin
  alter table public.children add constraint children_sex_check check (sex in ('garcon', 'fille'));
exception when duplicate_object then null;
end $$;

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('perfect', 'purchase', 'manual', 'challenge', 'behavior', 'team', 'help', 'gift', 'pot', 'potbuy', 'tsedaka', 'tsedakapaid'));
