-- Hintaopas: one row per signed-in user with their own lists, cards, coupons, receipts
-- and settings. Run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Each user can read and write only their own row. Nobody else (not even other
-- signed-in users) can see it; the public anon key alone gives no access at all.
drop policy if exists "own row: read" on public.user_data;
drop policy if exists "own row: insert" on public.user_data;
drop policy if exists "own row: update" on public.user_data;
drop policy if exists "own row: delete" on public.user_data;
create policy "own row: read"   on public.user_data for select using (auth.uid() = user_id);
create policy "own row: insert" on public.user_data for insert with check (auth.uid() = user_id);
create policy "own row: update" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.user_data for delete using (auth.uid() = user_id);

-- Lets a signed-in user delete their own account from the app (App Store and
-- GDPR: deletion must be possible in the app). Runs with the owner's rights,
-- but only ever on the caller's own user id. user_data goes with it (cascade).
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
