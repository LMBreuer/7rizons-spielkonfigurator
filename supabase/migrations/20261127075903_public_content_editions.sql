alter table public.content_editions add column is_public boolean not null default false;
update public.content_editions set is_public = true
where id = (select default_edition_id from public.app_settings where id);

grant select (id, title, content, revision, is_public) on public.content_editions to anon;
create policy public_edition_read on public.content_editions
  for select to anon, authenticated using (is_public);

-- The default pointer can only change through choose_default_edition.
revoke update on public.app_settings from public, anon, authenticated;
grant update (value, content, content_revision) on public.app_settings to authenticated;

create function public.set_edition_visibility(p_id uuid, p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare current_default uuid;
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  select default_edition_id into strict current_default from public.app_settings where id for update;
  if p_public is not true and p_id = current_default then
    raise exception 'Die Standardfassung muss öffentlich sein.';
  end if;
  update public.content_editions set is_public = (p_public is true) where id = p_id;
  if not found then raise exception 'Unbekannte Inhaltsfassung'; end if;
end $$;
revoke all on function public.set_edition_visibility(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_edition_visibility(uuid,boolean) to authenticated;

create or replace function public.choose_default_edition(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Nur Administration'; end if;
  perform 1 from public.app_settings where id for update;
  update public.content_editions set is_public = true where id = p_id;
  if not found then raise exception 'Unbekannte Inhaltsfassung'; end if;
  update public.app_settings s set default_edition_id = e.id, content = e.content, content_revision = e.revision
    from public.content_editions e where s.id and e.id = p_id;
end $$;
revoke all on function public.choose_default_edition(uuid) from public, anon, authenticated;
grant execute on function public.choose_default_edition(uuid) to authenticated;

create function public.workshop_edition(p_workshop uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('id', e.id, 'title', e.title, 'content', e.content)
    into result
    from public.workshops w cross join public.app_settings s
    join public.content_editions e on true
    where e.id = coalesce(w.edition_id, s.default_edition_id) and w.id = p_workshop and w.active
      and (public.is_admin() or exists (
        select from public.workshop_members m where m.workshop_id = w.id and m.user_id = auth.uid()
      ));
  if not found then raise exception 'Keine aktive Workshop-Mitgliedschaft'; end if;
  return result;
end $$;
revoke all on function public.workshop_edition(uuid) from public, anon, authenticated;
grant execute on function public.workshop_edition(uuid) to authenticated;

-- Preserve clients that expect just the workshop catalogue.
create or replace function public.workshop_content(p_workshop uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select public.workshop_edition(p_workshop) -> 'content';
$$;
revoke all on function public.workshop_content(uuid) from public, anon, authenticated;
grant execute on function public.workshop_content(uuid) to authenticated;
