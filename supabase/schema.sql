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
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'parent',
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
  kind text not null check (kind in ('perfect', 'purchase', 'manual', 'challenge')),
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
  source text not null default 'shop' check (source in ('shop', 'challenge', 'gift')),
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

-- Limite d'analyses photo par enfant et par jour (écrite uniquement par l'Edge Function)
create table if not exists public.photo_analyses (
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  day date not null,
  count int not null default 0,
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
-- Création d'une famille et invitation du second parent
-- ---------------------------------------------------------------------
create or replace function public.new_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  bytes bytea;
  i int;
begin
  loop
    bytes := gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.families where invite_code = code);
  end loop;
  return code;
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
  insert into public.families (name, invite_code)
  values (coalesce(nullif(trim(p_name), ''), 'Ma famille'), public.new_invite_code())
  returning * into f;
  insert into public.family_members (family_id, user_id) values (f.id, auth.uid());
  return f;
end $$;

create or replace function public.join_family(p_code text)
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
  select * into f from public.families where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'Code d''invitation inconnu';
  end if;
  insert into public.family_members (family_id, user_id) values (f.id, auth.uid()) on conflict do nothing;
  return f;
end $$;

revoke all on function public.create_family(text) from public, anon;
revoke all on function public.join_family(text) from public, anon;
revoke all on function public.new_invite_code() from public, anon, authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
