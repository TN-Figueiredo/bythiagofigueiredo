-- E-mail e nome de exibição de uma lista de usuários, para /admin/users.
--
-- A tela resolvia cada membro com auth.admin.getUserById (uma chamada HTTP ao GoTrue por
-- linha) e, quando o GoTrue não devolvia o usuário, mostrava o UUID cru. Aqui a leitura é
-- uma só, direto em auth.users.
--
-- SECURITY DEFINER e sem checagem de permissão por dentro: só o service role a chama, depois
-- do guard is_org_admin da página. Nunca exposta a anon/authenticated — devolve e-mails.

create or replace function public.admin_user_directory(p_user_ids uuid[])
  returns table (user_id uuid, email text, display_name text)
  language sql stable security definer
  set search_path = ''
  as $$
  select
    u.id,
    u.email::text,
    nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
  from auth.users u
  where u.id = any (p_user_ids)
$$;

revoke all on function public.admin_user_directory(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_user_directory(uuid[]) to service_role;

comment on function public.admin_user_directory(uuid[]) is
  'E-mail e nome (user_metadata.full_name/name) dos usuários pedidos. Só service_role: a página /admin/users chama depois de conferir is_org_admin.';
