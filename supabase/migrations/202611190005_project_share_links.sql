create table public.project_share_links (
  token uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.configurations(id) on delete cascade,
  title text not null,
  snapshot jsonb not null,
  shared_revision integer not null,
  created_at timestamptz not null default now()
);
alter table public.project_share_links enable row level security;
revoke all on public.project_share_links from public, anon, authenticated;

create function public.my_project_share(p_project uuid)
returns table (token uuid, shared_revision integer)
language sql stable security definer set search_path = '' as $$
  select s.token, s.shared_revision from public.project_share_links s
    join public.configurations c on c.id = s.project_id
    where c.id = p_project and c.owner_id = auth.uid()
$$;

create function public.create_project_share(p_project uuid, p_revision integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.configurations; new_token uuid;
begin
  select * into c from public.configurations where id = p_project and owner_id = auth.uid() for update;
  if not found then raise exception 'Nur eigene Online-Projekte können geteilt werden'; end if;
  if c.revision is distinct from p_revision then raise exception 'Der Projektstand wurde geändert. Lade die Seite erneut.'; end if;
  insert into public.project_share_links(project_id, title, snapshot, shared_revision)
    values (c.id,c.title,c.payload,c.revision)
    on conflict (project_id) do update
      set token = gen_random_uuid(), title = excluded.title, snapshot = excluded.snapshot,
          shared_revision = excluded.shared_revision, created_at = now()
    returning token into new_token;
  return new_token;
end $$;

create function public.revoke_project_share(p_project uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.project_share_links s using public.configurations c
  where s.project_id = c.id and c.id = p_project and c.owner_id = auth.uid()
$$;

create function public.read_project_share(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', title, 'project', snapshot, 'stand', shared_revision)
  from public.project_share_links where token = p_token
$$;

revoke all on function
  public.my_project_share(uuid), public.create_project_share(uuid, integer),
  public.revoke_project_share(uuid), public.read_project_share(uuid)
from public, anon, authenticated;
grant execute on function
  public.my_project_share(uuid), public.create_project_share(uuid, integer),
  public.revoke_project_share(uuid)
to authenticated;
grant execute on function public.read_project_share(uuid) to anon, authenticated;
