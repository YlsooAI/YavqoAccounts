-- Security requirements for protected features.
--
-- The account pages lock saved passwords and developer credentials until the
-- user has turned on 2-Step Verification. These rules enforce the same
-- requirement in the database, so the browser cannot skip the page lock by
-- calling Supabase directly. Payment methods are enforced in the Next.js
-- API routes instead (they go through Stripe on the server).
--
-- A session counts as verified when it passed 2-Step Verification (aal2)
-- or signed in with a passkey.

create or replace function public.session_has_second_factor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
          then auth.jwt() -> 'amr' else '[]'::jsonb end
      ) as entry
      where entry ->> 'method' = 'passkey' or entry #>> '{}' = 'passkey'
    );
$$;

-- Saved passwords: restrictive, so it applies on top of the existing
-- "own rows" policies for every operation.
drop policy if exists "Saved passwords require 2-Step Verification" on public.saved_passwords;
create policy "Saved passwords require 2-Step Verification"
  on public.saved_passwords
  as restrictive
  for all
  to authenticated
  using ((select public.session_has_second_factor()))
  with check ((select public.session_has_second_factor()));

-- Developer credentials: oauth_register_client() is security definer and
-- bypasses RLS, so new apps are checked with a trigger instead.
create or replace function public.require_security_for_oauth_clients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed timestamptz;
begin
  -- Service-role and direct database writes have no user session.
  if auth.uid() is null then
    return new;
  end if;

  select email_confirmed_at into confirmed from auth.users where id = auth.uid();
  if confirmed is null then
    raise exception 'Confirm your email address before registering OAuth apps.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.mfa_factors
    where user_id = auth.uid() and factor_type = 'totp' and status = 'verified'
  ) or not public.session_has_second_factor() then
    raise exception 'Turn on 2-Step Verification before registering OAuth apps.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.require_security_for_oauth_clients() from public, anon, authenticated;

drop trigger if exists require_security_for_oauth_clients on public.id_oauth_clients;
create trigger require_security_for_oauth_clients
  before insert on public.id_oauth_clients
  for each row execute function public.require_security_for_oauth_clients();

notify pgrst, 'reload schema';
