-- Private account drive. Run once in the Supabase SQL editor.
-- Files live in storage.objects under files/<user-id>/...
-- Max file size: 50 MB (also enforced in the app).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  52428800,
  null
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 52428800;

drop policy if exists "Users can read own drive files" on storage.objects;
create policy "Users can read own drive files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "Users can upload own drive files" on storage.objects;
create policy "Users can upload own drive files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "Users can update own drive files" on storage.objects;
create policy "Users can update own drive files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "Users can delete own drive files" on storage.objects;
create policy "Users can delete own drive files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
