insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-originals', 'card-originals', false, 2000000, array['font/woff2', 'image/jpeg']);

create policy "Signed-in accounts can read 7rizons card originals"
on storage.objects for select to authenticated
using (
  bucket_id = 'card-originals'
  and (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
);
