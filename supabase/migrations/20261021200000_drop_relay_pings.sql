-- =====================================================================
--  Pandi — fin du passage à www.pandiflow.com
--  Le https est forcé sur www depuis le 21/10/2026 : la table provisoire relay_pings
--  (20261021180000_relay_pings.sql) ne sert plus.
--  Envoi : supabase db query --linked --file supabase/migrations/20261021200000_drop_relay_pings.sql
-- =====================================================================

drop table if exists public.relay_pings;
