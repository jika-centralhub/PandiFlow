-- =====================================================================
--  Pandi — invitations à usage unique et gestion des parents
--  Appliqué au projet existant avec :
--    supabase db query --linked --project-ref <ref> --file supabase/migrations/20261020120000_invitations.sql
--  (déjà inclus dans supabase/schema.sql pour une installation neuve)
-- =====================================================================

-- 1. Les parents : rôle (owner = créateur de la famille) et e-mail affiché aux autres parents
alter table public.family_members add column if not exists email text;
alter table public.family_members drop constraint if exists family_members_role_check;
update public.family_members set role = 'parent' where role not in ('owner', 'parent');
alter table public.family_members add constraint family_members_role_check check (role in ('owner', 'parent'));

-- 2. Fin du code d'invitation permanent : il est remplacé par des invitations à usage unique
alter table public.families drop column if exists invite_code;

-- 3. Invitations : un code de 8 caractères, valable 48 h, utilisable une seule fois
create table if not exists public.family_invites (
  code text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
create index if not exists family_invites_family_idx on public.family_invites (family_id);
alter table public.family_invites enable row level security;
drop policy if exists "invitations : lecture" on public.family_invites;
create policy "invitations : lecture" on public.family_invites for select to authenticated using (public.is_family_member(family_id));
revoke insert, update, delete on public.family_invites from anon, authenticated;

-- 4. Essais ratés de code d'invitation (anti-essais au hasard), invisibles depuis l'app
create table if not exists public.join_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, at);
alter table public.join_attempts enable row level security;
revoke all on public.join_attempts from anon, authenticated;

-- 5. Fonctions
drop function if exists public.new_invite_code();
drop function if exists public.join_family(text);

create or replace function public.new_invite_code(p_len int default 8)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  bytes bytea;
  i int;
begin
  loop
    bytes := gen_random_bytes(p_len);
    v_code := '';
    for i in 0..p_len - 1 loop
      v_code := v_code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.family_invites fi where fi.code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.create_family(p_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare f public.families;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.families (name) values (coalesce(nullif(trim(p_name), ''), 'Ma famille')) returning * into f;
  insert into public.family_members (family_id, user_id, role, email) values (f.id, auth.uid(), 'owner', auth.jwt() ->> 'email');
  return f;
end $$;

-- Créer une invitation (n'importe quel parent de la famille, 5 invitations en cours au maximum)
create or replace function public.create_invite(p_family uuid)
returns public.family_invites
language plpgsql
security definer
set search_path = public
as $$
declare inv public.family_invites;
begin
  if auth.uid() is null or not public.is_family_member(p_family) then
    raise exception 'Accès refusé';
  end if;
  if (select count(*) from public.family_invites where family_id = p_family and used_at is null and expires_at > now()) >= 5 then
    raise exception 'Trop d''invitations en cours : annule-en une avant d''en créer une autre';
  end if;
  insert into public.family_invites (code, family_id, created_by) values (public.new_invite_code(8), p_family, auth.uid()) returning * into inv;
  return inv;
end $$;

create or replace function public.revoke_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.family_invites
  where code = p_code and used_at is null and public.is_family_member(family_id);
end $$;

-- Rejoindre une famille. Renvoie {ok, family_id} ou {ok:false, error} sans lever d'erreur,
-- pour que l'essai raté reste enregistré (une erreur annulerait tout).
create or replace function public.join_family(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.family_invites;
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Connexion requise');
  end if;
  if (select count(*) from public.join_attempts where user_id = uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'Trop d''essais. Réessaie dans une heure.');
  end if;
  select * into inv from public.family_invites where code = upper(trim(p_code)) for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    insert into public.join_attempts (user_id) values (uid);
    return jsonb_build_object('ok', false, 'error', 'Ce code d''invitation n''existe pas, a expiré ou a déjà servi.');
  end if;
  if exists (select 1 from public.family_members where family_id = inv.family_id and user_id = uid) then
    return jsonb_build_object('ok', true, 'family_id', inv.family_id);
  end if;
  if (select count(*) from public.family_members where family_id = inv.family_id) >= 6 then
    return jsonb_build_object('ok', false, 'error', 'Cette famille compte déjà 6 parents.');
  end if;
  insert into public.family_members (family_id, user_id, role, email) values (inv.family_id, uid, 'parent', auth.jwt() ->> 'email');
  update public.family_invites set used_by = uid, used_at = now() where code = inv.code;
  return jsonb_build_object('ok', true, 'family_id', inv.family_id);
end $$;

-- Retirer un parent (réservé au créateur) ou quitter la famille soi-même
create or replace function public.remove_member(p_family uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  my_role text;
begin
  select role into my_role from public.family_members where family_id = p_family and user_id = auth.uid();
  select role into target_role from public.family_members where family_id = p_family and user_id = p_user;
  if my_role is null or target_role is null then
    raise exception 'Accès refusé';
  end if;
  if target_role = 'owner' then
    raise exception 'Le créateur de la famille ne peut pas être retiré';
  end if;
  if p_user <> auth.uid() and my_role <> 'owner' then
    raise exception 'Seul le créateur de la famille peut retirer un parent';
  end if;
  delete from public.family_members where family_id = p_family and user_id = p_user;
end $$;

revoke all on function public.new_invite_code(int) from public, anon, authenticated;
revoke all on function public.create_family(text) from public, anon;
revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.revoke_invite(text) from public, anon;
revoke all on function public.join_family(text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.revoke_invite(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
