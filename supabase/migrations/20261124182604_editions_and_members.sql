-- Preserve the current public catalogue and the settings API used by older clients.
create table public.content_editions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 100),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 120000),
  revision uuid not null default gen_random_uuid()
);
create unique index content_editions_title_idx on public.content_editions(lower(trim(title)));
alter table public.content_editions enable row level security;
revoke all on public.content_editions from public, anon, authenticated;
grant select on public.content_editions to authenticated;
create policy editorial_admin_read on public.content_editions for select to authenticated using ((select public.is_admin()));

alter table public.app_settings add column default_edition_id uuid references public.content_editions(id);
with seed as (
  insert into public.content_editions(title,content,revision)
  select '7’rizons', content, content_revision from public.app_settings returning id
) update public.app_settings set default_edition_id = seed.id from seed;
alter table public.app_settings alter column default_edition_id set not null;
alter table public.workshops add column edition_id uuid references public.content_editions(id);
create index workshops_edition_idx on public.workshops(edition_id);

-- All publishing and default changes lock the same settings row first.
-- Legacy editors still publish into the currently selected default.
create function public.sync_default_edition() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.content_editions set content=new.content, revision=new.content_revision where id=new.default_edition_id;
  return new;
end $$;
revoke all on function public.sync_default_edition() from public, anon, authenticated;
create trigger sync_default_edition after update of content,content_revision on public.app_settings
  for each row execute function public.sync_default_edition();

create function public.copy_content_edition(p_source uuid,p_revision uuid,p_title text) returns uuid
language plpgsql security definer set search_path='' as $$
declare copied uuid;
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  insert into public.content_editions(title,content)
    select trim(p_title),content from public.content_editions where id=p_source and revision=p_revision returning id into copied;
  if copied is null then raise exception 'Die Inhaltsfassung wurde inzwischen geändert.'; end if;
  return copied;
exception when unique_violation then raise exception 'Dieser Name ist bereits vergeben.';
end $$;

create function public.publish_content_edition(p_id uuid,p_revision uuid,p_title text,p_content jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_default uuid; next_revision uuid := gen_random_uuid();
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  select default_edition_id into strict current_default from public.app_settings where id for update;
  update public.content_editions set title=trim(p_title),content=p_content,revision=next_revision where id=p_id and revision=p_revision;
  if not found then raise exception 'Die Inhaltsfassung wurde inzwischen geändert.'; end if;
  if current_default=p_id then update public.app_settings set content=p_content,content_revision=next_revision where id; end if;
  return next_revision;
exception when unique_violation then raise exception 'Dieser Name ist bereits vergeben.';
end $$;

create function public.choose_default_edition(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  perform 1 from public.app_settings where id for update;
  update public.app_settings s set default_edition_id=e.id,content=e.content,content_revision=e.revision
    from public.content_editions e where s.id and e.id=p_id;
  if not found then raise exception 'Unbekannte Inhaltsfassung'; end if;
end $$;

create function public.workshop_content(p_workshop uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  select e.content into result from public.workshops w cross join public.app_settings s
  join public.content_editions e on true
  where e.id=coalesce(w.edition_id,s.default_edition_id) and w.id=p_workshop and w.active
    and (public.is_admin() or exists(select from public.workshop_members m where m.workshop_id=w.id and m.user_id=auth.uid()));
  if not found then raise exception 'Keine aktive Workshop-Mitgliedschaft'; end if;
  return result;
end $$;

create function public.workshop_roster(p_workshop uuid) returns table(email text, moderator boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (public.is_admin() or public.is_workshop_moderator(p_workshop)) then raise exception 'Nur Moderation dieses Workshops'; end if;
  return query select u.email::text, bool_or(person.moderator)
    from (select m.user_id, false as moderator from public.workshop_members m where m.workshop_id=p_workshop
          union all select m.user_id,true from public.workshop_moderators m where m.workshop_id=p_workshop) person
    join auth.users u on u.id=person.user_id group by u.id,u.email order by u.email,u.id;
end $$;
create function public.set_roster_role(p_workshop uuid,p_email text,p_role text) returns void
language plpgsql security definer set search_path='' as $$
declare person uuid;
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  if p_role is null or p_role not in ('add','member','moderator','remove') then raise exception 'Ungültige Rolle'; end if;
  select id into person from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null for update;
  if not found then raise exception 'Kein bestätigtes Konto mit dieser E-Mail-Adresse'; end if;
  if p_role='remove' then
    delete from public.workshop_members where workshop_id=p_workshop and user_id=person;
  else
    insert into public.workshop_members values(p_workshop,person) on conflict do nothing;
  end if;
  if p_role='moderator' then
    insert into public.workshop_moderators values(p_workshop,person) on conflict do nothing;
  elsif p_role<>'add' then
    delete from public.workshop_moderators where workshop_id=p_workshop and user_id=person;
  end if;
end $$;
create function public.account_directory(p_search text,p_offset integer) returns table(user_id uuid,email text,account_role text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Nur Superadministration'; end if;
  return query select u.id,u.email::text,case when s.user_id is not null then 'superadmin' when a.user_id is not null then 'admin' else 'member' end
    from auth.users u left join public.admins a on a.user_id=u.id left join public.superadmins s on s.user_id=u.id
    where u.email_confirmed_at is not null and strpos(lower(u.email),lower(trim(coalesce(p_search,''))))>0
    order by u.email,u.id limit 51 offset greatest(p_offset,0);
end $$;
create function public.set_account_admin(p_user uuid,p_admin boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Nur Superadministration'; end if;
  perform 1 from auth.users where id=p_user and email_confirmed_at is not null for update;
  if not found then raise exception 'Kein bestätigtes Konto mit dieser E-Mail-Adresse'; end if;
  if exists(select from public.superadmins where user_id=p_user) then raise exception 'Geschützte Superadministration'; end if;
  if p_admin then insert into public.admins values(p_user) on conflict do nothing;
  else delete from public.admins where user_id=p_user; end if;
end $$;
revoke all on function public.copy_content_edition(uuid,uuid,text),public.publish_content_edition(uuid,uuid,text,jsonb),
  public.choose_default_edition(uuid),public.workshop_content(uuid),public.workshop_roster(uuid),
  public.set_roster_role(uuid,text,text),public.account_directory(text,integer),public.set_account_admin(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.copy_content_edition(uuid,uuid,text),public.publish_content_edition(uuid,uuid,text,jsonb),
  public.choose_default_edition(uuid),public.workshop_content(uuid),public.workshop_roster(uuid),
  public.set_roster_role(uuid,text,text),public.account_directory(text,integer),public.set_account_admin(uuid,boolean)
  to authenticated;
