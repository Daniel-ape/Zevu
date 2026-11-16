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

-- ── Feedback from the app ("Wrong price?" and "Send feedback") ─────────────
-- Anyone using the app may add a row; nobody can read rows through the app.
-- You read them in Supabase → Table Editor → feedback.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('price', 'picture', 'name', 'other', 'general')),
  product_id text check (char_length(product_id) <= 64),
  product_name text check (char_length(product_name) <= 200),
  message text not null default '' check (char_length(message) <= 2000),
  app text check (char_length(app) <= 80)
);
alter table public.feedback enable row level security;
drop policy if exists "anyone can send" on public.feedback;
create policy "anyone can send" on public.feedback for insert to anon, authenticated with check (true);
revoke select, update, delete on public.feedback from anon, authenticated;

-- ── Shared shopping lists ────────────────────────────────────────────────
-- A list shared with family: everyone who has its code can read and change it.
-- The table itself is closed; the app only goes through the two functions
-- below, which need the (long, random) code. version counts the changes, so
-- two phones never overwrite each other unnoticed.
create table if not exists public.shared_lists (
  code text primary key check (char_length(code) between 8 and 16),
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.shared_lists enable row level security;

create or replace function public.share_list_get(p_code text)
returns table (data jsonb, version int)
language sql security definer set search_path = public as $$
  select s.data, s.version from public.shared_lists s where s.code = p_code;
$$;

-- Saves the list if p_base is the version the phone last saw (0 = new list).
-- Returns the new version, or -1 when someone else changed it in between.
create or replace function public.share_list_put(p_code text, p_data jsonb, p_base int)
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if pg_column_size(p_data) > 200000 then raise exception 'list too large'; end if;
  if p_base = 0 then
    insert into public.shared_lists (code, data) values (p_code, p_data)
      on conflict (code) do nothing;
    if not found then return -1; end if;
    return 1;
  end if;
  update public.shared_lists set data = p_data, version = version + 1, updated_at = now()
    where code = p_code and version = p_base
    returning version into v;
  return coalesce(v, -1);
end;
$$;
revoke all on function public.share_list_get(text) from public;
revoke all on function public.share_list_put(text, jsonb, int) from public;
grant execute on function public.share_list_get(text) to anon, authenticated;
grant execute on function public.share_list_put(text, jsonb, int) to anon, authenticated;
