-- =====================================================================
--  Pandi — comportement de fin de soirée et espace équipe
--  Nouveaux types d'écritures dans la cagnotte (ledger) :
--    behavior (comportement), team (défi d'équipe), help (coup de main),
--    gift (cadeau entre enfants), pot (dépôt dans la cagnotte commune),
--    potbuy (achat avec la cagnotte commune, ignoré dans la cagnotte de l'enfant)
--  Nouvelles origines d'objets : pot (cagnotte commune) et team (défi d'équipe).
--  Les réglages (seuils, bonus, trésor de la fratrie) sont dans families.settings.
--  Envoi : supabase db query --linked --file supabase/migrations/20261021110000_equipe_comportement.sql
-- =====================================================================

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('perfect', 'purchase', 'manual', 'challenge', 'behavior', 'team', 'help', 'gift', 'pot', 'potbuy'));

alter table public.owned_items drop constraint if exists owned_items_source_check;
alter table public.owned_items add constraint owned_items_source_check
  check (source in ('shop', 'challenge', 'gift', 'pot', 'team'));
