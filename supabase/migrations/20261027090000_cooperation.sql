-- =====================================================================
--  Pandi — la note de coopération et la carte d'équipe du soir
--  ratings.color : nouvelle valeur « pause » (⏸️ pas ce soir : une crise, un moment difficile,
--    0 pandi, la tâche ne compte ni pour ni contre l'équipe). green / orange / red restent les
--    valeurs de 🌟 du premier coup / 👍 après un rappel / ✋ il a fallu répéter.
--  ledger.kind : nouveau type « teamcard » (carte d'équipe de fin de soirée, la même pour tous :
--    versée dans la cagnotte commune, ignorée dans la cagnotte de l'enfant qui porte la ligne).
--  Les anciennes lignes « behavior » (comportement individuel) et « perfect » (soirée parfaite)
--    restent : les pandi déjà gagnés ne changent pas.
--  Envoi : supabase db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/migrations/20261027090000_cooperation.sql
-- =====================================================================

alter table public.ratings drop constraint if exists ratings_color_check;
alter table public.ratings add constraint ratings_color_check
  check (color in ('green', 'orange', 'red', 'pause'));

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check (kind in ('perfect', 'purchase', 'manual', 'challenge', 'behavior', 'team', 'help', 'gift', 'pot', 'potbuy', 'tsedaka', 'tsedakapaid', 'teamcard'));
