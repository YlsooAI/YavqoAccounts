-- Issue OAuth authorization codes only through a checked, one-time request.
-- This closes the direct id_oauth_codes INSERT path that would bypass the
-- consent page's passkey verification.
alter table public.id_oauth_passkey_challenges
  add column if not exists previous_session_id uuid;

revoke insert on table public.id_oauth_passkey_challenges from authenticated;
drop policy if exists "Users can create own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges;

revoke insert on table public.id_oauth_codes from authenticated;
drop policy if exists "Users can create own OAuth codes"
  on public.id_oauth_codes;

create or replace function public.oauth_begin_passkey_challenge()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid;
  v_nonce uuid := gen_random_uuid();
  v_created_at timestamptz;
begin
  if v_user_id is null or nullif((select auth.jwt())->>'session_id', '') is null then
    raise exception 'not_authenticated';
  end if;
  v_session_id := ((select auth.jwt())->>'session_id')::uuid;

  insert into public.id_oauth_passkey_challenges
    (nonce, user_id, previous_session_id)
  values (v_nonce, v_user_id, v_session_id)
  returning created_at into v_created_at;

  return jsonb_build_object(
    'nonce', v_nonce,
    'issued_at', floor(extract(epoch from v_created_at))::bigint,
    'previous_session_id', v_session_id
  );
end;
$$;

create or replace function public.oauth_issue_code(
  p_nonce uuid,
  p_client_id text,
  p_redirect_uri text,
  p_scope text,
  p_code_challenge text,
  p_code_challenge_method text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_previous_session_id uuid;
  v_created_at timestamptz;
  v_scopes text[];
  v_code text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if p_redirect_uri !~ '^https?://' or not exists (
    select 1 from public.id_oauth_clients c
    where c.client_id = p_client_id
      and p_redirect_uri = any(c.redirect_uris)
  ) then
    raise exception 'invalid_client_or_redirect';
  end if;

  v_scopes := regexp_split_to_array(trim(coalesce(p_scope, '')), '\s+');
  if not ('openid' = any(v_scopes)) or exists (
    select 1 from unnest(v_scopes) s
    where s not in (
      'openid', 'profile', 'email', 'yavqoid', 'full_name',
      'avatar', 'username', 'gender', 'birthday', 'phone'
    )
  ) then
    raise exception 'invalid_scope';
  end if;
  if (p_code_challenge is null and p_code_challenge_method is not null)
     or (p_code_challenge is not null and
         p_code_challenge_method not in ('S256', 'plain')) then
    raise exception 'invalid_code_challenge';
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
     code_challenge, code_challenge_method)
  values
    (v_code, p_client_id, v_user_id, p_redirect_uri, p_scope,
     p_code_challenge, p_code_challenge_method);
  return v_code;
end;
$$;

revoke all on function public.oauth_begin_passkey_challenge() from public, anon, authenticated;
grant execute on function public.oauth_begin_passkey_challenge() to authenticated;
revoke all on function public.oauth_issue_code(uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.oauth_issue_code(uuid,text,text,text,text,text)
  to authenticated;

notify pgrst, 'reload schema';
