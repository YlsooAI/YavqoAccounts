-- YavqoID avatar setup — run once in the Supabase SQL editor.
-- Creates the public "avatars" storage bucket and the RLS policies the
-- app needs to read/write profile avatars. Idempotent: safe to re-run.

-- 1) Public bucket so avatar URLs are loadable without auth.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2) Storage policies: anyone can read avatars; users can only write
--    inside their own folder (avatars/<user-id>/...).
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists "Users can replace their own avatar" on storage.objects;
create policy "Users can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 3) profiles RLS: users can only see/modify their own row.
alter table public.profiles enable row level security;

-- Postgres grants are checked before RLS. Grant the authenticated role the
-- operations used by the app, then let the owner-only policies below decide
-- which rows are accessible. This also repairs projects where automatic Data
-- API grants are disabled and PostgREST reports "permission denied for view
-- profiles".
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- 4) Yavqo Password manager: per-user saved passwords.
--    NOTE: passwords are stored as-is and protected by RLS (owner only).
--    For production, add client-side encryption before storing.
create table if not exists public.saved_passwords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  site_name text not null,
  site_url text,
  username text not null,
  password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_passwords enable row level security;

drop policy if exists "Users can read own passwords" on public.saved_passwords;
create policy "Users can read own passwords"
  on public.saved_passwords for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own passwords" on public.saved_passwords;
create policy "Users can insert own passwords"
  on public.saved_passwords for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own passwords" on public.saved_passwords;
create policy "Users can update own passwords"
  on public.saved_passwords for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own passwords" on public.saved_passwords;
create policy "Users can delete own passwords"
  on public.saved_passwords for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 5) Contacts & sharing: per-user contact list.
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

drop policy if exists "Users can read own contacts" on public.contacts;
create policy "Users can read own contacts"
  on public.contacts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own contacts" on public.contacts;
create policy "Users can insert own contacts"
  on public.contacts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own contacts" on public.contacts;
create policy "Users can update own contacts"
  on public.contacts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own contacts" on public.contacts;
create policy "Users can delete own contacts"
  on public.contacts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 6) Personal info: extra editable profile fields.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists gender text;

-- 7) Family: family groups, members, and email invitations.
--    Tables are created BEFORE the SECURITY DEFINER helpers because
--    Postgres validates SQL function bodies at creation time.
create schema if not exists private;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('organizer', 'parent', 'member', 'child')),
  status text not null default 'invited'
    check (status in ('invited', 'active')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (family_id, email)
);

-- A user can only be an active member of one family.
create unique index if not exists family_members_one_active_family_per_user
  on public.family_members (user_id)
  where status = 'active' and user_id is not null;

-- SECURITY DEFINER helpers live in the non-exposed "private" schema and
-- always check auth.uid(), so they cannot be abused via the Data API.
create or replace function private.current_email()
returns text language sql security definer stable
set search_path = public
as $$
  select email from auth.users where id = auth.uid();
$$;

create or replace function private.is_family_member(p_family_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  );
$$;

create or replace function private.is_family_organizer(p_family_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.families f
    where f.id = p_family_id
      and f.organizer_id = auth.uid()
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_email() to authenticated;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.is_family_organizer(uuid) to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;

-- families: organizers, active members, and people with a pending invite
-- (matched by their verified email) can see the family.
drop policy if exists "Family is visible to members and invitees" on public.families;
create policy "Family is visible to members and invitees"
  on public.families for select
  to authenticated
  using (
    organizer_id = (select auth.uid())
    or private.is_family_member(id)
    or exists (
      select 1 from public.family_members fm
      where fm.family_id = id
        and fm.status = 'invited'
        and fm.email = private.current_email()
    )
  );

drop policy if exists "Users can create their own family" on public.families;
create policy "Users can create their own family"
  on public.families for insert
  to authenticated
  with check (organizer_id = (select auth.uid()));

drop policy if exists "Organizers can update their family" on public.families;
create policy "Organizers can update their family"
  on public.families for update
  to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

drop policy if exists "Organizers can delete their family" on public.families;
create policy "Organizers can delete their family"
  on public.families for delete
  to authenticated
  using (organizer_id = (select auth.uid()));

-- family_members: your own row, your family's rows, or invites addressed
-- to your verified email address.
drop policy if exists "Family members are visible within the family" on public.family_members;
create policy "Family members are visible within the family"
  on public.family_members for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or private.is_family_member(family_id)
    or private.is_family_organizer(family_id)
    or (status = 'invited' and email = private.current_email())
  );

-- Active members can invite; the organizer also inserts their own
-- founding member row. The invite must come from the inserting user.
drop policy if exists "Active members can invite people" on public.family_members;
create policy "Active members can invite people"
  on public.family_members for insert
  to authenticated
  with check (
    (private.is_family_member(family_id) or private.is_family_organizer(family_id))
    and invited_by = (select auth.uid())
  );

-- Invitees can accept/decline their own invite; organizers manage the rest.
-- USING checks the old row (invite still pending); WITH CHECK checks the new
-- row (after accepting, the row belongs to the user, so user_id matches).
drop policy if exists "Invitees and organizers can update member rows" on public.family_members;
create policy "Invitees and organizers can update member rows"
  on public.family_members for update
  to authenticated
  using (
    (status = 'invited' and email = private.current_email())
    or private.is_family_organizer(family_id)
  )
  with check (
    (select auth.uid()) = user_id
    or private.is_family_organizer(family_id)
  );

-- Members can leave (own row), invitees can decline, organizers can remove.
drop policy if exists "Members can leave and organizers can remove" on public.family_members;
create policy "Members can leave and organizers can remove"
  on public.family_members for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (status = 'invited' and email = private.current_email())
    or private.is_family_organizer(family_id)
  );

-- 8) Subscriptions (existing table, written by the Stripe backend with the
--    service role, which bypasses RLS). The app only reads the user's own row.
alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 9) YavqoTV friends (existing table): either side of a friendship can see
--    and remove it; only the user themselves can create rows.
create unique index if not exists tv_friends_unique_pair
  on public.tv_friends (user_id, friend_id);

alter table public.tv_friends enable row level security;

drop policy if exists "Friends are visible to both sides" on public.tv_friends;
create policy "Friends are visible to both sides"
  on public.tv_friends for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = friend_id
  );

drop policy if exists "Users can add their own friends" on public.tv_friends;
create policy "Users can add their own friends"
  on public.tv_friends for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Either friend can remove the friendship" on public.tv_friends;
create policy "Either friend can remove the friendship"
  on public.tv_friends for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = friend_id
  );

-- Read-only detail view for the account page: one row per friendship
-- involving the current user, exposing the OTHER user's contact info.
-- Intentionally NOT security_invoker: the view owner (postgres) must read
-- auth.users; the where-clause limits rows to the caller's own friends.
-- DISTINCT ON collapses reciprocal/duplicate rows (A→B and B→A) into one
-- row per friend.
create or replace view public.friend_profiles as
select distinct on (u.id)
  tf.id as friendship_id,
  u.id as user_id,
  u.email as email,
  p.full_name as full_name,
  p.avatar_url as avatar_url,
  tf.created_at as created_at
from public.tv_friends tf
join auth.users u
  on u.id = case when tf.user_id = auth.uid() then tf.friend_id else tf.user_id end
left join public.profiles p on p.id = u.id
where tf.user_id = auth.uid() or tf.friend_id = auth.uid()
order by u.id, tf.created_at;

-- 10) YavqoID (all YavqoID tables use the id_ prefix). One per user; the
--     handle is a global unique identifier, like an Apple ID.
create table if not exists public.id_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique
    references auth.users (id) on delete cascade,
  handle text not null,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists id_accounts_handle_unique
  on public.id_accounts (lower(handle));

alter table public.id_accounts enable row level security;

-- Handles are public identifiers, so any signed-in user may read them
-- (needed for availability checks and future lookups); only the owner
-- can create or modify their own row.
drop policy if exists "YavqoID profiles are readable by signed-in users" on public.id_accounts;
create policy "YavqoID profiles are readable by signed-in users"
  on public.id_accounts for select
  to authenticated
  using (true);

drop policy if exists "Users create their own YavqoID" on public.id_accounts;
create policy "Users create their own YavqoID"
  on public.id_accounts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own YavqoID" on public.id_accounts;
create policy "Users update their own YavqoID"
  on public.id_accounts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own YavqoID" on public.id_accounts;
create policy "Users can delete their own YavqoID"
  on public.id_accounts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 11) OAuth sign-in ("Sign in with Yavqo Account"). Authorization Code
--     flow with PKCE. Developers register apps (id_oauth_clients); the
--     consent screen issues one-time codes (id_oauth_codes) that the app
--     exchanges server-side via oauth_consume_code().

create table if not exists public.id_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null unique,
  -- bcrypt hash of the client secret; the plaintext secret is only ever
  -- returned once, by oauth_register_client().
  client_secret_hash text,
  name text not null,
  redirect_uris text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.id_oauth_clients enable row level security;

-- Any signed-in user can read app metadata: the consent screen must be
-- able to show the app name and validate redirect_uri for clients owned
-- by someone else (same public-identifier treatment as id_accounts).
drop policy if exists "OAuth apps are readable by signed-in users" on public.id_oauth_clients;
create policy "OAuth apps are readable by signed-in users"
  on public.id_oauth_clients for select
  to authenticated
  using (true);

-- Registration happens through oauth_register_client() (it generates the
-- credentials and stores only the secret hash), so no insert policy.

drop policy if exists "Users can delete own OAuth apps" on public.id_oauth_clients;
create policy "Users can delete own OAuth apps"
  on public.id_oauth_clients for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.id_oauth_codes (
  code text primary key,
  client_id text not null
    references public.id_oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  scope text not null default 'openid profile email',
  code_challenge text,
  code_challenge_method text
    check (code_challenge_method in ('S256', 'plain')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.id_oauth_codes enable row level security;

drop policy if exists "Users can read own OAuth codes" on public.id_oauth_codes;
create policy "Users can read own OAuth codes"
  on public.id_oauth_codes for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own OAuth codes" on public.id_oauth_codes;
create policy "Users can create own OAuth codes"
  on public.id_oauth_codes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Registers a new OAuth app for the signed-in user. Generates the
-- client_id and client_secret and stores only the bcrypt hash of the
-- secret; the plaintext secret is returned exactly once in the result.
create or replace function public.oauth_register_client(
  p_name text,
  p_redirect_uris text[]
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_client_id text;
  v_secret text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;
  if p_redirect_uris is null or cardinality(p_redirect_uris) = 0 then
    raise exception 'at least one redirect URI is required';
  end if;

  v_client_id := 'yvc_' || encode(gen_random_bytes(12), 'hex');
  v_secret := 'yvs_' || encode(gen_random_bytes(24), 'hex');

  insert into public.id_oauth_clients
    (user_id, client_id, client_secret_hash, name, redirect_uris)
  values
    (auth.uid(), v_client_id, crypt(v_secret, gen_salt('bf')),
     trim(p_name), p_redirect_uris);

  return jsonb_build_object(
    'client_id', v_client_id,
    'client_secret', v_secret
  );
end;
$$;

revoke execute on function public.oauth_register_client(text, text[]) from public;
grant execute on function public.oauth_register_client(text, text[]) to authenticated;

-- Exchanges an authorization code for user claims. Callable by anon
-- because third-party servers call it with their own credentials, not a
-- user session; every input is validated before any user data is read:
--   * client must exist and, if confidential, present the right secret
--   * code must belong to that client and be unused (claimed atomically)
--   * code must not be expired and redirect_uri must match exactly
--   * PKCE verifier must match the stored challenge (S256 or plain)
-- Returns a claims object, or raises invalid_client / invalid_grant.
create or replace function public.oauth_consume_code(
  p_client_id text,
  p_client_secret text,
  p_code text,
  p_redirect_uri text,
  p_code_verifier text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_client record;
  v_user_id uuid;
  v_redirect_uri text;
  v_scope text;
  v_challenge text;
  v_challenge_method text;
  v_expires_at timestamptz;
  v_expected text;
begin
  select c.client_id, c.client_secret_hash
    into v_client
  from public.id_oauth_clients c
  where c.client_id = p_client_id;

  if not found then
    raise exception 'invalid_client';
  end if;
  if v_client.client_secret_hash is not null then
    if p_client_secret is null
      or crypt(p_client_secret, v_client.client_secret_hash)
         <> v_client.client_secret_hash then
      raise exception 'invalid_client';
    end if;
  end if;

  -- Claim the code atomically so it can never be exchanged twice.
  update public.id_oauth_codes k
     set used_at = now()
   where k.code = p_code
     and k.client_id = p_client_id
     and k.used_at is null
  returning k.user_id, k.redirect_uri, k.scope, k.code_challenge,
            k.code_challenge_method, k.expires_at
    into v_user_id, v_redirect_uri, v_scope, v_challenge,
         v_challenge_method, v_expires_at;

  if not found then
    raise exception 'invalid_grant';
  end if;
  if v_expires_at < now() then
    raise exception 'invalid_grant';
  end if;
  if v_redirect_uri is distinct from p_redirect_uri then
    raise exception 'invalid_grant';
  end if;
  if v_challenge is not null then
    if p_code_verifier is null or length(p_code_verifier) < 43 then
      raise exception 'invalid_grant';
    end if;
    if v_challenge_method = 'S256' then
      -- RFC 7636: BASE64URL(SHA256(verifier)), unpadded.
      v_expected := replace(replace(replace(
        encode(digest(p_code_verifier, 'sha256'), 'base64'),
        '+', '-'), '/', '_'), '=', '');
      if v_expected <> v_challenge then
        raise exception 'invalid_grant';
      end if;
    elsif p_code_verifier <> v_challenge then
      raise exception 'invalid_grant';
    end if;
  end if;

  delete from public.id_oauth_codes k where k.code = p_code;

  return (
    select jsonb_build_object(
      'sub', u.id,
      'email', u.email,
      'email_verified', u.email_confirmed_at is not null,
      'name', coalesce(nullif(trim(p.full_name), ''),
                       nullif(trim(i.display_name), '')),
      'picture', coalesce(i.avatar_url, p.avatar_url),
      'handle', i.handle,
      'id_display_name', i.display_name,
      'granted_scope', v_scope
    )
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.id_accounts i on i.user_id = u.id
    where u.id = v_user_id
  );
end;
$$;

revoke execute on function public.oauth_consume_code(text, text, text, text, text) from public;
grant execute on function public.oauth_consume_code(text, text, text, text, text) to anon, authenticated;

-- 12) Wallet payment methods: cards verified with a €1 charge that is
--     refunded immediately. Only the display details (brand/last4/expiry)
--     are stored here; the card itself lives in Stripe.
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  brand text not null,
  last4 text not null,
  exp_month int not null,
  exp_year int not null,
  created_at timestamptz not null default now(),
  unique (user_id, stripe_payment_method_id)
);

alter table public.payment_methods enable row level security;

drop policy if exists "Users can read own payment methods" on public.payment_methods;
create policy "Users can read own payment methods"
  on public.payment_methods for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own payment methods" on public.payment_methods;
create policy "Users can insert own payment methods"
  on public.payment_methods for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own payment methods" on public.payment_methods;
create policy "Users can delete own payment methods"
  on public.payment_methods for delete
  to authenticated
  using ((select auth.uid()) = user_id);
