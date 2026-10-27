-- Test d'isolation entre familles et entre parents (Pandi).
-- Il crée 5 comptes fictifs, 2 familles de 2 parents, un compte sans famille et un visiteur non connecté,
-- puis vérifie que personne ne voit, ne modifie ni n'efface les données d'une autre famille.
-- TOUT EST ANNULÉ À LA FIN : le bloc se termine toujours par une erreur qui contient le rapport.
-- Rien n'est donc écrit dans la base (ni compte, ni famille, ni note).
--
-- À lancer depuis PowerShell, à la racine du projet :
--   & "$env:LOCALAPPDATA\supabase-cli\supabase.exe" db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/tests/isolation.sql
-- Le rapport s'affiche dans le message d'erreur : chaque ligne commence par OK ou ÉCHEC.


do $test$
declare
  orig text := current_user;
  r text := 'RAPPORT D''ISOLATION (tout est annulé à la fin)';
  n int;
  res jsonb;
  a1 uuid; a2 uuid; b1 uuid; b2 uuid; c uuid;
  fa uuid; fb uuid; fc uuid;
  ca uuid := gen_random_uuid(); cb uuid := gen_random_uuid();
  ta uuid := gen_random_uuid(); tb uuid := gen_random_uuid();
  code_a text; code_a2 text; code_b text;
begin
  -- Cinq comptes fictifs
  a1 := gen_random_uuid(); a2 := gen_random_uuid(); b1 := gen_random_uuid(); b2 := gen_random_uuid(); c := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-' || x || '@pandiflow.test', '{}', '{}', now(), now()
  from unnest(array[a1, a2, b1, b2, c]) as x;

  -- Famille A (A1 crée, A2 rejoint), famille B (B1 crée, B2 rejoint)
  
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', a1::text, true); perform set_config('request.jwt.claims', json_build_object('sub', a1, 'email', 'test-' || a1 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select (public.create_family('Famille A (test)')).id into fa;
  r := r || E'\n' || (case when fa is not null then 'OK     ' else 'ÉCHEC  ' end) || 'A1 crée la famille A';
  insert into public.children (id, family_id, name, age) values (ca, fa, 'Enfant A', 5);
  insert into public.tasks (id, family_id, title) values (ta, fa, 'Dents A');
  insert into public.child_tasks (family_id, child_id, task_id) values (fa, ca, ta);
  insert into public.ratings (family_id, child_id, task_id, evening_date, color, points) values (fa, ca, ta, '2026-10-27', 'green', 3);
  insert into public.ledger (id, family_id, child_id, kind, amount) values ('manual-' || gen_random_uuid(), fa, ca, 'manual', 5);
  insert into public.owned_items (family_id, child_id, item_id) values (fa, ca, 'cape');
  insert into public.challenges (id, family_id, task_id, title, target, reward_item) values (gen_random_uuid(), fa, ta, 'Défi A', 5, 'cape');
  update public.families set settings = jsonb_build_object('surprises', '[]'::jsonb, 'famille', 'A') where id = fa;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'A1 écrit les réglages de sa famille';
  select count(*) into n from public.children where family_id = fa;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'A1 voit son enfant';

  -- La carte d'équipe telle que l'app l'écrivait jusqu'ici : id « teamcard-<date> », le même pour toutes les familles
  insert into public.ledger (id, family_id, child_id, kind, amount, evening_date) values ('teamcard-2026-10-27', fa, ca, 'teamcard', 5, '2026-10-27');
  select (public.create_invite(fa)).code into code_a;
  r := r || E'\n' || (case when length(code_a) = 8 then 'OK     ' else 'ÉCHEC  ' end) || 'A1 crée une invitation de 8 caractères';

  
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', b1::text, true); perform set_config('request.jwt.claims', json_build_object('sub', b1, 'email', 'test-' || b1 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select (public.create_family('Famille B (test)')).id into fb;
  r := r || E'\n' || (case when fb is not null then 'OK     ' else 'ÉCHEC  ' end) || 'B1 crée la famille B';
  insert into public.children (id, family_id, name, age) values (cb, fb, 'Enfant B', 5);
  insert into public.tasks (id, family_id, title) values (tb, fb, 'Dents B');
  insert into public.child_tasks (family_id, child_id, task_id) values (fb, cb, tb);
  insert into public.ratings (family_id, child_id, task_id, evening_date, color, points) values (fb, cb, tb, '2026-10-27', 'green', 3);
  insert into public.ledger (id, family_id, child_id, kind, amount) values ('manual-' || gen_random_uuid(), fb, cb, 'manual', 5);
  insert into public.owned_items (family_id, child_id, item_id) values (fb, cb, 'cape');
  insert into public.challenges (id, family_id, task_id, title, target, reward_item) values (gen_random_uuid(), fb, tb, 'Défi B', 5, 'cape');
  update public.families set settings = jsonb_build_object('surprises', '[]'::jsonb, 'famille', 'B') where id = fb;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'B1 écrit les réglages de sa famille';
  select count(*) into n from public.children where family_id = fb;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'B1 voit son enfant';

  begin
    insert into public.ledger (id, family_id, child_id, kind, amount, evening_date) values ('teamcard-2026-10-27', fb, cb, 'teamcard', 5, '2026-10-27') on conflict (id) do update set amount = excluded.amount;
    r := r || E'\n' || 'ÉCHEC  B1 a écrasé la carte d''équipe de A (ancien id commun)';
  exception when others then r := r || E'\n' || 'OK     B1 ne touche pas la carte de A ; c''est pourquoi l''app écrit désormais teamcard-<famille>-<date> (v1.10.1) [' || left(sqlerrm, 50) || ']'; end;
  begin
    insert into public.ledger (id, family_id, child_id, kind, amount, evening_date) values ('teamcard-' || fb || '-2026-10-27', fb, cb, 'teamcard', 5, '2026-10-27');
    r := r || E'\n' || 'OK     B1 enregistre sa carte d''équipe avec un id propre à sa famille';
  exception when others then r := r || E'\n' || 'ÉCHEC  carte d''équipe avec id de famille [' || sqlerrm || ']'; end;

  -- Les parents rejoignent avec l'invitation
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', a2::text, true); perform set_config('request.jwt.claims', json_build_object('sub', a2, 'email', 'test-' || a2 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select public.join_family(code_a) into res;
  r := r || E'\n' || (case when res->>'ok' = 'true' then 'OK     ' else 'ÉCHEC  ' end) || 'A2 rejoint la famille A avec le code';
  select count(*) into n from public.children where family_id = fa;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'A2 voit l''enfant de la famille A';
  select count(*) into n from public.family_members where family_id = fa;
  r := r || E'\n' || (case when n = 2 then 'OK     ' else 'ÉCHEC  ' end) || 'A2 voit les 2 parents de la famille A';
  update public.families set settings = settings || '{"par":"a2"}' where id = fa;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'A2 peut écrire les réglages de la famille A';
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', b2::text, true); perform set_config('request.jwt.claims', json_build_object('sub', b2, 'email', 'test-' || b2 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select public.join_family(code_a) into res;
  r := r || E'\n' || (case when res->>'ok' = 'false' then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne peut pas réutiliser l''invitation déjà servie de A';
  select public.join_family('ZZZZZZZZ') into res;
  r := r || E'\n' || (case when res->>'ok' = 'false' then 'OK     ' else 'ÉCHEC  ' end) || 'Un code inventé est refusé';
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', b1::text, true); perform set_config('request.jwt.claims', json_build_object('sub', b1, 'email', 'test-' || b1 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select (public.create_invite(fb)).code into code_b;
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', b2::text, true); perform set_config('request.jwt.claims', json_build_object('sub', b2, 'email', 'test-' || b2 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select public.join_family(code_b) into res;
  r := r || E'\n' || (case when res->>'ok' = 'true' then 'OK     ' else 'ÉCHEC  ' end) || 'B2 rejoint la famille B';
  select count(*) into n from public.families;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit qu’une famille (la sienne)';
  select count(*) into n from public.children;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit que son enfant';

  -- Une invitation encore valable de A, et des données que seules les fonctions serveur écrivent
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', a1::text, true); perform set_config('request.jwt.claims', json_build_object('sub', a1, 'email', 'test-' || a1 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select (public.create_invite(fa)).code into code_a2;
  perform set_config('role', orig, true); perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claims', '', true);
  insert into public.photo_analyses (family_id, child_id, day, count) values (fa, ca, current_date, 1);
  insert into public.perf_reports (id, family_id, user_id, app_version, started_at, report) values (gen_random_uuid(), fa, a1, 'test', now(), '{}');
  begin
    insert into storage.objects (bucket_id, name) values ('portraits', fa || '/' || ca || '/vtest/happy.webp');
  exception when others then r := r || E'\n' || 'info   stockage non testé [' || left(sqlerrm, 60) || ']'; end;

  -- B2 (autre famille) essaie de lire, modifier, effacer ce qui est à A
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', b2::text, true); perform set_config('request.jwt.claims', json_build_object('sub', b2, 'email', 'test-' || b2 || '@pandiflow.test', 'role', 'authenticated')::text, true);
execute format('select count(*) from public.%I where %I = $1', 'families', 'id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de families';
execute format('select count(*) from public.%I where %I = $1', 'family_members', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de family_members';
execute format('select count(*) from public.%I where %I = $1', 'family_invites', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de family_invites';
execute format('select count(*) from public.%I where %I = $1', 'children', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de children';
execute format('select count(*) from public.%I where %I = $1', 'tasks', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de tasks';
execute format('select count(*) from public.%I where %I = $1', 'child_tasks', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de child_tasks';
execute format('select count(*) from public.%I where %I = $1', 'ratings', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de ratings';
execute format('select count(*) from public.%I where %I = $1', 'ledger', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de ledger';
execute format('select count(*) from public.%I where %I = $1', 'owned_items', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de owned_items';
execute format('select count(*) from public.%I where %I = $1', 'challenges', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de challenges';
execute format('select count(*) from public.%I where %I = $1', 'photo_analyses', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de photo_analyses';
execute format('select count(*) from public.%I where %I = $1', 'perf_reports', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit rien de perf_reports';
  select count(*) into n from storage.objects where bucket_id = 'portraits' and name like fa || '/%';
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne voit aucun visage 3D de la famille A';
  begin insert into public.children (id, family_id, name) values (gen_random_uuid(), fa, 'Intrus'); r := r || E'\n' || 'ÉCHEC  ' || 'B2 ajoute un enfant dans la famille A' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 ajoute un enfant dans la famille A' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin insert into public.ratings (family_id, child_id, task_id, evening_date, color) values (fa, ca, ta, '2026-10-26', 'green'); r := r || E'\n' || 'ÉCHEC  ' || 'B2 ajoute une note à l''enfant de A' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 ajoute une note à l''enfant de A' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin insert into public.ratings (family_id, child_id, task_id, evening_date, color) values (fb, ca, tb, '2026-10-26', 'green'); r := r || E'\n' || 'ÉCHEC  ' || 'B2 rattache l''enfant de A à sa famille' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 rattache l''enfant de A à sa famille' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin insert into public.ratings (family_id, child_id, task_id, evening_date, color) values (fa, ca, ta, '2026-10-27', 'red') on conflict (child_id, task_id, evening_date) do update set color = 'red'; r := r || E'\n' || 'ÉCHEC  ' || 'B2 écrase la note de A (upsert)' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 écrase la note de A (upsert)' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin insert into public.perf_reports (id, family_id, app_version, started_at, report) values (gen_random_uuid(), fa, 'x', now(), '{}'); r := r || E'\n' || 'ÉCHEC  ' || 'B2 écrit une mesure de perf pour A' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 écrit une mesure de perf pour A' || ' [' || left(sqlerrm, 70) || ']'; end;
  update public.children set name = 'Pirate' where id = ca;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne peut pas renommer l''enfant de A';
  delete from public.ratings where child_id = ca;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne peut pas effacer les notes de A';
  delete from public.ledger where id = 'teamcard-2026-10-27';
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne peut pas effacer la carte d''équipe de A';
  update public.families set settings = '{}' where id = fa;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'B2 ne peut pas écraser les réglages de A';
  begin perform public.create_invite(fa); r := r || E'\n' || 'ÉCHEC  ' || 'B2 crée une invitation pour la famille A' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 crée une invitation pour la famille A' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin perform public.remove_member(fa, a2); r := r || E'\n' || 'ÉCHEC  ' || 'B2 retire un parent de la famille A' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 retire un parent de la famille A' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin update public.families set id = gen_random_uuid() where id = fb; r := r || E'\n' || 'ÉCHEC  ' || 'B2 change l''id ou le code d''une famille' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 change l''id ou le code d''une famille' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin insert into public.family_members (family_id, user_id) values (fa, b2); r := r || E'\n' || 'ÉCHEC  ' || 'B2 s''ajoute lui-même comme parent de A' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 s''ajoute lui-même comme parent de A' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin perform public.take_portrait_quota(ca, fa, 99); r := r || E'\n' || 'ÉCHEC  ' || 'B2 appelle la réserve de visages 3D' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'B2 appelle la réserve de visages 3D' || ' [' || left(sqlerrm, 70) || ']'; end;
  perform public.revoke_invite(code_a2);

  -- C : un compte sans famille ; puis un visiteur non connecté
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', c::text, true); perform set_config('request.jwt.claims', json_build_object('sub', c, 'email', 'test-' || c || '@pandiflow.test', 'role', 'authenticated')::text, true);
execute format('select count(*) from public.%I where %I = $1', 'families', 'id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de families';
execute format('select count(*) from public.%I where %I = $1', 'family_members', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de family_members';
execute format('select count(*) from public.%I where %I = $1', 'family_invites', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de family_invites';
execute format('select count(*) from public.%I where %I = $1', 'children', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de children';
execute format('select count(*) from public.%I where %I = $1', 'tasks', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de tasks';
execute format('select count(*) from public.%I where %I = $1', 'child_tasks', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de child_tasks';
execute format('select count(*) from public.%I where %I = $1', 'ratings', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de ratings';
execute format('select count(*) from public.%I where %I = $1', 'ledger', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de ledger';
execute format('select count(*) from public.%I where %I = $1', 'owned_items', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de owned_items';
execute format('select count(*) from public.%I where %I = $1', 'challenges', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de challenges';
execute format('select count(*) from public.%I where %I = $1', 'photo_analyses', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de photo_analyses';
execute format('select count(*) from public.%I where %I = $1', 'perf_reports', 'family_id') into n using fa;
r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C (sans famille) ne voit rien de perf_reports';
  select count(*) into n from public.children;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'C ne voit aucun enfant du tout';
  select (public.create_family('Famille C (test)')).id into fc;
  r := r || E'\n' || (case when fc is not null then 'OK     ' else 'ÉCHEC  ' end) || 'C peut créer sa propre famille';
  perform set_config('role', 'anon', true); perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.children;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'Un visiteur non connecté ne voit aucun enfant';
  select count(*) into n from public.families;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'Un visiteur non connecté ne voit aucune famille';
  begin perform public.create_family('Pirate'); r := r || E'\n' || 'ÉCHEC  ' || 'Un visiteur non connecté crée une famille' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'Un visiteur non connecté crée une famille' || ' [' || left(sqlerrm, 70) || ']'; end;
  begin insert into public.children (id, family_id, name) values (gen_random_uuid(), fa, 'Intrus'); r := r || E'\n' || 'ÉCHEC  ' || 'Un visiteur non connecté ajoute un enfant' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'Un visiteur non connecté ajoute un enfant' || ' [' || left(sqlerrm, 70) || ']'; end;

  -- Vérifications vues par le service : rien n'a bougé chez A
  perform set_config('role', orig, true); perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.ratings where child_id = ca and color = 'green';
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'La note de A est intacte';
  select count(*) into n from public.children where id = ca and name = 'Enfant A';
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'Le prénom de l''enfant de A est intact';
  select count(*) into n from public.families where id = fa and settings ? 'par';
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'Les réglages de A sont intacts';
  select count(*) into n from public.family_invites where code = code_a2;
  r := r || E'\n' || (case when n = 1 then 'OK     ' else 'ÉCHEC  ' end) || 'L''invitation de A n''a pas été annulée par B';
  select count(*) into n from public.family_members where family_id = fa;
  r := r || E'\n' || (case when n = 2 then 'OK     ' else 'ÉCHEC  ' end) || 'La famille A a toujours ses 2 parents';

  -- Départ d'un parent : A1 retire A2, qui ne voit plus rien
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', a2::text, true); perform set_config('request.jwt.claims', json_build_object('sub', a2, 'email', 'test-' || a2 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  begin perform public.remove_member(fa, a1); r := r || E'\n' || 'ÉCHEC  ' || 'A2 retire le créateur A1' || ' (accepté !)'; exception when others then r := r || E'\n' || 'OK     ' || 'A2 retire le créateur A1' || ' [' || left(sqlerrm, 70) || ']'; end;
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', a1::text, true); perform set_config('request.jwt.claims', json_build_object('sub', a1, 'email', 'test-' || a1 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  perform public.remove_member(fa, a2);
  perform set_config('role', 'authenticated', true); perform set_config('request.jwt.claim.sub', a2::text, true); perform set_config('request.jwt.claims', json_build_object('sub', a2, 'email', 'test-' || a2 || '@pandiflow.test', 'role', 'authenticated')::text, true);
  select count(*) into n from public.children where family_id = fa;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'A2, retiré, ne voit plus les enfants de A';
  update public.families set settings = '{}' where id = fa;
  get diagnostics n = row_count;
  r := r || E'\n' || (case when n = 0 then 'OK     ' else 'ÉCHEC  ' end) || 'A2, retiré, ne peut plus écrire chez A';

  raise exception '%', r;
end
$test$;

