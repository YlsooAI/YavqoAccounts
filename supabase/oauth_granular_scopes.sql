-- Apply to existing projects before using the new OAuth profile scopes.
-- Keep the existing function signature, owner and grants intact.
do $update_oauth$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.oauth_consume_code(text,text,text,text,text)'::regprocedure
  );
  if position('''username'', p.username' in definition) = 0 then
    if position('''id_display_name'', i.display_name,' in definition) = 0 then
      raise exception 'Unexpected oauth_consume_code definition; update manually';
    end if;
    definition := replace(
      definition,
      '''id_display_name'', i.display_name,',
      '''id_display_name'', i.display_name,' || E'\n' ||
      '      ''username'', p.username,' || E'\n' ||
      '      ''gender'', p.gender,' || E'\n' ||
      '      ''birthday'', p.birthday,' || E'\n' ||
      '      ''phone'', p.phone,'
    );
    definition := replace(
      definition,
      '''picture'', coalesce(i.avatar_url, p.avatar_url),',
      '''full_name'', p.full_name,' || E'\n' ||
      '      ''picture'', coalesce(i.avatar_url, p.avatar_url),'
    );
    execute definition;
  end if;
end;
$update_oauth$;

notify pgrst, 'reload schema';
