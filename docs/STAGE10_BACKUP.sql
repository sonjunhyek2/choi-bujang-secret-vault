create schema if not exists vault_private;
revoke all on schema vault_private from public, anon, authenticated;
grant usage on schema vault_private to service_role;
create table vault_private.note_backups (
  id uuid primary key, owner_id uuid not null, title text not null, body text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create table vault_private.recovery_audit (
  id uuid primary key default gen_random_uuid(), note_id uuid not null,
  owner_id uuid not null, content_hash text not null, restored_at timestamptz not null default now()
);
alter table vault_private.note_backups enable row level security;
alter table vault_private.recovery_audit enable row level security;
revoke all on vault_private.note_backups, vault_private.recovery_audit from public, anon, authenticated, service_role;
grant select, insert on vault_private.note_backups, vault_private.recovery_audit to service_role;

create function public.note_backup_digest(p_id uuid,p_owner uuid,p_title text,p_body text)
returns text language sql immutable strict security invoker set search_path=''
as $$ select encode(extensions.digest(p_id::text||'|'||p_owner::text||'|'||octet_length(p_title)::text||':'||p_title||octet_length(p_body)::text||':'||p_body,'sha256'),'hex') $$;

create function public.create_note_with_backup(p_id uuid,p_owner uuid,p_title text,p_body text)
returns void language plpgsql security invoker set search_path=''
as $$ begin
  insert into public.notes(id,owner_id,title,body) values(p_id,p_owner,p_title,p_body);
  insert into vault_private.note_backups(id,owner_id,title,body,content_hash)
    values(p_id,p_owner,p_title,p_body,public.note_backup_digest(p_id,p_owner,p_title,p_body));
end $$;

create function public.get_note_backup(p_id uuid,p_owner uuid)
returns table(id uuid,owner_id uuid,title text,body text,content_hash text,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$ select b.id,b.owner_id,b.title,b.body,b.content_hash,b.created_at from vault_private.note_backups b where b.id=p_id and b.owner_id=p_owner $$;

create function public.restore_note_backup(p_id uuid,p_owner uuid,p_expected_hash text)
returns table(id uuid,title text,body text)
language plpgsql security invoker set search_path=''
as $$ declare b vault_private.note_backups%rowtype; existing_owner uuid; affected integer;
begin
  select * into b from vault_private.note_backups n where n.id=p_id and n.owner_id=p_owner for share;
  if not found then return; end if;
  if b.content_hash<>p_expected_hash or b.content_hash<>public.note_backup_digest(b.id,b.owner_id,b.title,b.body) then
    raise exception using errcode='22000',message='BACKUP_INTEGRITY_FAILED';
  end if;
  select n.owner_id into existing_owner from public.notes n where n.id=p_id for update;
  if found and existing_owner<>p_owner then raise exception using errcode='42501',message='OWNER_MISMATCH'; end if;
  insert into public.notes as n(id,owner_id,title,body) values(b.id,b.owner_id,b.title,b.body)
    on conflict on constraint notes_pkey do update set title=excluded.title,body=excluded.body where n.owner_id=p_owner;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception using errcode='42501',message='OWNER_MISMATCH'; end if;
  insert into vault_private.recovery_audit(note_id,owner_id,content_hash) values(b.id,b.owner_id,b.content_hash);
  return query select n.id,n.title,n.body from public.notes n where n.id=p_id and n.owner_id=p_owner;
end $$;

revoke all on function public.note_backup_digest(uuid,uuid,text,text),public.create_note_with_backup(uuid,uuid,text,text),public.get_note_backup(uuid,uuid),public.restore_note_backup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.note_backup_digest(uuid,uuid,text,text),public.create_note_with_backup(uuid,uuid,text,text),public.get_note_backup(uuid,uuid),public.restore_note_backup(uuid,uuid,text) to service_role;
