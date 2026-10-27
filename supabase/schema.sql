-- =====================================================================
--  Pandi — schéma Supabase
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
  sex text check (sex in ('garcon', 'fille')),
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
  color text not null check (color in ('green', 'orange', 'red', 'pause')),
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
  kind text not null check (kind in ('perfect', 'purchase', 'manual', 'challenge', 'behavior', 'team', 'help', 'gift', 'pot', 'potbuy', 'tsedaka', 'tsedakapaid', 'teamcard')),
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

-- Mesures du compteur de performance caché (js/lib/perf.js, allumé avec ?perf) : une ligne par lancement
-- de l'app sur un appareil, mise à jour pendant la session. Jamais de donnée d'enfant.
create table if not exists public.perf_reports (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  app_version text not null,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  report jsonb not null check (pg_column_size(report) < 200000)
);
create index if not exists perf_reports_family_idx on public.perf_reports (family_id, started_at);

alter table public.perf_reports enable row level security;

drop policy if exists "mesures : lecture" on public.perf_reports;
create policy "mesures : lecture" on public.perf_reports for select to authenticated using (public.is_family_member(family_id));
drop policy if exists "mesures : ajout" on public.perf_reports;
create policy "mesures : ajout" on public.perf_reports for insert to authenticated
  with check (public.is_family_member(family_id) and user_id = auth.uid());
drop policy if exists "mesures : mise à jour" on public.perf_reports;
create policy "mesures : mise à jour" on public.perf_reports for update to authenticated
  using (user_id = auth.uid()) with check (public.is_family_member(family_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Pilotage de l'adoption (Espace parent → 📊 Pilotage, seulement pour app_admins)
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

-- Le premier compte créé, celui de l'auteur de l'app
insert into public.app_admins (user_id)
select id from auth.users order by created_at limit 1
on conflict do nothing;

alter table public.family_members add column if not exists last_seen_at timestamptz;
alter table public.family_members add column if not exists app_version text;

-- L'app dit qu'elle vient d'être ouverte (sur la ligne du parent connecté seulement)
create or replace function public.mark_seen(p_family uuid, p_version text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.family_members set last_seen_at = now(), app_version = left(p_version, 20)
  where family_id = p_family and user_id = auth.uid();
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- Les dates sont celles de la France. Une « routine suivie » = une famille, un jour, une routine
-- (soir ou matin) avec au moins une note. Pandi gagnés = notes + bonus (soirée parfaite, défis,
-- paliers du coffre, coup de main, carte d'équipe, ajouts des parents) ; dépensés = boutique,
-- cagnotte commune, tsedaka, retraits des parents. Les cadeaux entre enfants et les dépôts dans la
-- cagnotte commune ne sont que des transferts : ni gagnés ni dépensés.
create or replace function public.admin_stats(p_skip_own boolean default false)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  my_families uuid[];
  result jsonb;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then
    raise exception 'Accès refusé';
  end if;
  my_families := array(select family_id from public.family_members where user_id = auth.uid());

  with fams as (
    select f.id, f.name, f.settings, f.created_at, (f.created_at at time zone 'Europe/Paris')::date as cd,
      f.id = any(my_families) as own, row_number() over (order by f.created_at) as n
    from public.families f
  ),
  fam as (select * from fams where not (p_skip_own and own)),
  mem as (select m.* from public.family_members m join fam on fam.id = m.family_id),
  kids as (select c.* from public.children c join fam on fam.id = c.family_id where not c.archived),
  rt as (
    select r.family_id, r.child_id, r.evening_date as d, coalesce(t.routine, 'soir') as routine, r.color, r.points
    from public.ratings r join fam on fam.id = r.family_id left join public.tasks t on t.id = r.task_id
  ),
  -- une ligne par famille, jour et routine suivie
  fr as (select family_id, d, routine, count(distinct child_id) as kids, count(*) as notes from rt group by 1, 2, 3),
  -- une ligne par enfant, jour et routine : notée jusqu'au bout ?
  kr as (
    select k.family_id, k.child_id, k.d, k.routine, k.rated, (
      select count(*) from public.child_tasks ct join public.tasks t on t.id = ct.task_id
      where ct.child_id = k.child_id and t.routine = k.routine and t.active and not t.archived
        and extract(dow from k.d)::int = any(t.days)
    ) as expected
    from (select family_id, child_id, d, routine, count(*) as rated from rt group by 1, 2, 3, 4) k
  ),
  led as (
    select l.*, coalesce(l.evening_date, (l.created_at at time zone 'Europe/Paris')::date) as d
    from public.ledger l join fam on fam.id = l.family_id
  ),
  -- tous les mouvements de pandi : notes et lignes du livre de comptes, rangés en gagné / dépensé
  pm as (
    select family_id, d, 'notes' as src, points as amount, 'earn' as way from rt where points <> 0
    union all
    select family_id, d,
      case when kind = 'manual' and amount < 0 then 'retrait' else kind end,
      case when kind in ('purchase', 'tsedaka') or (kind = 'manual' and amount < 0) then -amount else amount end,
      case when kind in ('purchase', 'potbuy', 'tsedaka') or (kind = 'manual' and amount < 0) then 'spend' else 'earn' end
    from led where kind not in ('gift', 'pot', 'tsedakapaid') and amount <> 0
  ),
  wk as (select date_trunc('week', today::timestamp)::date - 7 * i as w from generate_series(0, 11) i),
  cohort as (select id, cd, date_trunc('week', cd::timestamp)::date as cw from fam where cd > today - 63),
  coh_act as (
    select distinct c.cw, c.id, (fr.d - c.cd) / 7 as k from cohort c join fr on fr.family_id = c.id where fr.d >= c.cd
  )
  select jsonb_build_object(
    'generated_at', now(),
    'today', today,
    'skip_own', p_skip_own,
    'totals', jsonb_build_object(
      'accounts', (select count(*) from auth.users u where not (p_skip_own and u.id in (select user_id from public.family_members where family_id = any(my_families)))),
      'accounts_no_family', (select count(*) from auth.users u where not exists (select 1 from public.family_members m where m.user_id = u.id)),
      'families', (select count(*) from fam),
      'families_new_7d', (select count(*) from fam where cd > today - 7),
      'families_active_7d', (select count(distinct family_id) from fr where d > today - 7),
      'families_active_prev_7d', (select count(distinct family_id) from fr where d > today - 14 and d <= today - 7),
      'families_active_30d', (select count(distinct family_id) from fr where d > today - 30),
      'parents', (select count(*) from mem),
      'parents_seen_7d', (select count(*) from mem where last_seen_at > now() - interval '7 days'),
      'children', (select count(*) from kids),
      'children_active_7d', (select count(distinct child_id) from rt where d > today - 7),
      'routines_7d', (select count(*) from fr where d > today - 7),
      'routines_prev_7d', (select count(*) from fr where d > today - 14 and d <= today - 7),
      'routines_total', (select count(*) from fr),
      'notes_total', (select count(*) from rt),
      'kid_routines_30d', (select count(*) from kr where d > today - 30 and expected > 0),
      'kid_routines_complete_30d', (select count(*) from kr where d > today - 30 and expected > 0 and rated >= expected)
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('key', 'famille', 'n', (select count(*) from fam)),
      jsonb_build_object('key', 'enfant', 'n', (select count(distinct family_id) from kids)),
      jsonb_build_object('key', 'routine', 'n', (select count(distinct family_id) from fr)),
      jsonb_build_object('key', 'habitude', 'n', (select count(*) from (select family_id from fr group by 1 having count(distinct d) >= 3) x)),
      jsonb_build_object('key', 'semaine2', 'n', (select count(*) from fam where exists (select 1 from fr where fr.family_id = fam.id and fr.d >= fam.cd + 7))),
      jsonb_build_object('key', 'active', 'n', (select count(distinct family_id) from fr where d > today - 7))
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'd', g.d,
        'soir', (select count(*) from fr where fr.d = g.d and routine = 'soir'),
        'matin', (select count(*) from fr where fr.d = g.d and routine = 'matin'),
        'families', (select count(distinct family_id) from fr where fr.d = g.d),
        'notes', (select coalesce(sum(notes), 0) from fr where fr.d = g.d)
      ) order by g.d)
      from (select today - i as d from generate_series(0, 29) i) g
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'w', wk.w,
        'active', (select count(distinct family_id) from fr where fr.d >= wk.w and fr.d < wk.w + 7),
        'new', (select count(*) from fam where fam.cd >= wk.w and fam.cd < wk.w + 7),
        'routines', (select count(*) from fr where fr.d >= wk.w and fr.d < wk.w + 7),
        'earned', (select coalesce(sum(amount), 0) from pm where way = 'earn' and pm.d >= wk.w and pm.d < wk.w + 7),
        'spent', (select coalesce(sum(amount), 0) from pm where way = 'spend' and pm.d >= wk.w and pm.d < wk.w + 7)
      ) order by wk.w)
      from wk
    ),
    'pandi', jsonb_build_object(
      'sources', (select coalesce(jsonb_object_agg(src, jsonb_build_object('total', t, 'd30', coalesce(t30, 0))), '{}') from (
        select src, way, sum(amount) as t, sum(amount) filter (where d > today - 30) as t30 from pm group by 1, 2) x),
      'kids_balance', (select coalesce(sum(points), 0) from rt where child_id in (select id from kids))
        + (select coalesce(sum(amount), 0) from led where child_id in (select id from kids) and kind not in ('potbuy', 'teamcard')),
      'pots_balance', (select coalesce(sum(case when kind = 'teamcard' then amount else -amount end), 0) from led where kind in ('pot', 'potbuy', 'teamcard'))
    ),
    'colors', (select coalesce(jsonb_object_agg(color, jsonb_build_object('total', t, 'd30', t30)), '{}') from (
      select color, count(*) as t, count(*) filter (where d > today - 30) as t30 from rt group by 1) x),
    'ages', (select coalesce(jsonb_object_agg(b, n), '{}') from (
      select case when age is null or age = 0 then 'inconnu' when age < 3 then '0-2' when age < 6 then '3-5' when age < 9 then '6-8' else '9+' end as b, count(*) as n
      from kids group by 1) x),
    'features', jsonb_build_object(
      'matin', (select count(distinct family_id) from fr where routine = 'matin'),
      'coparent', (select count(*) from (select family_id from mem group by 1 having count(*) >= 2) x),
      'photo', (select count(distinct p.family_id) from public.photo_analyses p join fam on fam.id = p.family_id where p.count > 0 or p.images > 0),
      'boutique', (select count(distinct family_id) from led where kind = 'purchase'),
      'defi', (select count(distinct family_id) from led where kind = 'challenge'),
      'palier', (select count(distinct family_id) from led where kind = 'team'),
      'teamcard', (select count(distinct family_id) from led where kind = 'teamcard'),
      'cagnotte', (select count(distinct family_id) from led where kind in ('pot', 'potbuy')),
      'aide', (select count(distinct family_id) from led where kind = 'help'),
      'cadeau', (select count(distinct family_id) from led where kind = 'gift'),
      'tsedaka', (select count(distinct family_id) from led where kind = 'tsedaka'),
      'bonus', (select count(distinct family_id) from led where kind = 'manual'),
      'surprise', (select count(*) from fam where jsonb_typeof(settings -> 'surprises') = 'array' and jsonb_array_length(settings -> 'surprises') > 0)
    ),
    'top_items', (select coalesce(jsonb_agg(jsonb_build_object('item', item_id, 'n', n) order by n desc, item_id), '[]') from (
      select o.item_id, count(*) as n from public.owned_items o join fam on fam.id = o.family_id where o.source = 'shop'
      group by 1 order by 2 desc, 1 limit 10) x),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object(
        'w', c.cw,
        'families', c.n,
        'weeks', (select jsonb_agg(case when c.cw + 7 * k > today then null
          else (select count(*) from coh_act a where a.cw = c.cw and a.k = g.k) end order by k)
          from generate_series(0, 7) g(k))
      ) order by c.cw), '[]')
      from (select cw, count(*) as n from cohort group by 1) c),
    'families', (select coalesce(jsonb_agg(f order by f ->> 'last_routine' desc nulls last, (f ->> 'n')::int desc), '[]') from (
      select jsonb_build_object(
        'n', fam.n,
        'name', fam.name,
        'own', fam.own,
        'created', fam.cd,
        'parents', (select count(*) from mem where mem.family_id = fam.id),
        'emails', (select coalesce(jsonb_agg(email order by created_at), '[]') from mem where mem.family_id = fam.id and email is not null),
        'last_seen', (select max(last_seen_at) from mem where mem.family_id = fam.id),
        'version', (select app_version from mem where mem.family_id = fam.id and last_seen_at is not null order by last_seen_at desc limit 1),
        'children', (select count(*) from kids where kids.family_id = fam.id),
        'last_routine', (select max(d) from fr where fr.family_id = fam.id),
        'routines_7d', (select count(*) from fr where fr.family_id = fam.id and d > today - 7),
        'routines', (select count(*) from fr where fr.family_id = fam.id),
        'days', (select count(distinct d) from fr where fr.family_id = fam.id),
        'earned', (select coalesce(sum(amount), 0) from pm where pm.family_id = fam.id and way = 'earn'),
        'spent', (select coalesce(sum(amount), 0) from pm where pm.family_id = fam.id and way = 'spend')
      ) as f
      from fam order by fam.n desc limit 300) x)
  ) into result;
  return result;
end $$;

revoke all on function public.mark_seen(uuid, text) from public, anon;
revoke all on function public.is_app_admin() from public, anon;
revoke all on function public.admin_stats(boolean) from public, anon;
grant execute on function public.mark_seen(uuid, text) to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.admin_stats(boolean) to authenticated;
