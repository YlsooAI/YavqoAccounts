-- Connected apps ("websites and apps you have authorized").
-- Run once in the Supabase SQL editor. Idempotent.

create table if not exists public.id_oauth_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null
    references public.id_oauth_clients (client_id) on delete cascade,
  site_title text not null,
  site_url text not null,
  site_host text not null,
  scope text not null default 'openid profile email',
  granted_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists id_oauth_authorizations_user_idx
  on public.id_oauth_authorizations (user_id, last_used_at desc);

alter table public.id_oauth_authorizations enable row level security;

revoke all on table public.id_oauth_authorizations from anon;
grant select, insert, update, delete on table public.id_oauth_authorizations to authenticated;

drop policy if exists "Users can read own authorizations" on public.id_oauth_authorizations;
create policy "Users can read own authorizations"
  on public.id_oauth_authorizations for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own authorizations" on public.id_oauth_authorizations;
create policy "Users can insert own authorizations"
  on public.id_oauth_authorizations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own authorizations" on public.id_oauth_authorizations;
create policy "Users can update own authorizations"
  on public.id_oauth_authorizations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can revoke own authorizations" on public.id_oauth_authorizations;
create policy "Users can revoke own authorizations"
  on public.id_oauth_authorizations for delete
  to authenticated
  using ((select auth.uid()) = user_id);
