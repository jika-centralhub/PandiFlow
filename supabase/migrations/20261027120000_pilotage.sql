-- =====================================================================
--  PandiFlow — pilotage de l'adoption (Espace parent → 📊 Pilotage, visible seulement par l'auteur de l'app)
--  app_admins : les comptes qui voient les chiffres de toutes les familles (illisible depuis l'app).
--  family_members.last_seen_at / app_version : dernière ouverture de l'app par chaque parent
--    (écrites par mark_seen, appelée par l'app à chaque chargement des données).
--  admin_stats(p_skip_own) : tous les chiffres d'un coup (familles, parents, enfants, routines suivies,
--    pandi gagnés et dépensés, fonctions utilisées, rétention). Jamais de prénom d'enfant ni de photo.
--  Envoi : supabase db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/migrations/20261027120000_pilotage.sql
-- =====================================================================

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
