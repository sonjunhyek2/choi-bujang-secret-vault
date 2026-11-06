create table vault_private.browser_device_requests (
  owner_id uuid not null, request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check(status in ('pending','approved','revoked')),
  requested_at timestamptz not null default now(), primary key(owner_id,request_hash)
);
alter table vault_private.browser_device_requests enable row level security;
revoke all on vault_private.browser_device_requests from public,anon,authenticated,service_role;
grant select,insert on vault_private.browser_device_requests to service_role;
create function public.get_browser_device_request(p_owner uuid,p_hash text)
returns table(status text,requested_at timestamptz) language sql stable security invoker set search_path=''
as $$ select r.status,r.requested_at from vault_private.browser_device_requests r where r.owner_id=p_owner and r.request_hash=p_hash $$;
create function public.request_browser_device(p_owner uuid,p_hash text)
returns table(status text,requested_at timestamptz) language plpgsql security invoker set search_path=''
as $$ begin
  insert into vault_private.browser_device_requests(owner_id,request_hash) values(p_owner,p_hash) on conflict do nothing;
  return query select r.status,r.requested_at from vault_private.browser_device_requests r where r.owner_id=p_owner and r.request_hash=p_hash;
end $$;
revoke all on function public.get_browser_device_request(uuid,text),public.request_browser_device(uuid,text) from public,anon,authenticated;
grant execute on function public.get_browser_device_request(uuid,text),public.request_browser_device(uuid,text) to service_role;
-- No app route or server-role UPDATE privilege can approve its own request.
-- An authorized database operator reviews the pending row separately.
revoke insert on vault_private.browser_device_requests from service_role;
grant insert(owner_id,request_hash) on vault_private.browser_device_requests to service_role;
