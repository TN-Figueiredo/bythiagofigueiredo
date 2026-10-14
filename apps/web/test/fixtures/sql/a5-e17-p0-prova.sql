-- Roteiro de prova da MG11 (A5, E17 passo 0). Reescrito na emenda 1: o roteiro da rodada 0 se perdeu.
-- Tudo dentro de uma transação que termina em rollback. Só no banco de integração (porta 54422), com o banco livre.
-- Outro arquivo de SQL: psql -v mg=/caminho/absoluto/do/arquivo.sql -f a5-e17-p0-prova.sql
-- (emenda 2: D-m-d e S-n5) Depois da Tarefa 1b o arquivo padrão abaixo (a5-e17-p0-mg11.sql) deixa de existir, de propósito:
-- o SQL passa a ser o da migration, e -v mg=<arquivo da migration> vira obrigatório. "Arquivo não encontrado" sem -v mg é a
-- falha certa. NÃO recriar a cópia para "consertar".
\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on
\if :{?mg}
\else
\set mg a5-e17-p0-mg11.sql
\endif
begin;
set local client_min_messages = warning;
\ir :mg
\ir :mg

\echo == cenario
create temp table u (nome text primary key, id uuid not null default gen_random_uuid()) on commit drop;
insert into u (nome) values ('super'), ('orgadmin'), ('editor'), ('leitora'), ('reporter'), ('revogada'), ('exmembro'), ('editorB'), ('sem');
create temp table s (nome text primary key, id uuid not null default gen_random_uuid(), org uuid not null default gen_random_uuid()) on commit drop;
insert into s (nome) values ('A'), ('B');
select (select id from s where nome = 'A') as a, (select id from s where nome = 'B') as b, (select org from s where nome = 'A') as org_a,
       (select id from u where nome = 'super') as super, (select id from u where nome = 'orgadmin') as orgadmin, (select id from u where nome = 'editor') as editor,
       (select id from u where nome = 'leitora') as leitora, (select id from u where nome = 'reporter') as reporter, (select id from u where nome = 'revogada') as revogada,
       (select id from u where nome = 'exmembro') as exmembro, (select id from u where nome = 'editorB') as editorb,
       gen_random_uuid() as dono, gen_random_uuid() as k \gset
insert into auth.users (id, aud, role, email) select id, 'authenticated', 'authenticated', nome || '@mg11.test' from u;
-- quem concede e retira: uma pessoa sem papel nenhum, para poder ser apagada no fim sem mexer na matriz
insert into auth.users (id, aud, role, email) values (:'dono', 'authenticated', 'authenticated', 'dono@mg11.test');
-- só existe uma organização raiz por banco (organizations_single_master): usa a que houver, cria se não houver
insert into public.organizations (name, slug, parent_org_id) select 'Raiz MG11', 'mg11-raiz', null where not exists (select 1 from public.organizations where parent_org_id is null);
insert into public.organizations (id, name, slug, parent_org_id) select s.org, 'Org MG11 ' || s.nome, 'mg11-org-' || lower(s.nome), (select o.id from public.organizations o where o.parent_org_id is null) from s;
insert into public.sites (id, org_id, name, slug, domains, primary_domain) select s.id, s.org, 'Site MG11 ' || s.nome, 'mg11-site-' || lower(s.nome), array['mg11-' || lower(s.nome) || '.test'], 'mg11-' || lower(s.nome) || '.test' from s;
insert into public.organization_members (org_id, user_id, role) values ((select o.id from public.organizations o where o.parent_org_id is null), :'super', 'org_admin'), (:'org_a', :'orgadmin', 'org_admin');
insert into public.site_memberships (site_id, user_id, role) values (:'a', :'editor', 'editor'), (:'a', :'leitora', 'reporter'), (:'a', :'reporter', 'reporter'), (:'a', :'revogada', 'reporter'), (:'b', :'editorb', 'editor');
-- três concessões no site A: a leitora (em vigor), a revogada (concedida e retirada) e a ex-membro (em vigor, sem vínculo com o site)
insert into public.site_private_viewers (site_id, user_id, granted_by) values (:'a', :'leitora', :'dono'), (:'a', :'revogada', :'dono'), (:'a', :'exmembro', :'dono');
update public.site_private_viewers set revoked_at = now(), revoked_by = :'dono' where site_id = :'a' and user_id = :'revogada';

-- (controlador 14/10) V1 do plano com os dois acréscimos no fim: o índice com at e os dois checks de validade
\echo == V1 (tabelas, policies, funcoes, sessao, search_path, colunas, check, gatilho, indice_at, checks_de_validade)
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname in ('site_private_viewers','obs_ai_access_log','obs_ai_rate')) as tabelas_com_rls_de_3, (select count(*) from pg_policies where schemaname='public' and tablename in ('site_private_viewers','obs_ai_access_log','obs_ai_rate')) as policies_de_2, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','obs_ai_rate_hit') and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as funcoes_so_service_role_de_6, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_view_private_site' and has_function_privilege('anon',p.oid,'execute') and has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as funcao_de_sessao_de_1, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','can_view_private_site','obs_ai_rate_hit','tg_site_private_viewers_audit') and p.proconfig @> array['search_path=""']) as funcoes_com_search_path_vazio_de_8, (select count(*) from information_schema.columns where table_schema='public' and table_name='pipeline_api_keys' and column_name in ('user_id','expires_at')) as colunas_novas_de_2, (select count(*) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass and conname='pipeline_api_keys_observatorio_leitura_sozinha') as check_de_1, (select count(*) from pg_trigger where tgrelid='public.site_private_viewers'::regclass and tgname='audit_site_private_viewers' and not tgisinternal) as gatilho_de_1, (select count(*) from pg_indexes where schemaname='public' and tablename='obs_ai_access_log' and indexname='idx_oaal_at' and indexdef like '%USING btree (at)') as indice_at_de_1, (select count(*) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass and conname in ('pipeline_api_keys_expires_at_finita','pipeline_api_keys_perfil_exige_validade')) as checks_de_validade_de_2;

\echo == matriz _as (usuario|site|ver|editar|privado)
select u.nome, s.nome, public.can_view_site_as(u.id, s.id), public.can_edit_site_as(u.id, s.id), public.can_view_private_site_as(u.id, s.id) from u cross join s order by u.nome collate "C", s.nome collate "C";

\echo == nulo: usuario nulo, site nulo e site inexistente dao false, nunca nulo; a de sessao, sem sessao, tambem
select public.can_view_private_site_as(null, :'a'), public.can_view_private_site_as(:'leitora', null), public.can_view_private_site_as(:'leitora', gen_random_uuid()), public.can_view_private_site(:'a');

\echo == sessao x _as, com o GUC app.site_id forjado para o site A
create temp table r (usuario text, site text, ver boolean, editar boolean, privado boolean) on commit drop;
do $$
declare
  x record; v boolean; e boolean; p boolean;
  a uuid := (select id from s where nome = 'A');
begin
  for x in select u.nome as un, u.id as uid, s.nome as sn, s.id as sid from u cross join s loop
    perform set_config('request.jwt.claims', json_build_object('sub', x.uid, 'role', 'authenticated')::text, true);
    perform set_config('app.site_id', a::text, true);
    set local role authenticated;
    v := public.can_view_site(x.sid); e := public.can_edit_site(x.sid); p := public.can_view_private_site(x.sid);
    reset role;
    insert into r values (x.un, x.sn, v, e, p);
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('app.site_id', '', true);
end $$;
select 'divergencias_sessao_x_as', count(*) from r join u on u.nome = r.usuario join s on s.nome = r.site
 where (r.ver, r.editar, r.privado) is distinct from (public.can_view_site_as(u.id, s.id), public.can_edit_site_as(u.id, s.id), public.can_view_private_site_as(u.id, s.id));
select 'linhas_comparadas', count(*) from r;

\echo == anon: a funcao de sessao responde false
create temp table an (v boolean) on commit drop;
do $$
declare a uuid := (select id from s where nome = 'A'); v boolean;
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  v := public.can_view_private_site(a);
  reset role;
  insert into an values (v);
end $$;
select 'anon', v from an;

\echo == RLS de site_private_viewers (leitora ve a propria; reporter 0; super e orgadmin as 3 do site A; editor 0)
do $$
declare x record; n integer;
begin
  for x in select u.nome, u.id from u where u.nome in ('super', 'orgadmin', 'editor', 'leitora', 'reporter', 'editorB')
           order by array_position(array['super', 'orgadmin', 'editor', 'leitora', 'reporter', 'editorB'], u.nome) loop
    perform set_config('request.jwt.claims', json_build_object('sub', x.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.site_private_viewers;
    reset role;
    raise warning 'rls site_private_viewers: % ve % linha(s)', x.nome, n;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

\echo == escrita por authenticated e recusada (insert, update, delete)
do $$
declare
  a uuid := (select id from s where nome = 'A');
  oa uuid := (select id from u where nome = 'orgadmin');
  alvo uuid := (select id from u where nome = 'sem');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', oa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.site_private_viewers (site_id, user_id) values (a, alvo); raise warning 'insert como org_admin: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'insert como org_admin: %', sqlstate; end;
  begin update public.site_private_viewers set revoked_at = now() where site_id = a; raise warning 'update como org_admin: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'update como org_admin: %', sqlstate; end;
  begin delete from public.site_private_viewers where site_id = a; raise warning 'delete como org_admin: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'delete como org_admin: %', sqlstate; end;
  begin insert into public.obs_ai_rate (key_id, grain, bucket) values (gen_random_uuid(), 'minuto', now()); raise warning 'insert em obs_ai_rate como authenticated: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'insert em obs_ai_rate como authenticated: %', sqlstate; end;
  begin perform 1 from public.obs_ai_rate; raise warning 'select em obs_ai_rate como authenticated: PASSOU (defeito)';
  exception when insufficient_privilege then raise warning 'select em obs_ai_rate como authenticated: %', sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

\echo == rastro em audit_log
select action, count(*) from public.audit_log where resource_type = 'site_private_viewers' group by 1 order by 1;
select 'org_id_preenchido', bool_and(org_id is not null) from public.audit_log where resource_type = 'site_private_viewers';

\echo == runbook: conceder de novo a revogada (1 linha), conceder a quem ja tem (0 linhas), revogar (1), revogar de novo (0)
with x as (insert into public.site_private_viewers (site_id, user_id, granted_by) values ((select id from public.sites where slug = 'mg11-site-a'), (select id from auth.users where email = 'revogada@mg11.test'), (select id from auth.users where email = 'dono@mg11.test')) on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning 1) select 'reconceder', count(*) from x;
with x as (insert into public.site_private_viewers (site_id, user_id, granted_by) values ((select id from public.sites where slug = 'mg11-site-a'), (select id from auth.users where email = 'revogada@mg11.test'), (select id from auth.users where email = 'dono@mg11.test')) on conflict (site_id, user_id) do update set revoked_at = null, revoked_by = null, granted_by = excluded.granted_by, granted_at = now() where public.site_private_viewers.revoked_at is not null returning 1) select 'conceder_a_quem_ja_tem', count(*) from x;
with x as (update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'dono@mg11.test') where site_id = (select id from public.sites where slug = 'mg11-site-a') and user_id = (select id from auth.users where email = 'revogada@mg11.test') and revoked_at is null returning 1) select 'revogar', count(*) from x;
with x as (update public.site_private_viewers set revoked_at = now(), revoked_by = (select id from auth.users where email = 'dono@mg11.test') where site_id = (select id from public.sites where slug = 'mg11-site-a') and user_id = (select id from auth.users where email = 'revogada@mg11.test') and revoked_at is null returning 1) select 'revogar_de_novo', count(*) from x;
select action, count(*) from public.audit_log where resource_type = 'site_private_viewers' group by 1 order by 1;
select 'revoked_by_na_linha_revogada', revoked_by = :'dono' from public.site_private_viewers where site_id = :'a' and user_id = :'revogada';

-- (emenda 2: D-N1 e D-m-g)
\echo == corrigir autor em branco: preenche quem retirou, nao muda quem le, nao grava rastro; revoked_by em linha em vigor e recusado
select count(*) as rastro_antes_corrigir from public.audit_log where resource_type = 'site_private_viewers' \gset
update public.site_private_viewers set revoked_by = null where site_id = :'a' and user_id = :'revogada';
with x as (update public.site_private_viewers set revoked_by = (select id from auth.users where email = 'dono@mg11.test') where site_id = (select id from public.sites where slug = 'mg11-site-a') and user_id = (select id from auth.users where email = 'revogada@mg11.test') and revoked_at is not null and revoked_by is null returning 1) select 'corrigir_autor', count(*) from x;
select 'continua_retirada', revoked_at is not null and revoked_by = :'dono', public.can_view_private_site_as(:'revogada', :'a') from public.site_private_viewers where site_id = :'a' and user_id = :'revogada';
select 'rastro_novo_ao_corrigir', count(*) - :rastro_antes_corrigir from public.audit_log where resource_type = 'site_private_viewers';
do $$
begin
  begin update public.site_private_viewers set revoked_by = granted_by where revoked_at is null; raise warning 'revoked_by em linha em vigor: PASSOU (defeito)';
  exception when check_violation then raise warning 'revoked_by em linha em vigor: %', sqlstate; end;
end $$;

\echo == contador de taxa (como service_role)
insert into public.pipeline_api_keys (id, site_id, name, key_hash, permissions, user_id, expires_at) values (:'k', :'a', 'mg11 perfil', 'mg11-hash-perfil', array['observatorio_leitura'], :'leitora', now() + interval '1 year');   -- (controlador 14/10) com validade: o check novo a exige
insert into public.obs_ai_access_log (site_id, user_id, key_id, origin, action, included_private, result) values (:'a', :'leitora', :'k', 'mcp', 'prova', true, 'ok');
set local role service_role;
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-13 23:59:10+00');
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-13 23:59:30+00');
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-13 20:59:59-03');
select no_minuto, no_dia from public.obs_ai_rate_hit(:'k', '2026-10-14 00:00:05+00');
select grain, bucket at time zone 'UTC', n from public.obs_ai_rate where key_id = :'k' order by 1, 2;
reset role;

\echo == check da permissao sozinha
do $$
declare a uuid := (select id from s where nome = 'A');
begin
  begin insert into public.pipeline_api_keys (site_id, name, key_hash, permissions) values (a, 'mg11 mista', 'mg11-hash-mista', array['observatorio_leitura', 'read']); raise warning 'chave com observatorio_leitura + read: PASSOU (defeito)';
  exception when check_violation then raise warning 'chave com observatorio_leitura + read: %', sqlstate; end;
  begin update public.pipeline_api_keys set permissions = array_append(permissions, 'read') where name = 'mg11 perfil'; raise warning 'acrescentar read a chave do perfil: PASSOU (defeito)';
  exception when check_violation then raise warning 'acrescentar read a chave do perfil: %', sqlstate; end;
  -- (controlador 14/10) validade finita e chave do perfil com validade
  begin insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at) values (a, 'mg11 infinita', 'mg11-hash-infinita', array['read'], 'infinity'); raise warning 'expires_at infinito: PASSOU (defeito)';
  exception when check_violation then raise warning 'expires_at infinito: %', sqlstate; end;
  begin insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at) values (a, 'mg11 menos infinita', 'mg11-hash-menos-infinita', array['read'], '-infinity'); raise warning 'expires_at menos infinito: PASSOU (defeito)';
  exception when check_violation then raise warning 'expires_at menos infinito: %', sqlstate; end;
  begin insert into public.pipeline_api_keys (site_id, name, key_hash, permissions) values (a, 'mg11 perfil sem validade', 'mg11-hash-perfil-sem-validade', array['observatorio_leitura']); raise warning 'chave do perfil sem validade: PASSOU (defeito)';
  exception when check_violation then raise warning 'chave do perfil sem validade: %', sqlstate; end;
  begin update public.pipeline_api_keys set expires_at = null where name = 'mg11 perfil'; raise warning 'tirar a validade da chave do perfil: PASSOU (defeito)';
  exception when check_violation then raise warning 'tirar a validade da chave do perfil: %', sqlstate; end;
  begin insert into public.pipeline_api_keys (site_id, name, key_hash, permissions) values (a, 'mg11 comum sem validade', 'mg11-hash-comum-sem-validade', array['read']); raise warning 'chave comum sem validade: entrou (como as de hoje)';
  exception when check_violation then raise warning 'chave comum sem validade: RECUSADA (defeito)'; end;
end $$;

\echo == apagar usuario: a leitora some da concessao; quem concedeu e retirou vira nulo; chave fica sem dono; nenhum rastro novo
select count(*) as rastro_antes from public.audit_log where resource_type = 'site_private_viewers' \gset
delete from auth.users where id = :'leitora';
select 'linhas_da_leitora', count(*) from public.site_private_viewers where user_id = :'leitora';
select 'chave_sem_dono', user_id is null from public.pipeline_api_keys where id = :'k';
select 'log_sem_pessoa', bool_and(user_id is null), count(*) = 1 from public.obs_ai_access_log where action = 'prova';
select 'privado_da_leitora_apagada', public.can_view_private_site_as(:'leitora', :'a');
delete from auth.users where id = :'dono';
select 'granted_by_nulo', count(*) filter (where granted_by is null), count(*) from public.site_private_viewers;
select 'revoked_by_nulo', count(*) filter (where revoked_by is null), count(*) from public.site_private_viewers;
select 'rastro_novo_ao_apagar', count(*) - :rastro_antes from public.audit_log where resource_type = 'site_private_viewers';

\echo == custo: 1000 chamadas da funcao de sessao como o editor, a reporter sem direito e a ex-membro
do $$
declare x record; n integer; t0 timestamptz; a uuid := (select id from s where nome = 'A');
begin
  for x in select u.nome, u.id from u where u.nome in ('editor', 'reporter', 'exmembro')
           order by array_position(array['editor', 'reporter', 'exmembro'], u.nome) loop
    perform set_config('request.jwt.claims', json_build_object('sub', x.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    t0 := clock_timestamp();
    select count(*) filter (where public.can_view_private_site(a)) into n from generate_series(1, 1000);
    reset role;
    raise warning 'custo: % -> % de 1000 verdadeiras em % ms', x.nome, n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;
rollback;
