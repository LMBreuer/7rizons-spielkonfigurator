-- Editorial content uses the existing public read and admin update policies.
alter table public.app_settings
  add column content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 120000),
  add column content_revision uuid not null default gen_random_uuid();
