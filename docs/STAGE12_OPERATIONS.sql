create index if not exists note_backups_owner_idx on vault_private.note_backups(owner_id);
create index if not exists recovery_audit_owner_at_idx on vault_private.recovery_audit(owner_id,restored_at desc);
create function public.get_operations_snapshot(p_owner uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select jsonb_build_object(
  'backupCount',(select count(*) from vault_private.note_backups b where b.owner_id=p_owner),
  'recoveryCount',(select count(*) from vault_private.recovery_audit a where a.owner_id=p_owner),
  'lastRecovery',(select jsonb_build_object('contentHash',a.content_hash,'at',a.restored_at) from vault_private.recovery_audit a where a.owner_id=p_owner order by a.restored_at desc limit 1),
  'deviceRequests',(select jsonb_build_object('pending',count(*) filter(where r.status='pending'),'approved',count(*) filter(where r.status='approved'),'revoked',count(*) filter(where r.status='revoked')) from vault_private.browser_device_requests r where r.owner_id=p_owner)
) $$;
revoke all on function public.get_operations_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_operations_snapshot(uuid) to service_role;
