-- Stage 4: only this learning table is changed. Keep the stage-2 archive intact.
revoke all on table public.notes from public, anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;
revoke all on table public.notes from service_role;
grant select, insert, update, delete on table public.notes to service_role;
alter table public.notes enable row level security;
create policy notes_select_owner on public.notes for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy notes_insert_owner on public.notes for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy notes_update_owner on public.notes for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy notes_delete_owner on public.notes for delete to authenticated
  using ((select auth.uid()) = owner_id);
