-- =====================================================================
--  PandiFlow — schéma Supabase
--  À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
--  Chaque famille ne voit que ses propres données (Row Level Security).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ma famille',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'parent' check (role in ('owner', 'parent')),
  email text,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index if not exists family_members_user_idx on public.family_members (user_id);

create table if not exists public.children (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  age int check (age between 0 and 18),
  color text not null default '#FF7EB6',
  look jsonb not null default '{}'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create table if not exists public.tasks (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  emoji text not null default '⭐',
  days int[] not null default '{0,1,2,3,4,5,6}',
  sort int not null default 0,
  active boolean not null default true,
  archived boolean not null default false,
  routine text not null default 'soir' check (routine in ('soir', 'matin')),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create table if not exists public.child_tasks (
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  task_id uuid not null,
  primary key (child_id, task_id),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  foreign key (task_id, family_id) references public.tasks (id, family_id) on delete cascade
);

create table if not exists public.ratings (
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  task_id uuid not null,
  evening_date date not null,
  color text not null check (color in ('green', 'orange', 'red')),
  points int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (child_id, task_id, evening_date),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  foreign key (task_id, family_id) references public.tasks (id, family_id) on delete cascade
);
create index if not exists ratings_family_idx on public.ratings (family_id, evening_date);

create table if not exists public.ledger (
  id text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  kind text not null check (kind in ('perfect', 'purchase', 'manual', 'challenge', 'behavior', 'team', 'help', 'gift', 'pot', 'potbuy')),
  amount int not null,
  evening_date date,
  note text,
  created_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index if not exists ledger_family_idx on public.ledger (family_id);

create table if not exists public.owned_items (
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  item_id text not null,
  source text not null default 'shop' check (source in ('shop', 'challenge', 'gift', 'pot', 'team')),
  created_at timestamptz not null default now(),
  primary key (child_id, item_id),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

create table if not exists public.challenges (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid,
  task_id uuid not null,
  title text not null,
  target int not null check (target > 0),
  reward_item text not null,
  bonus int not null default 0,
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  foreign key (task_id, family_id) references public.tasks (id, family_id) on delete cascade
);

-- Limite d'analyses photo et de visages 3D par enfant et par jour (écrite uniquement par les Edge Functions)
create table if not exists public.photo_analyses (
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  day date not null,
  count int not null default 0,
  images int not null default 0,
  primary key (child_id, day),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Sécurité : chaque parent ne voit que sa famille
-- ---------------------------------------------------------------------
create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid());
$$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.tasks enable row level security;
alter table public.child_tasks enable row level security;
alter table public.ratings enable row level security;
alter table public.ledger enable row level security;
alter table public.owned_items enable row level security;
alter table public.challenges enable row level security;
alter table public.photo_analyses enable row level security;

drop policy if exists "famille : lecture" on public.families;
create policy "famille : lecture" on public.families for select to authenticated using (public.is_family_member(id));
drop policy if exists "famille : modification" on public.families;
create policy "famille : modification" on public.families for update to authenticated using (public.is_family_member(id)) with check (public.is_family_member(id));

drop policy if exists "membres : lecture" on public.family_members;
create policy "membres : lecture" on public.family_members for select to authenticated using (public.is_family_member(family_id));

do $$
declare t text;
begin
  foreach t in array array['children', 'tasks', 'child_tasks', 'ratings', 'ledger', 'owned_items', 'challenges'] loop
    execute format('drop policy if exists "famille : tout" on public.%I', t);
    execute format(
      'create policy "famille : tout" on public.%I for all to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id))',
      t
    );
  end loop;
end $$;

drop policy if exists "quota : lecture" on public.photo_analyses;
create policy "quota : lecture" on public.photo_analyses for select to authenticated using (public.is_family_member(family_id));

-- Depuis l'app, on ne peut modifier que le nom et les réglages de la famille
-- (pas son identifiant ni son code d'invitation). Les créations passent par create_family().
revoke insert, update, delete on public.families from anon, authenticated;
grant update (name, settings) on public.families to authenticated;
revoke insert, update, delete on public.family_members from anon, authenticated;
revoke insert, update, delete on public.photo_analyses from anon, authenticated;

-- ---------------------------------------------------------------------
-- Invitations à usage unique et gestion des parents
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Visages 3D des enfants (Edge Function make-portrait) : bucket privé « portraits »,
-- <famille>/<enfant>/<version>/<expression>.webp, écrit par l'Edge Function, lu par la famille
-- ---------------------------------------------------------------------
-- Réserve une image dans la limite du jour (false si la limite est atteinte)
create or replace function public.take_portrait_quota(p_child uuid, p_family uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.photo_analyses (child_id, family_id, day, images)
  values (p_child, p_family, current_date, 1)
  on conflict (child_id, day) do update set images = public.photo_analyses.images + 1
  returning images into n;
  if n > p_limit then
    update public.photo_analyses set images = images - 1 where child_id = p_child and day = current_date;
    return false;
  end if;
  return true;
end $$;

-- Rend l'image réservée quand la création a échoué
create or replace function public.refund_portrait_quota(p_child uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.photo_analyses set images = greatest(images - 1, 0) where child_id = p_child and day = current_date;
$$;

revoke all on function public.take_portrait_quota(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.refund_portrait_quota(uuid) from public, anon, authenticated;
grant execute on function public.take_portrait_quota(uuid, uuid, int) to service_role;
grant execute on function public.refund_portrait_quota(uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', false, 3145728, array['image/webp', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "portraits : lecture famille" on storage.objects;
create policy "portraits : lecture famille" on storage.objects for select to authenticated using (
  bucket_id = 'portraits'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then public.is_family_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

-- Journal des créations de visages 3D (durée, modèle, erreur ; jamais d'image), lu seulement par le service
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

-- Provisoire (passage à www.pandiflow.com) : un signe par connexion dont le cookie de relais est écrit
create table if not exists public.relay_pings (
  session_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  host text,
  at timestamptz not null default now()
);

alter table public.relay_pings enable row level security;
revoke all on public.relay_pings from anon, authenticated;
grant insert on public.relay_pings to authenticated;

drop policy if exists relay_pings_insert on public.relay_pings;
create policy relay_pings_insert on public.relay_pings
  for insert to authenticated with check (user_id = auth.uid() and session_id = (auth.jwt() ->> 'session_id')::uuid);
