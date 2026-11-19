create table public.scoped_provider_credentials (
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  owner_id uuid references auth.users on delete cascade,
  workshop_id uuid references public.workshops on delete cascade,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(owner_id, workshop_id) = 1),
  unique nulls not distinct (provider, owner_id, workshop_id)
);

alter table public.scoped_provider_credentials enable row level security;
revoke all on public.scoped_provider_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.scoped_provider_credentials to service_role;
