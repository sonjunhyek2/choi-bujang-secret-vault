-- Only the learning notes table; service_role CRUD and owner RLS are preserved.
revoke all on table public.notes from public, anon, authenticated;
