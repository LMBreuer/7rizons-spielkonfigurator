-- Collections of worksheets share one private configuration record.
alter table public.configurations drop constraint if exists configurations_payload_check;
alter table public.configurations add constraint configurations_payload_check check(octet_length(payload::text)<2000000);
alter table public.submissions drop constraint if exists submissions_payload_check;
alter table public.submissions add constraint submissions_payload_check check(octet_length(payload::text)<2000000);

-- Explicit submission shares the selected worksheet, never the private version collection.
create or replace function public.submit_configuration(p_workshop uuid,p_configuration uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.configurations; result_id uuid; shared_payload jsonb;
begin
 if not exists(select 1 from public.workshops w where w.id=p_workshop and w.active and (public.is_admin() or exists(select 1 from public.workshop_members m where m.workshop_id=w.id and m.user_id=auth.uid()))) then raise exception 'Keine aktive Workshop-Mitgliedschaft'; end if;
 select * into c from public.configurations where id=p_configuration and owner_id=auth.uid();
 if not found or c.payload->'result' is null or c.payload->'result'='null'::jsonb then raise exception 'Zuerst ein aktuelles Arbeitsblatt auswählen und online speichern'; end if;
 shared_payload:=jsonb_build_object('draft',c.payload->'draft','result',c.payload->'result','request',c.payload->'request','source',c.payload->'source','resultSettings',c.payload->'resultSettings');
 insert into public.submissions(workshop_id,title,payload) values(p_workshop,c.title,shared_payload) returning id into result_id;
 return result_id;
end $$;
