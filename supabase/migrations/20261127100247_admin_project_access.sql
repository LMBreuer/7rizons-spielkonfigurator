alter table public.configurations add column admin_shared_at timestamptz;

create schema project_access_internal;
revoke all on schema project_access_internal from public, anon, authenticated;
grant usage on schema project_access_internal to authenticated;

create function project_access_internal.save_configuration(
  p_id uuid, p_revision integer, p_title text, p_payload jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  next_revision := public.save_configuration(p_id, p_revision, p_title, p_payload);
  update public.configurations
    set admin_shared_at = now()
    where id = p_id and owner_id = auth.uid() and admin_shared_at is null;
  return next_revision;
end $$;

create function project_access_internal.list_projects()
returns table (
  id uuid, title text, updated_at timestamptz, revision integer, request_id uuid,
  status text, shared_revision integer, is_owner boolean, admin_access boolean, workshop_ids uuid[]
)
language plpgsql stable security definer set search_path = '' as $$
declare can_request boolean := public.is_superadmin();
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  return query
    select c.id, c.title, c.updated_at, c.revision, r.id, r.status, r.shared_revision,
      c.owner_id = auth.uid(), c.admin_shared_at is not null,
      case when c.admin_shared_at is not null then array(
        select p.workshop_id from public.workshop_projects p where p.project_id = c.id
      ) else '{}'::uuid[] end
    from public.configurations c
    left join public.project_access_requests r on r.project_id = c.id and r.requester_id = auth.uid()
    where c.admin_shared_at is not null or c.owner_id = auth.uid() or can_request
    order by c.updated_at desc, c.id;
end $$;

create function project_access_internal.read_project(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare snapshot jsonb;
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  select c.payload into snapshot from public.configurations c
    where c.id = p_project and (c.admin_shared_at is not null or c.owner_id = auth.uid());
  if not found then raise exception 'Projektinhalt nicht freigegeben'; end if;
  return snapshot;
end $$;

create function project_access_internal.set_workshop_project(p_project uuid, p_workshop uuid, p_link boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  perform 1 from public.configurations
    where id = p_project and admin_shared_at is not null for key share;
  if not found then raise exception 'Projektinhalt nicht freigegeben'; end if;
  if p_link then
    perform 1 from public.workshops where id = p_workshop and active for share;
    if not found then raise exception 'Workshop geschlossen oder nicht verfügbar'; end if;
    insert into public.workshop_projects(workshop_id, project_id)
      values (p_workshop, p_project) on conflict do nothing;
  else
    delete from public.workshop_projects where workshop_id = p_workshop and project_id = p_project;
  end if;
end $$;

create function public.save_configuration_for_administration(
  p_id uuid, p_revision integer, p_title text, p_payload jsonb
) returns integer language sql security invoker set search_path = '' as $$
  select project_access_internal.save_configuration(p_id, p_revision, p_title, p_payload);
$$;

create function public.admin_projects()
returns table (
  id uuid, title text, updated_at timestamptz, revision integer, request_id uuid,
  status text, shared_revision integer, is_owner boolean, admin_access boolean, workshop_ids uuid[]
)
language sql stable security invoker set search_path = '' as $$
  select * from project_access_internal.list_projects() order by updated_at desc, id;
$$;

create function public.read_admin_project(p_project uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select project_access_internal.read_project(p_project);
$$;

create function public.admin_set_workshop_project(p_project uuid, p_workshop uuid, p_link boolean)
returns void language sql security invoker set search_path = '' as $$
  select project_access_internal.set_workshop_project(p_project, p_workshop, p_link);
$$;

revoke all on all functions in schema project_access_internal from public, anon, authenticated;
grant execute on all functions in schema project_access_internal to authenticated;
revoke all on function
  public.save_configuration_for_administration(uuid, integer, text, jsonb), public.admin_projects(),
  public.read_admin_project(uuid), public.admin_set_workshop_project(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function
  public.save_configuration_for_administration(uuid, integer, text, jsonb), public.admin_projects(),
  public.read_admin_project(uuid), public.admin_set_workshop_project(uuid, uuid, boolean)
to authenticated;
