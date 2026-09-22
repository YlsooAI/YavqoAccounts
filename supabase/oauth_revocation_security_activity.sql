-- Apply after setup.sql and connected_apps.sql. OAuth tokens are bound to
-- one authorization row; deleting that row revokes them immediately.
do $update_oauth_consume$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.oauth_consume_code(text,text,text,text,text)'::regprocedure
  );
  if position('''authorization_id'', a.id,' in definition) = 0 then
    if position('''granted_scope'', v_scope' in definition) = 0 or
       position('    where u.id = v_user_id' in definition) = 0 then
      raise exception 'Unexpected oauth_consume_code definition; update manually';
    end if;
    definition := replace(
      definition,
      '''granted_scope'', v_scope',
      '''authorization_id'', a.id,' || E'\n' ||
      '      ''granted_scope'', v_scope'
    );
    definition := replace(
      definition,
      '    where u.id = v_user_id',
      '    join public.id_oauth_authorizations a' || E'\n' ||
      '      on a.user_id = u.id and a.client_id = p_client_id' || E'\n' ||
      '     and string_to_array(v_scope, '' '') <@ string_to_array(a.scope, '' '')' || E'\n' ||
      '    where u.id = v_user_id'
    );
    execute definition;
  end if;
end;
$update_oauth_consume$;

create or replace function public.oauth_authorization_active(
  p_authorization_id uuid,
  p_user_id uuid,
  p_client_id text,
  p_scope text
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.id_oauth_authorizations a
    where a.id = p_authorization_id
      and a.user_id = p_user_id
      and a.client_id = p_client_id
      and p_scope is not null
      and string_to_array(p_scope, ' ') <@ string_to_array(a.scope, ' ')
  );
$$;
revoke all on function public.oauth_authorization_active(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.oauth_authorization_active(uuid, uuid, text, text)
  to anon, authenticated;

-- Signed-in users can inspect only their own active sessions and auth events.
-- Only display fields are returned; no session or refresh-token secrets.
create or replace function public.account_security_activity()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id text := (select auth.jwt() ->> 'session_id');
  v_sessions jsonb;
  v_events jsonb;
begin
  if v_user_id is null then
    raise exception 'not signed in';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
    into v_sessions
  from (
    select id, created_at, updated_at, user_agent, host(ip) as ip_address,
           (id::text = v_session_id) as is_current
    from auth.sessions
    where user_id = v_user_id and (not_after is null or not_after > now())
    order by created_at desc
    limit 30
  ) s;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
    into v_events
  from (
    select created_at, payload::jsonb ->> 'action' as action,
           ip_address
    from auth.audit_log_entries
    where payload::jsonb ->> 'actor_id' = v_user_id::text
       or payload::jsonb ->> 'user_id' = v_user_id::text
    order by created_at desc
    limit 30
  ) e;

  return jsonb_build_object('sessions', v_sessions, 'events', v_events);
end;
$$;
revoke all on function public.account_security_activity() from public, anon, authenticated;
grant execute on function public.account_security_activity() to authenticated;

notify pgrst, 'reload schema';
