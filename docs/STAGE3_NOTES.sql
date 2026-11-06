-- Initial notes schema used before the stage-4/5 policies and stage-10 backup.
create table public.notes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  title text not null check(char_length(title) between 1 and 200),
  body text not null check(char_length(body)<=10000),
  created_at timestamptz not null default now()
);
create index notes_owner_created_idx on public.notes(owner_id,created_at desc);
alter table public.notes enable row level security;
revoke all on public.notes from public,anon,authenticated;
grant select,insert,update,delete on public.notes to service_role;
