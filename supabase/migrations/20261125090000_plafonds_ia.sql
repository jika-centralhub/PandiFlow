-- =====================================================================
--  Pandi — plafonds des appels aux IA (audit de sécurité du 25/11/2026)
--  Avant : une limite par enfant seulement, et des enfants en nombre illimité. Un compte pouvait
--  donc créer des dizaines d'enfants pour générer des images OpenAI sans fin, et la relecture des
--  repères (make-portrait, marksOnly) appelait Claude sans aucune limite.
--  Maintenant, chaque appel payant réserve sa place dans trois limites du jour : par enfant, par
--  famille et pour toute l'app (garde-fou contre une vague de comptes), et une famille a au plus
--  10 enfants (archivés compris, sinon archiver puis recréer contournerait la limite).
--  À envoyer AVANT de redéployer make-portrait et analyze-photo (elles appellent take_ai_quota).
--  Les limites elles-mêmes sont dans les Edge Functions.
--  Envoi : supabase db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/migrations/20261125090000_plafonds_ia.sql
-- =====================================================================

-- Relectures des repères par Claude (make-portrait, marksOnly)
alter table public.photo_analyses add column if not exists marks int not null default 0;

-- Compteurs du jour pour toute l'app, écrits uniquement par les Edge Functions
create table if not exists public.ai_usage_days (
  day date primary key,
  images int not null default 0,
  count int not null default 0,
  marks int not null default 0
);
alter table public.ai_usage_days enable row level security;
revoke all on public.ai_usage_days from anon, authenticated;

-- Réserve un appel. p_kind : 'images' (OpenAI), 'count' (analyse photo par Claude), 'marks' (repères).
-- Renvoie null si c'est accordé, sinon la limite atteinte : 'enfant', 'famille' ou 'app'.
create or replace function public.take_ai_quota(p_child uuid, p_family uuid, p_kind text, p_child_limit int, p_family_limit int, p_app_limit int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n_child int;
  n_family int;
  n_app int;
begin
  if p_kind not in ('images', 'count', 'marks') then
    raise exception 'Type de quota inconnu : %', p_kind;
  end if;
  -- Une famille à la fois : deux enfants de la même famille ne passent pas ensemble sous la limite
  perform pg_advisory_xact_lock(hashtext('pandi-quota:' || p_family::text));

  execute format('select coalesce(sum(%1$I), 0) from public.photo_analyses where family_id = $1 and day = current_date', p_kind)
    into n_family using p_family;
  if n_family >= p_family_limit then return 'famille'; end if;

  execute format('select coalesce(max(%1$I), 0) from public.photo_analyses where child_id = $1 and day = current_date', p_kind)
    into n_child using p_child;
  if n_child >= p_child_limit then return 'enfant'; end if;

  execute format('insert into public.ai_usage_days as a (day, %1$I) values (current_date, 1)
    on conflict (day) do update set %1$I = a.%1$I + 1 returning a.%1$I', p_kind)
    into n_app;
  if n_app > p_app_limit then
    execute format('update public.ai_usage_days set %1$I = %1$I - 1 where day = current_date', p_kind);
    return 'app';
  end if;

  execute format('insert into public.photo_analyses as p (child_id, family_id, day, %1$I) values ($1, $2, current_date, 1)
    on conflict (child_id, day) do update set %1$I = p.%1$I + 1', p_kind)
    using p_child, p_family;
  return null;
end $$;

-- Rend l'appel réservé quand il a échoué
create or replace function public.refund_ai_quota(p_child uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('images', 'count', 'marks') then
    raise exception 'Type de quota inconnu : %', p_kind;
  end if;
  execute format('update public.photo_analyses set %1$I = greatest(%1$I - 1, 0) where child_id = $1 and day = current_date', p_kind) using p_child;
  execute format('update public.ai_usage_days set %1$I = greatest(%1$I - 1, 0) where day = current_date', p_kind);
end $$;

revoke all on function public.take_ai_quota(uuid, uuid, text, int, int, int) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.take_ai_quota(uuid, uuid, text, int, int, int) to service_role;
grant execute on function public.refund_ai_quota(uuid, text) to service_role;

-- Les anciennes fonctions de quota (remplacées par les deux ci-dessus)
drop function if exists public.take_portrait_quota(uuid, uuid, int);
drop function if exists public.refund_portrait_quota(uuid);

-- Au plus 10 enfants par famille, archivés compris
create or replace function public.limit_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- L'app écrit par upsert : un enfant déjà là n'est qu'une mise à jour, il ne compte pas
  if exists (select 1 from public.children where id = new.id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('pandi-enfants:' || new.family_id::text));
  if (select count(*) from public.children where family_id = new.family_id) >= 10 then
    raise exception 'Une famille compte au plus 10 enfants.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.limit_children() from public, anon, authenticated;

drop trigger if exists children_limit on public.children;
create trigger children_limit before insert on public.children for each row execute function public.limit_children();
