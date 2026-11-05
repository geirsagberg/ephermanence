-- One end-to-end encrypted space per account. The backend sees only ciphertext.
create table public.synced_spaces (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  space_key jsonb not null,
  space jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.synced_spaces enable row level security;
revoke all on public.synced_spaces from anon, authenticated;
grant select, insert, update (revision, space, updated_at) on public.synced_spaces to authenticated;

create policy "Owners read their space"
  on public.synced_spaces for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners create their space"
  on public.synced_spaces for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners update their space"
  on public.synced_spaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
