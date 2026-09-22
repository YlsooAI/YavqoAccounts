-- Expose the profiles.avatar_url value through the existing avatar/profile
-- OAuth permissions. Apply to projects created before this claim was added.
do $update_oauth_avatar$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.oauth_consume_code(text,text,text,text,text)'::regprocedure
  );
  if position('''avatar_url'', p.avatar_url,' in definition) = 0 then
    if position('''picture'', coalesce(i.avatar_url, p.avatar_url),' in definition) = 0 then
      raise exception 'Unexpected oauth_consume_code definition; update manually';
    end if;
    definition := replace(
      definition,
      '''picture'', coalesce(i.avatar_url, p.avatar_url),',
      '''picture'', coalesce(i.avatar_url, p.avatar_url),' || E'\n' ||
      '      ''avatar_url'', p.avatar_url,'
    );
    execute definition;
  end if;
end;
$update_oauth_avatar$;

notify pgrst, 'reload schema';
