-- Repair the live security-invoker profiles view and OAuth crypto calls.
alter table public.saturn_profiles add column if not exists phone text;

create or replace view public.profiles
with (security_invoker = true) as
select id, username, avatar_url, created_at, updated_at,
       full_name, birthday, gender, phone
from public.saturn_profiles;

-- Preserve existing function bodies, ownership and grants; qualify only
-- pgcrypto calls so the fixed public search_path can remain unchanged.
do $repair$
declare
  function_signature text;
  definition text;
begin
  foreach function_signature in array array[
    'public.oauth_register_client(text,text[])',
    'public.oauth_consume_code(text,text,text,text,text)'
  ] loop
    definition := pg_get_functiondef(function_signature::regprocedure);
    definition := regexp_replace(
      definition,
      '\m(gen_random_bytes|gen_salt|crypt|digest)\(',
      'extensions.\1(', 'g'
    );
    -- Avoid double qualification if this repair is run again.
    definition := replace(definition, 'extensions.extensions.', 'extensions.');
    execute definition;
  end loop;
end;
$repair$;

notify pgrst, 'reload schema';

