-- Hanil Workspace - run once in the Supabase SQL Editor
-- Public browser code must NEVER contain a secret key or service_role key.
create table if not exists public.user_workspace_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.user_workspace_state enable row level security;
grant select,insert,update on public.user_workspace_state to authenticated;
drop policy if exists "Users can read their own workspace" on public.user_workspace_state;
drop policy if exists "Users can insert their own workspace" on public.user_workspace_state;
drop policy if exists "Users can update their own workspace" on public.user_workspace_state;
create policy "Users can read their own workspace" on public.user_workspace_state
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own workspace" on public.user_workspace_state
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own workspace" on public.user_workspace_state
 for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Database-maintained roles; clients have NO direct table privileges.
create table if not exists public.workspace_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_at timestamptz not null default now()
);
alter table public.workspace_admins enable row level security;
revoke all on public.workspace_admins from anon, authenticated;

-- Public RPC is restricted to authenticated users and returns ONLY their own role.
create or replace function public.is_workspace_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
 select (select auth.uid()) is not null and
 exists(select 1 from public.workspace_admins a
        where a.user_id=(select auth.uid()));
$$;
revoke all on function public.is_workspace_admin() from public, anon;
grant execute on function public.is_workspace_admin() to authenticated;

create table if not exists public.workspace_shared_events (
 id uuid primary key default gen_random_uuid(),
 event_date date not null,
 start_time time without time zone,
 title text not null check (char_length(trim(title)) between 1 and 120),
 details text check (details is null or char_length(details) <= 2000),
 location text check (location is null or char_length(location) <= 120),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists workspace_shared_events_date_idx on public.workspace_shared_events(event_date);
alter table public.workspace_shared_events enable row level security;
grant select,insert,update,delete on public.workspace_shared_events to authenticated;
drop policy if exists "Authenticated can view shared events" on public.workspace_shared_events;
drop policy if exists "Admins create shared events" on public.workspace_shared_events;
drop policy if exists "Admins update shared events" on public.workspace_shared_events;
drop policy if exists "Admins delete shared events" on public.workspace_shared_events;
create policy "Authenticated can view shared events" on public.workspace_shared_events
 for select to authenticated using (true);
create policy "Admins create shared events" on public.workspace_shared_events
 for insert to authenticated
 with check (public.is_workspace_admin() and created_by=(select auth.uid()));
create policy "Admins update shared events" on public.workspace_shared_events
 for update to authenticated using (public.is_workspace_admin())
 with check (public.is_workspace_admin());
create policy "Admins delete shared events" on public.workspace_shared_events
 for delete to authenticated using (public.is_workspace_admin());

-- After signing up, appoint first administrator using your REAL registered email:
-- insert into public.workspace_admins(user_id)
-- select id from auth.users where email='YOUR_ADMIN_EMAIL@example.com'
-- on conflict(user_id) do nothing;
