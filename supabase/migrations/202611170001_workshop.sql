-- Run once in a new Supabase project. No provider credentials in this migration.
create table public.admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create policy admins_self on public.admins for select to authenticated using(user_id=auth.uid());

create table public.app_settings(id boolean primary key default true check(id), value jsonb not null default '{"maxInhalt":3,"maxWiss":3,"cardsPerMechanism":3,"hourlyLimit":10,"models":{"openai":"","anthropic":"","gemini":""}}');
insert into public.app_settings(id) values(true);
alter table public.app_settings enable row level security;
create policy settings_read on public.app_settings for select to anon,authenticated using(true);
create policy settings_admin on public.app_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());

create table public.configurations(id uuid primary key, owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, revision integer not null check(revision>0), title text not null check(length(title)<=300), payload jsonb not null check(octet_length(payload::text)<200000), updated_at timestamptz not null default now());
alter table public.configurations enable row level security;
create policy configurations_own on public.configurations for select to authenticated using(owner_id=auth.uid());
create policy configurations_delete on public.configurations for delete to authenticated using(owner_id=auth.uid());
-- Writes use an optimistic concurrency RPC. No arbitrary owner/role changes.
create function public.save_configuration(p_id uuid,p_revision integer,p_title text,p_payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare current_row public.configurations; next_revision integer;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into current_row from public.configurations where id=p_id;
  if found then
    if current_row.owner_id<>auth.uid() then raise exception 'Kein Zugriff'; end if;
    if current_row.revision<>p_revision then raise exception 'Der Online-Stand wurde geändert. Bitte erneut laden, bevor du speicherst.'; end if;
    next_revision:=current_row.revision+1;
    update public.configurations set revision=next_revision,title=p_title,payload=p_payload,updated_at=now() where id=p_id;
  else
    if p_revision<>0 then raise exception 'Der Online-Stand wurde gelöscht. Als neuen Entwurf speichern.'; end if;
    next_revision:=1;
    insert into public.configurations(id,revision,title,payload) values(p_id,next_revision,p_title,p_payload);
  end if;
  return next_revision;
end $$;
revoke all on function public.save_configuration(uuid,integer,text,jsonb) from public;
grant execute on function public.save_configuration(uuid,integer,text,jsonb) to authenticated;

create table public.workshops(id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 200), join_code text unique not null check(length(join_code) between 16 and 80), active boolean not null default true, central_ai boolean not null default false, generation_limit integer not null default 100 check(generation_limit between 1 and 10000), created_at timestamptz not null default now());
create table public.workshop_members(workshop_id uuid references public.workshops on delete cascade,user_id uuid references auth.users on delete cascade,primary key(workshop_id,user_id));
alter table public.workshops enable row level security;
alter table public.workshop_members enable row level security;
-- join_code is not exposed through the participant API. View below omits it.
create policy workshops_admin on public.workshops for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy members_self on public.workshop_members for select to authenticated using(user_id=auth.uid() or public.is_admin());
create function public.my_workshops() returns table(id uuid,title text,active boolean,central_ai boolean) language sql stable security definer set search_path='' as $$
 select w.id,w.title,w.active,w.central_ai from public.workshops w where exists(select 1 from public.workshop_members m where m.workshop_id=w.id and m.user_id=auth.uid()) or public.is_admin()
$$;
create function public.join_workshop(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare workshop uuid;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 if length(p_code)>80 then raise exception 'Ungültiger Workshop-Code'; end if;
 select id into workshop from public.workshops where join_code=trim(p_code) and active;
 if workshop is null then raise exception 'Workshop-Code ungültig oder Workshop geschlossen'; end if;
 insert into public.workshop_members values(workshop,auth.uid()) on conflict do nothing;
 return workshop;
end $$;
revoke all on function public.my_workshops(),public.join_workshop(text) from public;
grant execute on function public.my_workshops(),public.join_workshop(text) to authenticated;

create table public.submissions(id uuid primary key default gen_random_uuid(),workshop_id uuid not null references public.workshops on delete cascade,owner_id uuid not null default auth.uid() references auth.users on delete cascade,title text not null,payload jsonb not null check(octet_length(payload::text)<200000),status text not null default 'eingereicht' check(status in ('eingereicht','gesichtet')),created_at timestamptz not null default now());
alter table public.submissions enable row level security;
create policy submissions_read on public.submissions for select to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy submissions_delete on public.submissions for delete to authenticated using(owner_id=auth.uid());
create function public.submit_configuration(p_workshop uuid,p_configuration uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.configurations; result_id uuid;
begin
 if not exists(select 1 from public.workshops w where w.id=p_workshop and w.active and (public.is_admin() or exists(select 1 from public.workshop_members m where m.workshop_id=w.id and m.user_id=auth.uid()))) then raise exception 'Keine aktive Workshop-Mitgliedschaft'; end if;
 select * into c from public.configurations where id=p_configuration and owner_id=auth.uid();
 if not found or c.payload->'result' is null or c.payload->'result'='null'::jsonb then raise exception 'Zuerst ein Arbeitsblatt erstellen und online speichern'; end if;
 insert into public.submissions(workshop_id,title,payload) values(p_workshop,c.title,c.payload) returning id into result_id;
 return result_id;
end $$;
create function public.review_submission(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'Nur Administration'; end if; update public.submissions set status='gesichtet' where id=p_id; end $$;
revoke all on function public.submit_configuration(uuid,uuid),public.review_submission(uuid) from public;
grant execute on function public.submit_configuration(uuid,uuid),public.review_submission(uuid) to authenticated;

-- Encrypted AES-GCM values, decryptable only by Edge Functions with the deployment key.
create table public.provider_credentials(provider text primary key check(provider in ('openai','anthropic','gemini')),ciphertext text not null,iv text not null,updated_at timestamptz not null default now());
alter table public.provider_credentials enable row level security;
-- No user policies: only service_role may access ciphertext.

create table public.generation_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,workshop_id uuid references public.workshops on delete cascade,created_at timestamptz not null default now());
alter table public.generation_attempts enable row level security;
create index generation_user_time on public.generation_attempts(user_id,created_at);
create index generation_workshop on public.generation_attempts(workshop_id);
create function public.reserve_generation(p_user uuid,p_workshop uuid,p_hourly integer) returns void language plpgsql security definer set search_path='' as $$
declare w public.workshops;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
 if (select count(*) from public.generation_attempts where user_id=p_user and created_at>now()-interval '1 hour')>=p_hourly then raise exception 'Stundenlimit erreicht. Bitte später erneut versuchen.'; end if;
 if p_workshop is not null then
   perform pg_advisory_xact_lock(hashtextextended(p_workshop::text,2));
   select * into w from public.workshops where id=p_workshop;
   if not found or not w.active or not w.central_ai or not exists(select 1 from public.workshop_members where workshop_id=p_workshop and user_id=p_user) then raise exception 'Workshop-KI ist für diesen Zugang nicht freigeschaltet.'; end if;
   if (select count(*) from public.generation_attempts where workshop_id=p_workshop)>=w.generation_limit then raise exception 'Das Generierungslimit dieses Workshops ist erreicht.'; end if;
 end if;
 insert into public.generation_attempts(user_id,workshop_id) values(p_user,p_workshop);
end $$;
revoke all on function public.reserve_generation(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,uuid,integer) to service_role;
