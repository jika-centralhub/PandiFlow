-- =====================================================================
--  PandiFlow — visages 3D des enfants (Edge Function make-portrait)
--  Les images générées sont rangées dans le bucket privé « portraits »,
--  sous <famille>/<enfant>/<version>/<expression>.webp. Seule l'Edge Function écrit ;
--  les parents de la famille peuvent lire. La photo d'origine n'est jamais gardée.
--  Envoi : supabase db query --linked --file supabase/migrations/20261021130000_portraits.sql
-- =====================================================================

alter table public.photo_analyses add column if not exists images int not null default 0;

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
