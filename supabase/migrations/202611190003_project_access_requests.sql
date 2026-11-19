create table public.superadmins (
  user_id uuid primary key references public.admins(user_id) on delete cascade
);
create table public.project_access_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.configurations(id) on delete cascade,
  requester_id uuid not null references public.superadmins(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'revoked')),
  requested_at timestamptz not null default now(),
  shared_revision integer,
  snapshot jsonb,
  unique (project_id, requester_id),
  check (
    (status = 'approved' and snapshot is not null and shared_revision is not null)
    or (status <> 'approved' and snapshot is null and shared_revision is null)
  )
);

alter table public.superadmins enable row level security;
alter table public.project_access_requests enable row level security;
revoke all on public.superadmins, public.project_access_requests from public, anon, authenticated;
create index project_access_requester on public.project_access_requests(requester_id);

create function public.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select from public.superadmins where user_id = auth.uid())
$$;

create function public.superadmin_projects()
returns table (id uuid, title text, updated_at timestamptz, revision integer, request_id uuid, status text, shared_revision integer, is_owner boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_superadmin() then raise exception 'Nur Superadministration'; end if;
  return query
    select c.id, c.title, c.updated_at, c.revision, r.id, r.status, r.shared_revision, c.owner_id = auth.uid()
    from public.configurations c
    left join public.project_access_requests r on r.project_id = c.id and r.requester_id = auth.uid()
    order by c.updated_at desc, c.id;
end $$;

create function public.request_project_access(p_project uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare recipient text;
begin
  if not public.is_superadmin() then raise exception 'Nur Superadministration'; end if;
  select u.email into recipient
    from public.configurations c join auth.users u on u.id = c.owner_id
    where c.id = p_project and c.owner_id <> auth.uid();
  if recipient is null then raise exception 'Projekt oder E-Mail-Adresse fehlt'; end if;

  insert into public.project_access_requests(project_id, requester_id)
    values (p_project, auth.uid())
    on conflict (project_id, requester_id) do update
      set status = 'pending', requested_at = now(), snapshot = null, shared_revision = null
      where project_access_requests.status in ('declined', 'revoked');
  return recipient;
end $$;

create function public.my_project_access_requests()
returns table (id uuid, title text, requested_at timestamptz, status text, revision integer, shared_revision integer)
language sql stable security definer set search_path = '' as $$
  select r.id, c.title, r.requested_at, r.status, c.revision, r.shared_revision
  from public.project_access_requests r join public.configurations c on c.id = r.project_id
  where c.owner_id = auth.uid() and r.status in ('pending', 'approved')
  order by r.requested_at desc, r.id
$$;

create function public.answer_project_access(p_request uuid, p_decision text, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_project public.configurations;
begin
  select c.* into current_project from public.configurations c
    join public.project_access_requests r on r.project_id = c.id
    where r.id = p_request and c.owner_id = auth.uid()
    for share of c;
  if not found then raise exception 'Keine eigene Freigabeanfrage'; end if;
  if p_decision = 'approved' and current_project.revision is distinct from p_revision then
    raise exception 'Der Projektstand wurde geändert. Lade die Seite erneut.';
  end if;
  if p_decision = 'approved' then
    update public.project_access_requests
      set status = 'approved', snapshot = current_project.payload, shared_revision = current_project.revision
      where id = p_request and status = 'pending';
  elsif p_decision = 'declined' then
    update public.project_access_requests set status = 'declined' where id = p_request and status = 'pending';
  elsif p_decision = 'revoked' then
    update public.project_access_requests
      set status = 'revoked', snapshot = null, shared_revision = null
      where id = p_request and status = 'approved';
  else raise exception 'Ungültige Entscheidung';
  end if;
  if not found then raise exception 'Anfrage bereits bearbeitet'; end if;
end $$;

create function public.read_approved_project(p_request uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare shared jsonb;
begin
  if not public.is_superadmin() then raise exception 'Nur Superadministration'; end if;
  select r.snapshot into shared from public.project_access_requests r
    where r.id = p_request and r.requester_id = auth.uid() and r.status = 'approved';
  if not found then raise exception 'Projektinhalt nicht freigegeben'; end if;
  return shared;
end $$;

revoke all on function
  public.is_superadmin(), public.superadmin_projects(), public.request_project_access(uuid),
  public.my_project_access_requests(), public.answer_project_access(uuid, text, integer),
  public.read_approved_project(uuid)
from public, anon, authenticated;
grant execute on function
  public.is_superadmin(), public.superadmin_projects(), public.request_project_access(uuid),
  public.my_project_access_requests(), public.answer_project_access(uuid, text, integer),
  public.read_approved_project(uuid)
to authenticated;
