-- OAuth 2.0 & OIDC v2 features migration.
-- Apply after setup.sql, connected_apps.sql, and oauth_revocation_security_activity.sql.
-- Idempotent: safe to re-run in the Supabase SQL editor.

create schema if not exists private;

-- 1) Extend OAuth clients with client_type (confidential vs public),
--    PKCE enforcement, secret rotation (secondary secret + expiry),
--    and OpenID Connect Back-Channel Logout URI.
alter table public.id_oauth_clients
  add column if not exists client_type text not null default 'confidential',
  add column if not exists require_pkce boolean not null default false,
  add column if not exists secondary_secret_hash text,
  add column if not exists secondary_secret_expires_at timestamptz,
  add column if not exists backchannel_logout_uri text;

do $add_client_type_check$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'id_oauth_clients_client_type_check'
      and conrelid = 'public.id_oauth_clients'::regclass
  ) then
    alter table public.id_oauth_clients
      add constraint id_oauth_clients_client_type_check
      check (client_type in ('confidential', 'public'));
  end if;
end;
$add_client_type_check$;

-- 2) Extend authorization codes with OIDC nonce and auth_time.
alter table public.id_oauth_codes
  add column if not exists nonce text,
  add column if not exists auth_time bigint;

-- 3) Refresh tokens with single-use rotation families and cascade deletion
--    when the parent authorization is revoked.
create table if not exists public.id_oauth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null
    references public.id_oauth_authorizations (id) on delete cascade,
  client_id text not null
    references public.id_oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  family_id uuid not null default gen_random_uuid(),
  token_hash text not null unique,
  scope text not null,
  expires_at timestamptz not null default now() + interval '30 days',
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists id_oauth_refresh_tokens_auth_idx
  on public.id_oauth_refresh_tokens (authorization_id);
create index if not exists id_oauth_refresh_tokens_family_idx
  on public.id_oauth_refresh_tokens (family_id);
create index if not exists id_oauth_refresh_tokens_expiry_idx
  on public.id_oauth_refresh_tokens (expires_at);

alter table public.id_oauth_refresh_tokens enable row level security;
revoke all on table public.id_oauth_refresh_tokens from public, anon, authenticated;

-- 4) Individual revoked access-token JTIs (RFC 7009 /oauth/revoke).
create table if not exists public.id_oauth_revoked_tokens (
  jti text primary key,
  client_id text not null
    references public.id_oauth_clients (client_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists id_oauth_revoked_tokens_expiry_idx
  on public.id_oauth_revoked_tokens (expires_at);

alter table public.id_oauth_revoked_tokens enable row level security;
revoke all on table public.id_oauth_revoked_tokens from public, anon, authenticated;

-- 5) Internal helper to verify client existence, client_type, and secret
--    (primary or non-expired secondary secret).
create or replace function private.oauth_verify_client(
  p_client_id text,
  p_client_secret text,
  p_require_confidential boolean default false
) returns public.id_oauth_clients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.id_oauth_clients;
  v_matches_primary boolean := false;
  v_matches_secondary boolean := false;
begin
  select * into v_client
  from public.id_oauth_clients c
  where c.client_id = p_client_id;

  if not found then
    raise exception 'invalid_client';
  end if;

  if p_require_confidential and v_client.client_type <> 'confidential' then
    raise exception 'unauthorized_client';
  end if;

  if v_client.client_type = 'confidential' and v_client.client_secret_hash is not null then
    if p_client_secret is null or length(p_client_secret) = 0 then
      raise exception 'invalid_client';
    end if;

    v_matches_primary :=
      extensions.crypt(p_client_secret, v_client.client_secret_hash) = v_client.client_secret_hash;

    if not v_matches_primary
       and v_client.secondary_secret_hash is not null
       and (v_client.secondary_secret_expires_at is null or v_client.secondary_secret_expires_at > now()) then
      v_matches_secondary :=
        extensions.crypt(p_client_secret, v_client.secondary_secret_hash) = v_client.secondary_secret_hash;
    end if;

    if not (v_matches_primary or v_matches_secondary) then
      raise exception 'invalid_client';
    end if;
  end if;

  return v_client;
end;
$$;

revoke all on function private.oauth_verify_client(text, text, boolean) from public, anon, authenticated;

-- 6) Safe public client metadata lookup for /oauth/authorize (including
--    unauthenticated prompt=none validation before login redirect).
create or replace function public.oauth_get_client_public(
  p_client_id text
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'client_id', c.client_id,
    'name', c.name,
    'redirect_uris', c.redirect_uris,
    'client_type', c.client_type,
    'require_pkce', c.require_pkce
  )
  from public.id_oauth_clients c
  where c.client_id = p_client_id;
$$;

revoke all on function public.oauth_get_client_public(text) from public;
grant execute on function public.oauth_get_client_public(text) to anon, authenticated;

-- 7) Client registration, editing, and zero-downtime secret rotation.
drop function if exists public.oauth_register_client(text, text[]);

create or replace function public.oauth_register_client(
  p_name text,
  p_redirect_uris text[],
  p_client_type text default 'confidential',
  p_require_pkce boolean default false,
  p_backchannel_logout_uri text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id text;
  v_secret text := null;
  v_secret_hash text := null;
  v_type text := coalesce(nullif(trim(p_client_type), ''), 'confidential');
  v_pkce boolean;
  v_logout_uri text := nullif(trim(coalesce(p_backchannel_logout_uri, '')), '');
  v_uri text;
begin
  if v_user_id is null then
    raise exception 'not signed in';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;
  if v_type not in ('confidential', 'public') then
    raise exception 'invalid client_type';
  end if;
  if p_redirect_uris is null or cardinality(p_redirect_uris) = 0 then
    raise exception 'at least one redirect URI is required';
  end if;
  foreach v_uri in array p_redirect_uris loop
    if v_uri !~ '^https?://' then
      raise exception 'redirect URIs must start with http:// or https://';
    end if;
  end loop;
  if v_logout_uri is not null and v_logout_uri !~ '^https?://' then
    raise exception 'backchannel logout URI must start with http:// or https://';
  end if;

  v_pkce := case when v_type = 'public' then true else coalesce(p_require_pkce, false) end;
  v_client_id := 'yvc_' || encode(extensions.gen_random_bytes(12), 'hex');

  if v_type = 'confidential' then
    v_secret := 'yvs_' || encode(extensions.gen_random_bytes(24), 'hex');
    v_secret_hash := extensions.crypt(v_secret, extensions.gen_salt('bf'));
  end if;

  insert into public.id_oauth_clients
    (user_id, client_id, client_secret_hash, name, redirect_uris,
     client_type, require_pkce, backchannel_logout_uri)
  values
    (v_user_id, v_client_id, v_secret_hash, trim(p_name), p_redirect_uris,
     v_type, v_pkce, v_logout_uri);

  return jsonb_build_object(
    'client_id', v_client_id,
    'client_secret', v_secret,
    'client_type', v_type,
    'require_pkce', v_pkce
  );
end;
$$;

revoke all on function public.oauth_register_client(text, text[], text, boolean, text) from public;
grant execute on function public.oauth_register_client(text, text[], text, boolean, text) to authenticated;

create or replace function public.oauth_update_client(
  p_id uuid,
  p_name text,
  p_redirect_uris text[],
  p_require_pkce boolean default false,
  p_backchannel_logout_uri text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client public.id_oauth_clients;
  v_pkce boolean;
  v_logout_uri text := nullif(trim(coalesce(p_backchannel_logout_uri, '')), '');
  v_uri text;
begin
  if v_user_id is null then
    raise exception 'not signed in';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;
  if p_redirect_uris is null or cardinality(p_redirect_uris) = 0 then
    raise exception 'at least one redirect URI is required';
  end if;
  foreach v_uri in array p_redirect_uris loop
    if v_uri !~ '^https?://' then
      raise exception 'redirect URIs must start with http:// or https://';
    end if;
  end loop;
  if v_logout_uri is not null and v_logout_uri !~ '^https?://' then
    raise exception 'backchannel logout URI must start with http:// or https://';
  end if;

  select * into v_client
  from public.id_oauth_clients
  where id = p_id and user_id = v_user_id;
  if not found then
    raise exception 'app not found';
  end if;

  v_pkce := case when v_client.client_type = 'public' then true else coalesce(p_require_pkce, false) end;

  update public.id_oauth_clients
     set name = trim(p_name),
         redirect_uris = p_redirect_uris,
         require_pkce = v_pkce,
         backchannel_logout_uri = v_logout_uri
   where id = p_id and user_id = v_user_id;

  return jsonb_build_object(
    'id', p_id,
    'name', trim(p_name),
    'redirect_uris', p_redirect_uris,
    'require_pkce', v_pkce,
    'backchannel_logout_uri', v_logout_uri
  );
end;
$$;

revoke all on function public.oauth_update_client(uuid, text, text[], boolean, text) from public;
grant execute on function public.oauth_update_client(uuid, text, text[], boolean, text) to authenticated;

create or replace function public.oauth_rotate_client_secret(
  p_id uuid,
  p_grace_hours int default 24
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client public.id_oauth_clients;
  v_secret text;
  v_grace_until timestamptz := null;
begin
  if v_user_id is null then
    raise exception 'not signed in';
  end if;

  select * into v_client
  from public.id_oauth_clients
  where id = p_id and user_id = v_user_id;
  if not found then
    raise exception 'app not found';
  end if;
  if v_client.client_type <> 'confidential' then
    raise exception 'public clients do not use a client secret';
  end if;

  v_secret := 'yvs_' || encode(extensions.gen_random_bytes(24), 'hex');
  if coalesce(p_grace_hours, 0) > 0 then
    v_grace_until := now() + make_interval(hours => least(p_grace_hours, 168));
  end if;

  update public.id_oauth_clients
     set secondary_secret_hash = case
           when v_grace_until is not null then client_secret_hash
           else null
         end,
         secondary_secret_expires_at = v_grace_until,
         client_secret_hash = extensions.crypt(v_secret, extensions.gen_salt('bf'))
   where id = p_id and user_id = v_user_id;

  return jsonb_build_object(
    'client_id', v_client.client_id,
    'client_secret', v_secret,
    'secondary_secret_expires_at', v_grace_until
  );
end;
$$;

revoke all on function public.oauth_rotate_client_secret(uuid, int) from public;
grant execute on function public.oauth_rotate_client_secret(uuid, int) to authenticated;

create or replace function public.oauth_revoke_secondary_secret(
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not signed in';
  end if;
  update public.id_oauth_clients
     set secondary_secret_hash = null,
         secondary_secret_expires_at = null
   where id = p_id and user_id = v_user_id;
end;
$$;

revoke all on function public.oauth_revoke_secondary_secret(uuid) from public;
grant execute on function public.oauth_revoke_secondary_secret(uuid) to authenticated;

-- 8) Authorization code issuance (interactive consent with passkey/TOTP step-up).
drop function if exists public.oauth_issue_code(uuid, text, text, text, text, text);

create or replace function public.oauth_issue_code(
  p_nonce uuid,
  p_client_id text,
  p_redirect_uri text,
  p_scope text,
  p_code_challenge text,
  p_code_challenge_method text,
  p_oidc_nonce text default null,
  p_auth_time bigint default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_previous_session_id uuid;
  v_created_at timestamptz;
  v_client public.id_oauth_clients;
  v_scopes text[];
  v_code text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select * into v_client
  from public.id_oauth_clients c
  where c.client_id = p_client_id;

  if not found or p_redirect_uri !~ '^https?://' or not (p_redirect_uri = any(v_client.redirect_uris)) then
    raise exception 'invalid_client_or_redirect';
  end if;

  v_scopes := regexp_split_to_array(trim(coalesce(p_scope, '')), '\s+');
  if not ('openid' = any(v_scopes)) or exists (
    select 1 from unnest(v_scopes) s
    where s not in (
      'openid', 'profile', 'email', 'offline_access', 'yavqoid',
      'full_name', 'avatar', 'username', 'gender', 'birthday', 'phone'
    )
  ) then
    raise exception 'invalid_scope';
  end if;

  if (p_code_challenge is null and p_code_challenge_method is not null)
     or (p_code_challenge is not null and
         p_code_challenge_method not in ('S256', 'plain')) then
    raise exception 'invalid_code_challenge';
  end if;
  if v_client.client_type = 'public' and (p_code_challenge is null or p_code_challenge_method <> 'S256') then
    raise exception 'pkce_s256_required';
  end if;
  if v_client.require_pkce and p_code_challenge is null then
    raise exception 'pkce_required';
  end if;

  update public.id_oauth_passkey_challenges
     set consumed_at = now()
   where nonce = p_nonce
     and user_id = v_user_id
     and consumed_at is null
     and expires_at > now()
  returning previous_session_id, created_at
    into v_previous_session_id, v_created_at;
  if not found or v_previous_session_id is null then
    raise exception 'invalid_or_expired_request';
  end if;

  if exists (
    select 1 from auth.webauthn_credentials w where w.user_id = v_user_id
  ) then
    if (select auth.jwt())->>'session_id' = v_previous_session_id::text
       or not exists (
         select 1
         from jsonb_array_elements(coalesce((select auth.jwt())->'amr', '[]'::jsonb)) a(entry)
         where a.entry->>'method' = 'passkey'
           and (a.entry->>'timestamp')::bigint >=
               floor(extract(epoch from v_created_at))::bigint
       ) then
      raise exception 'passkey_required';
    end if;
  elsif exists (
    select 1 from auth.mfa_factors f
    where f.user_id = v_user_id
      and f.factor_type::text = 'totp'
      and f.status::text = 'verified'
  ) then
    if not exists (
      select 1 from auth.mfa_amr_claims m
      where m.session_id = ((select auth.jwt())->>'session_id')::uuid
        and m.authentication_method = 'totp'
        and m.updated_at > v_created_at
    ) then
      raise exception 'totp_required';
    end if;
  end if;

  v_code := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.id_oauth_codes
    (code, client_id, user_id, redirect_uri, scope,
     code_challenge, code_challenge_method, nonce, auth_time)
  values
    (v_code, p_client_id, v_user_id, p_redirect_uri, p_scope,
     p_code_challenge, p_code_challenge_method, nullif(p_oidc_nonce, ''),
     coalesce(p_auth_time, floor(extract(epoch from now()))::bigint));
  return v_code;
end;
$$;

revoke all on function public.oauth_issue_code(uuid, text, text, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.oauth_issue_code(uuid, text, text, text, text, text, text, bigint)
  to authenticated;

-- 9) Remembered / silent code issuance (used for prompt=none and skip-consent
--    when the user already authorized all requested scopes and no fresh
--    passkey/TOTP interaction is outstanding).
create or replace function public.oauth_issue_remembered_code(
  p_client_id text,
  p_redirect_uri text,
  p_scope text,
  p_code_challenge text,
  p_code_challenge_method text,
  p_oidc_nonce text default null,
  p_auth_time bigint default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client public.id_oauth_clients;
  v_auth public.id_oauth_authorizations;
  v_scopes text[];
  v_code text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select * into v_client
  from public.id_oauth_clients c
  where c.client_id = p_client_id;

  if not found or p_redirect_uri !~ '^https?://' or not (p_redirect_uri = any(v_client.redirect_uris)) then
    raise exception 'invalid_client_or_redirect';
  end if;

  v_scopes := regexp_split_to_array(trim(coalesce(p_scope, '')), '\s+');
  if not ('openid' = any(v_scopes)) or exists (
    select 1 from unnest(v_scopes) s
    where s not in (
      'openid', 'profile', 'email', 'offline_access', 'yavqoid',
      'full_name', 'avatar', 'username', 'gender', 'birthday', 'phone'
    )
  ) then
    raise exception 'invalid_scope';
  end if;

  if (p_code_challenge is null and p_code_challenge_method is not null)
     or (p_code_challenge is not null and
         p_code_challenge_method not in ('S256', 'plain')) then
    raise exception 'invalid_code_challenge';
  end if;
  if v_client.client_type = 'public' and (p_code_challenge is null or p_code_challenge_method <> 'S256') then
    raise exception 'pkce_s256_required';
  end if;
  if v_client.require_pkce and p_code_challenge is null then
    raise exception 'pkce_required';
  end if;

  -- Require existing authorization covering all requested scopes.
  select * into v_auth
  from public.id_oauth_authorizations a
  where a.user_id = v_user_id
    and a.client_id = p_client_id
    and v_scopes <@ string_to_array(a.scope, ' ');

  if not found then
    raise exception 'consent_required';
  end if;

  -- Enforce passkey / TOTP security policy: if a factor is enrolled, require
  -- that the current session already satisfied it; otherwise signal interaction_required.
  if exists (
    select 1 from auth.webauthn_credentials w where w.user_id = v_user_id
  ) then
    if not exists (
      select 1
      from jsonb_array_elements(coalesce((select auth.jwt())->'amr', '[]'::jsonb)) a(entry)
      where (jsonb_typeof(a.entry) = 'string' and a.entry #>> '{}' = 'passkey')
         or (jsonb_typeof(a.entry) = 'object' and a.entry->>'method' = 'passkey')
    ) then
      raise exception 'interaction_required';
    end if;
  elsif exists (
    select 1 from auth.mfa_factors f
    where f.user_id = v_user_id
      and f.factor_type::text = 'totp'
      and f.status::text = 'verified'
  ) then
    if nullif((select auth.jwt())->>'session_id', '') is null
       or not exists (
         select 1 from auth.mfa_amr_claims m
         where m.session_id = ((select auth.jwt())->>'session_id')::uuid
           and m.authentication_method = 'totp'
       ) then
      raise exception 'interaction_required';
    end if;
  end if;

  update public.id_oauth_authorizations
     set last_used_at = now()
   where id = v_auth.id;

  v_code := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.id_oauth_codes
    (code, client_id, user_id, redirect_uri, scope,
     code_challenge, code_challenge_method, nonce, auth_time)
  values
    (v_code, p_client_id, v_user_id, p_redirect_uri, p_scope,
     p_code_challenge, p_code_challenge_method, nullif(p_oidc_nonce, ''),
     coalesce(p_auth_time, floor(extract(epoch from now()))::bigint));
  return v_code;
end;
$$;

revoke all on function public.oauth_issue_remembered_code(text, text, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.oauth_issue_remembered_code(text, text, text, text, text, text, bigint)
  to authenticated;

-- 10) Authorization code exchange: supports confidential (primary + rotated secret)
--     and public (PKCE S256) clients, issues refresh tokens when offline_access
--     is granted, and returns nonce + auth_time for id_token construction.
create or replace function public.oauth_consume_code(
  p_client_id text,
  p_client_secret text,
  p_code text,
  p_redirect_uri text,
  p_code_verifier text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.id_oauth_clients;
  v_user_id uuid;
  v_redirect_uri text;
  v_scope text;
  v_challenge text;
  v_challenge_method text;
  v_expires_at timestamptz;
  v_nonce text;
  v_auth_time bigint;
  v_expected text;
  v_authorization_id uuid;
  v_refresh_token text := null;
  v_family_id uuid := null;
  v_claims jsonb;
begin
  v_client := private.oauth_verify_client(p_client_id, p_client_secret, false);

  update public.id_oauth_codes k
     set used_at = now()
   where k.code = p_code
     and k.client_id = p_client_id
     and k.used_at is null
  returning k.user_id, k.redirect_uri, k.scope, k.code_challenge,
            k.code_challenge_method, k.expires_at, k.nonce, k.auth_time
    into v_user_id, v_redirect_uri, v_scope, v_challenge,
         v_challenge_method, v_expires_at, v_nonce, v_auth_time;

  if not found then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  delete from public.id_oauth_codes k where k.code = p_code;

  if v_expires_at < now() then
    return jsonb_build_object('error', 'invalid_grant');
  end if;
  if v_redirect_uri is distinct from p_redirect_uri then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  if v_client.client_type = 'public' and (v_challenge is null or v_challenge_method <> 'S256') then
    return jsonb_build_object('error', 'invalid_grant');
  end if;
  if v_client.require_pkce and v_challenge is null then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  if v_challenge is not null then
    if p_code_verifier is null or length(p_code_verifier) < 43 or length(p_code_verifier) > 128 then
      return jsonb_build_object('error', 'invalid_grant');
    end if;
    if v_challenge_method = 'S256' then
      v_expected := replace(replace(replace(
        encode(extensions.digest(p_code_verifier, 'sha256'), 'base64'),
        '+', '-'), '/', '_'), '=', '');
      if v_expected <> v_challenge then
        return jsonb_build_object('error', 'invalid_grant');
      end if;
    elsif p_code_verifier <> v_challenge then
      return jsonb_build_object('error', 'invalid_grant');
    end if;
  end if;

  select a.id
    into v_authorization_id
  from public.id_oauth_authorizations a
  where a.user_id = v_user_id
    and a.client_id = p_client_id
    and string_to_array(v_scope, ' ') <@ string_to_array(a.scope, ' ');

  if not found then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  update public.id_oauth_authorizations
     set last_used_at = now()
   where id = v_authorization_id;

  if 'offline_access' = any(string_to_array(v_scope, ' ')) then
    v_refresh_token := 'yvrt_' || encode(extensions.gen_random_bytes(32), 'hex');
    v_family_id := gen_random_uuid();
    insert into public.id_oauth_refresh_tokens
      (authorization_id, client_id, user_id, family_id, token_hash, scope)
    values
      (v_authorization_id, p_client_id, v_user_id, v_family_id,
       encode(extensions.digest(v_refresh_token, 'sha256'), 'hex'),
       v_scope);
  end if;

  select jsonb_build_object(
    'sub', u.id,
    'email', u.email,
    'email_verified', u.email_confirmed_at is not null,
    'name', coalesce(nullif(trim(p.full_name), ''),
                     nullif(trim(i.display_name), '')),
    'full_name', p.full_name,
    'picture', coalesce(i.avatar_url, p.avatar_url),
    'avatar_url', p.avatar_url,
    'handle', i.handle,
    'id_display_name', i.display_name,
    'username', p.username,
    'gender', p.gender,
    'birthday', p.birthday,
    'phone', p.phone,
    'authorization_id', v_authorization_id,
    'granted_scope', v_scope,
    'nonce', v_nonce,
    'auth_time', v_auth_time,
    'refresh_token', v_refresh_token,
    'refresh_family_id', v_family_id
  )
    into v_claims
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.id_accounts i on i.user_id = u.id
  where u.id = v_user_id;

  if v_claims is null then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  return v_claims;
end;
$$;

revoke all on function public.oauth_consume_code(text, text, text, text, text) from public;
grant execute on function public.oauth_consume_code(text, text, text, text, text) to anon, authenticated;

-- 11) Refresh token rotation with reuse detection. Returns error JSON (rather
--     than raising) on reuse so the family revocation commits durably.
create or replace function public.oauth_rotate_refresh_token(
  p_client_id text,
  p_client_secret text,
  p_refresh_token text,
  p_scope text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.id_oauth_clients;
  v_hash text;
  v_rt public.id_oauth_refresh_tokens;
  v_granted_scopes text[];
  v_effective_scope text;
  v_requested_scopes text[];
  v_new_token text;
  v_claims jsonb;
begin
  v_client := private.oauth_verify_client(p_client_id, p_client_secret, false);

  if p_refresh_token is null or length(trim(p_refresh_token)) = 0 then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  v_hash := encode(extensions.digest(p_refresh_token, 'sha256'), 'hex');

  select * into v_rt
  from public.id_oauth_refresh_tokens t
  where t.token_hash = v_hash
  for update;

  if not found or v_rt.client_id <> p_client_id then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  -- Reuse detection: if an already-rotated or revoked token is presented,
  -- immediately revoke the entire token family.
  if v_rt.rotated_at is not null or v_rt.revoked_at is not null then
    update public.id_oauth_refresh_tokens
       set revoked_at = coalesce(revoked_at, now())
     where family_id = v_rt.family_id;
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  if v_rt.expires_at < now() then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  v_granted_scopes := regexp_split_to_array(trim(v_rt.scope), '\s+');
  if nullif(trim(coalesce(p_scope, '')), '') is not null then
    v_requested_scopes := regexp_split_to_array(trim(p_scope), '\s+');
    if not (v_requested_scopes <@ v_granted_scopes) then
      return jsonb_build_object('error', 'invalid_scope');
    end if;
    if not ('openid' = any(v_requested_scopes)) then
      v_requested_scopes := array_prepend('openid', v_requested_scopes);
    end if;
    v_effective_scope := array_to_string(v_requested_scopes, ' ');
  else
    v_effective_scope := v_rt.scope;
    v_requested_scopes := v_granted_scopes;
  end if;

  if not exists (
    select 1 from public.id_oauth_authorizations a
    where a.id = v_rt.authorization_id
      and a.user_id = v_rt.user_id
      and a.client_id = p_client_id
      and v_requested_scopes <@ string_to_array(a.scope, ' ')
  ) then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  update public.id_oauth_refresh_tokens
     set rotated_at = now()
   where id = v_rt.id;

  v_new_token := 'yvrt_' || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.id_oauth_refresh_tokens
    (authorization_id, client_id, user_id, family_id, token_hash, scope)
  values
    (v_rt.authorization_id, p_client_id, v_rt.user_id, v_rt.family_id,
     encode(extensions.digest(v_new_token, 'sha256'), 'hex'),
     v_effective_scope);

  update public.id_oauth_authorizations
     set last_used_at = now()
   where id = v_rt.authorization_id;

  select jsonb_build_object(
    'sub', u.id,
    'email', u.email,
    'email_verified', u.email_confirmed_at is not null,
    'name', coalesce(nullif(trim(p.full_name), ''),
                     nullif(trim(i.display_name), '')),
    'full_name', p.full_name,
    'picture', coalesce(i.avatar_url, p.avatar_url),
    'avatar_url', p.avatar_url,
    'handle', i.handle,
    'id_display_name', i.display_name,
    'username', p.username,
    'gender', p.gender,
    'birthday', p.birthday,
    'phone', p.phone,
    'authorization_id', v_rt.authorization_id,
    'granted_scope', v_effective_scope,
    'refresh_token', v_new_token,
    'refresh_family_id', v_rt.family_id
  )
    into v_claims
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.id_accounts i on i.user_id = u.id
  where u.id = v_rt.user_id;

  if v_claims is null then
    return jsonb_build_object('error', 'invalid_grant');
  end if;

  return v_claims;
end;
$$;

revoke all on function public.oauth_rotate_refresh_token(text, text, text, text) from public;
grant execute on function public.oauth_rotate_refresh_token(text, text, text, text) to anon, authenticated;

-- 12) Client authentication RPC for client_credentials, /oauth/revoke, and /oauth/introspect.
create or replace function public.oauth_authenticate_client(
  p_client_id text,
  p_client_secret text,
  p_require_confidential boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.id_oauth_clients;
begin
  v_client := private.oauth_verify_client(p_client_id, p_client_secret, p_require_confidential);
  return jsonb_build_object(
    'client_id', v_client.client_id,
    'name', v_client.name,
    'client_type', v_client.client_type
  );
end;
$$;

revoke all on function public.oauth_authenticate_client(text, text, boolean) from public;
grant execute on function public.oauth_authenticate_client(text, text, boolean) to anon, authenticated;

-- 13) Token status checks (live revocation via connected apps, JTI, or refresh family).
create or replace function public.oauth_token_active(
  p_authorization_id uuid,
  p_user_id uuid,
  p_client_id text,
  p_scope text,
  p_jti text default null,
  p_family_id uuid default null
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.id_oauth_authorizations a
    where a.id = p_authorization_id
      and a.user_id = p_user_id
      and a.client_id = p_client_id
      and p_scope is not null
      and string_to_array(p_scope, ' ') <@ string_to_array(a.scope, ' ')
  )
  and (
    p_jti is null or not exists (
      select 1 from public.id_oauth_revoked_tokens r
      where r.jti = p_jti
    )
  )
  and (
    p_family_id is null or not exists (
      select 1 from public.id_oauth_refresh_tokens rt
      where rt.family_id = p_family_id
        and rt.revoked_at is not null
    )
  );
$$;

revoke all on function public.oauth_token_active(uuid, uuid, text, text, text, uuid) from public;
grant execute on function public.oauth_token_active(uuid, uuid, text, text, text, uuid) to anon, authenticated;

create or replace function public.oauth_client_active(
  p_client_id text,
  p_jti text default null
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.id_oauth_clients c
    where c.client_id = p_client_id
  )
  and (
    p_jti is null or not exists (
      select 1 from public.id_oauth_revoked_tokens r
      where r.jti = p_jti
    )
  );
$$;

revoke all on function public.oauth_client_active(text, text) from public;
grant execute on function public.oauth_client_active(text, text) to anon, authenticated;

-- 14) Token revocation (RFC 7009) and refresh token introspection (RFC 7662).
create or replace function public.oauth_revoke_token(
  p_client_id text,
  p_client_secret text,
  p_token text,
  p_jti text default null,
  p_jti_exp bigint default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.id_oauth_clients;
  v_hash text;
  v_family_id uuid;
begin
  v_client := private.oauth_verify_client(p_client_id, p_client_secret, false);

  delete from public.id_oauth_revoked_tokens where expires_at < now();

  if p_token is not null and length(p_token) > 0 then
    v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
    select rt.family_id
      into v_family_id
    from public.id_oauth_refresh_tokens rt
    where rt.token_hash = v_hash
      and rt.client_id = p_client_id;

    if found then
      update public.id_oauth_refresh_tokens
         set revoked_at = coalesce(revoked_at, now())
       where family_id = v_family_id;
      return true;
    end if;
  end if;

  if p_jti is not null and length(p_jti) > 0 then
    insert into public.id_oauth_revoked_tokens (jti, client_id, expires_at)
    values (
      p_jti,
      p_client_id,
      coalesce(to_timestamp(p_jti_exp), now() + interval '2 hours')
    )
    on conflict (jti) do nothing;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.oauth_revoke_token(text, text, text, text, bigint) from public;
grant execute on function public.oauth_revoke_token(text, text, text, text, bigint) to anon, authenticated;

create or replace function public.oauth_introspect_refresh_token(
  p_client_id text,
  p_refresh_token text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_rt public.id_oauth_refresh_tokens;
begin
  if p_refresh_token is null or length(p_refresh_token) = 0 then
    return jsonb_build_object('active', false);
  end if;

  v_hash := encode(extensions.digest(p_refresh_token, 'sha256'), 'hex');
  select * into v_rt
  from public.id_oauth_refresh_tokens rt
  where rt.token_hash = v_hash
    and rt.client_id = p_client_id;

  if not found
     or v_rt.rotated_at is not null
     or v_rt.revoked_at is not null
     or v_rt.expires_at <= now() then
    return jsonb_build_object('active', false);
  end if;

  if not exists (
    select 1 from public.id_oauth_authorizations a
    where a.id = v_rt.authorization_id
      and a.user_id = v_rt.user_id
      and a.client_id = p_client_id
      and string_to_array(v_rt.scope, ' ') <@ string_to_array(a.scope, ' ')
  ) then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'sub', v_rt.user_id,
    'client_id', v_rt.client_id,
    'scope', v_rt.scope,
    'iat', floor(extract(epoch from v_rt.created_at))::bigint,
    'exp', floor(extract(epoch from v_rt.expires_at))::bigint,
    'token_type', 'refresh_token'
  );
end;
$$;

revoke all on function public.oauth_introspect_refresh_token(text, text) from public;
grant execute on function public.oauth_introspect_refresh_token(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
