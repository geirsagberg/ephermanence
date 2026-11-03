-- Disposable spike table. Run in a development project's SQL editor.
create table public.secure_sync_probes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fixture jsonb not null
);

alter table public.secure_sync_probes enable row level security;
revoke all on public.secure_sync_probes from anon, authenticated;
grant select, insert, update, delete on public.secure_sync_probes to authenticated;

create policy "Users manage their own probe"
  on public.secure_sync_probes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
