create table public.workshop_moderators (
  workshop_id uuid references public.workshops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (workshop_id, user_id)
);
create table public.workshop_projects (
  workshop_id uuid references public.workshops(id) on delete cascade,
  project_id uuid references public.configurations(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (workshop_id, project_id)
);
alter table public.workshop_moderators enable row level security;
alter table public.workshop_projects enable row level security;
revoke all on public.workshop_moderators, public.workshop_projects from public, anon, authenticated;
create index workshop_moderators_user_idx on public.workshop_moderators(user_id);
create index workshop_projects_project_idx on public.workshop_projects(project_id);

create function public.is_workshop_moderator(p_workshop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select from public.workshop_moderators where workshop_id = p_workshop and user_id = auth.uid())
$$;

create function public.my_moderated_workshops()
returns table(id uuid, title text, active boolean, join_code text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.active, w.join_code
  from public.workshops w join public.workshop_moderators m on m.workshop_id = w.id
  where m.user_id = auth.uid() order by w.title, w.id
$$;

create function public.list_workshop_moderators(p_workshop uuid)
returns table(user_id uuid, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  return query select m.user_id, u.email::text
    from public.workshop_moderators m join auth.users u on u.id = m.user_id
    where m.workshop_id = p_workshop order by u.email, m.user_id;
end $$;

create function public.set_workshop_moderator(p_workshop uuid, p_email text, p_add boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare identity uuid;
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  select u.id into identity from auth.users u
    where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null;
  if identity is null then raise exception 'Kein bestätigtes Konto mit dieser E-Mail-Adresse'; end if;
  if p_add then
    insert into public.workshop_moderators values (p_workshop, identity) on conflict do nothing;
  else
    delete from public.workshop_moderators where workshop_id = p_workshop and user_id = identity;
  end if;
end $$;

create function public.set_workshop_project(p_workshop uuid, p_project uuid, p_link boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select from public.configurations where id = p_project and owner_id = auth.uid()) then
    raise exception 'Nur eigene Online-Projekte können zugeordnet werden';
  end if;
  if p_link then
    if not exists(select from public.workshops w join public.workshop_members m on m.workshop_id = w.id
      where w.id = p_workshop and w.active and m.user_id = auth.uid()) then
      raise exception 'Keine aktive Workshop-Mitgliedschaft';
    end if;
    insert into public.workshop_projects(workshop_id, project_id) values (p_workshop, p_project) on conflict do nothing;
  else
    delete from public.workshop_projects where workshop_id = p_workshop and project_id = p_project;
  end if;
end $$;

create function public.my_workshop_project_links(p_project uuid)
returns table(workshop_id uuid, title text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title from public.workshop_projects p
    join public.workshops w on w.id = p.workshop_id
    join public.configurations c on c.id = p.project_id
  where p.project_id = p_project and c.owner_id = auth.uid()
  order by w.title, w.id
$$;

create function public.list_workshop_projects(p_workshop uuid)
returns table(id uuid, title text, updated_at timestamptz, linked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.is_workshop_moderator(p_workshop)) then
    raise exception 'Nur Moderation dieses Workshops';
  end if;
  return query select c.id, c.title, c.updated_at, p.linked_at
    from public.workshop_projects p join public.configurations c on c.id = p.project_id
    where p.workshop_id = p_workshop order by c.updated_at desc, c.id;
end $$;

create policy submissions_workshop_moderator on public.submissions for select to authenticated
using (public.is_workshop_moderator(workshop_id));
create or replace function public.review_submission(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.submissions set status = 'gesichtet' where id = p_id
    and (public.is_admin() or public.is_workshop_moderator(workshop_id));
  if not found then raise exception 'Nur Administration oder Moderation dieses Workshops'; end if;
end $$;

revoke all on function
  public.is_workshop_moderator(uuid), public.my_moderated_workshops(), public.list_workshop_moderators(uuid),
  public.set_workshop_moderator(uuid, text, boolean), public.set_workshop_project(uuid, uuid, boolean),
  public.my_workshop_project_links(uuid), public.list_workshop_projects(uuid)
from public, anon, authenticated;
grant execute on function
  public.is_workshop_moderator(uuid), public.my_moderated_workshops(), public.list_workshop_moderators(uuid),
  public.set_workshop_moderator(uuid, text, boolean), public.set_workshop_project(uuid, uuid, boolean),
  public.my_workshop_project_links(uuid), public.list_workshop_projects(uuid)
to authenticated;
