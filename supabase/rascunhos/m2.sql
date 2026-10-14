-- =============================================================================
-- MIGRATION: manutenção M2, as três séries particionadas por mês de São Paulo
-- Rascunho até a Tarefa 8, Step 0 (TRAVA M2-1): vira supabase/migrations/<ts>_manutencao_m2_particoes.sql por db:new + cópia.
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §10.2. Plano: docs/superpowers/plans/2026-10-14-manutencao-nas-m2-particoes.md
-- Idempotente: a conversão sai sem fazer nada se a tabela já é particionada; o resto é create-or-replace / if not exists.
-- O que acontece sem dado: tabela vazia ganha partições do mês corrente a 12 à frente. Erro: a conversão inteira desfaz.
-- =============================================================================
set lock_timeout = '5s';

-- 1. Onde moram as partições: fora do que a API expõe, sem concessão a ninguém.
create schema if not exists obs_part;
revoke all on schema obs_part from public, anon, authenticated, service_role;
comment on schema obs_part is 'Partições mensais das séries do Observatório (manutenção M2). Nada aqui é lido diretamente: lê-se pela tabela-mãe em public.';

-- 2. O registro da conversão (a guarda de 7 dias da remoção e a referência das 72 h do vigia)
create table if not exists public.obs_partition_conversions (
  table_name text primary key,
  old_table text not null,
  partition_column text not null,
  converted_at timestamptz not null default now(),
  rows_copied bigint not null,
  views_sum numeric not null,
  signature jsonb
);
alter table public.obs_partition_conversions add column if not exists signature jsonb;
comment on column public.obs_partition_conversions.signature is 'obs_part.assinatura da tabela antes da conversão: a volta atrás (obs_part.desfazer) recria FKs e concessões a partir dela e confere o resultado contra ela.';
alter table public.obs_partition_conversions enable row level security;
revoke all on table public.obs_partition_conversions from anon, authenticated;
comment on table public.obs_partition_conversions is 'Uma linha por tabela convertida a particionada (M2): quando, quantas linhas e a soma de views copiadas. Sem policy: só service_role e o dono leem.';

-- 3. Mês, nome e limites
create or replace function obs_part.primeiro_dia(p date) returns date
language sql immutable set search_path = '' as $$
  select pg_catalog.make_date(extract(year from p)::int, extract(month from p)::int, 1)
$$;

create or replace function obs_part.mes_corrente_sp() returns date
language sql stable set search_path = '' as $$
  select obs_part.primeiro_dia((pg_catalog.now() at time zone 'America/Sao_Paulo')::date)
$$;

create or replace function obs_part.nome_da_particao(p_tabela text, p_mes date) returns text
language sql immutable set search_path = '' as $$
  select p_tabela || '_' || pg_catalog.to_char(obs_part.primeiro_dia(p_mes), 'YYYYMM')
$$;

-- 4. Criar uma partição: RLS ligada e revoke, sempre. true = criou; false = já existia anexada à mesma mãe.
create or replace function obs_part.criar_particao(p_mae regclass, p_mes date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_mes date;
  v_rel text;
  v_nsp text;
  v_tipo text;
  v_nome text;
  v_existente regclass;
  v_de text;
  v_ate text;
begin
  if p_mae is null or p_mes is null then
    raise exception 'M2:parametro_nulo' using errcode = '22023';
  end if;
  v_mes := obs_part.primeiro_dia(p_mes);
  select c.relname, n.nspname into v_rel, v_nsp
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_mae and c.relkind = 'p';
  if v_rel is null then
    raise exception 'M2:nao_particionada: %', p_mae::text using errcode = '22023';
  end if;
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_catalog.pg_partitioned_table pt
    join pg_catalog.pg_attribute a on a.attrelid = pt.partrelid and a.attnum = pt.partattrs[0]
   where pt.partrelid = p_mae and pt.partstrat = 'r' and pt.partnatts = 1;
  v_nome := obs_part.nome_da_particao(v_rel, v_mes);
  v_existente := pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', v_nome));
  if v_existente is not null then
    if exists (select 1 from pg_catalog.pg_inherits i where i.inhrelid = v_existente and i.inhparent = p_mae) then
      return false;
    end if;
    raise exception 'M2:nome_ocupado: obs_part.%', v_nome using errcode = '42P07';
  end if;
  if v_tipo = 'date' then
    v_de := pg_catalog.to_char(v_mes, 'YYYY-MM-DD');
    v_ate := pg_catalog.to_char((v_mes + interval '1 month')::date, 'YYYY-MM-DD');
  elsif v_tipo = 'timestamp with time zone' then
    v_de := pg_catalog.to_char(v_mes, 'YYYY-MM-DD') || ' 00:00:00-03';
    v_ate := pg_catalog.to_char((v_mes + interval '1 month')::date, 'YYYY-MM-DD') || ' 00:00:00-03';
  else
    raise exception 'M2:tipo_de_chave: %', coalesce(v_tipo, 'nulo') using errcode = '22023';
  end if;
  begin
    execute pg_catalog.format('create table obs_part.%I partition of %I.%I for values from (%L) to (%L)', v_nome, v_nsp, v_rel, v_de, v_ate);
  exception when duplicate_table then
    if exists (select 1 from pg_catalog.pg_inherits i where i.inhrelid = pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', v_nome)) and i.inhparent = p_mae) then
      return false;
    end if;
    raise;
  end;
  execute pg_catalog.format('alter table obs_part.%I enable row level security', v_nome);
  execute pg_catalog.format('revoke all on table obs_part.%I from public, anon, authenticated, service_role', v_nome);
  return true;
end $$;

-- 5. A assinatura do catálogo de uma tabela (antes e depois têm de ser iguais). search_path vazio: tudo sai qualificado.
create or replace function obs_part.assinatura(p_tabela regclass) returns jsonb
language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'colunas', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid)) order by a.attnum), '[]'::jsonb)
                  from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                 where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped),
    'constraints', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(k.conname, k.contype, pg_catalog.pg_get_constraintdef(k.oid)) order by k.conname), '[]'::jsonb)
                      from pg_catalog.pg_constraint k where k.conrelid = p_tabela),
    'indices', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(ic.relname, pg_catalog.replace(pg_catalog.pg_get_indexdef(i.indexrelid), ' ON ONLY ', ' ON ')) order by ic.relname), '[]'::jsonb)
                  from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid where i.indrelid = p_tabela),
    'policies', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(p.polname, p.polpermissive, p.polcmd,
                        (select pg_catalog.array_agg(case when r = 0 then 'public' else pg_catalog.pg_get_userbyid(r)::text end order by r) from pg_catalog.unnest(p.polroles) r),
                        pg_catalog.pg_get_expr(p.polqual, p.polrelid), pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]'::jsonb)
                   from pg_catalog.pg_policy p where p.polrelid = p_tabela),
    'gatilhos', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(g.tgname, pg_catalog.pg_get_triggerdef(g.oid), g.tgenabled) order by g.tgname), '[]'::jsonb)
                   from pg_catalog.pg_trigger g where g.tgrelid = p_tabela and not g.tgisinternal),
    'concessoes', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(case when x.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(x.grantee)::text end, x.privilege_type, x.is_grantable) order by case when x.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(x.grantee)::text end, x.privilege_type), '[]'::jsonb)
                     from pg_catalog.pg_class c, pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) x where c.oid = p_tabela),
    'rls', (select pg_catalog.jsonb_build_array(c.relrowsecurity, c.relforcerowsecurity) from pg_catalog.pg_class c where c.oid = p_tabela),
    'comentario', pg_catalog.obj_description(p_tabela, 'pg_class'),
    'publicacoes', (select coalesce(pg_catalog.jsonb_agg(pb.pubname order by pb.pubname), '[]'::jsonb)
                      from pg_catalog.pg_publication_rel pr join pg_catalog.pg_publication pb on pb.oid = pr.prpubid where pr.prrelid = p_tabela)
  )
$$;

-- 6. F7 com pg_depend: o que impediria trocar a tabela por outra de mesmo nome.
create or replace function obs_part.dependentes(p_tabela regclass) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(z.x order by z.x), '{}'::text[]) from (
    select 'chave estrangeira de ' || k.conrelid::regclass::text || ' (' || k.conname || ')' as x
      from pg_catalog.pg_constraint k where k.contype = 'f' and k.confrelid = p_tabela and k.conrelid <> p_tabela
    union all
    select 'view ou regra ' || rw.ev_class::regclass::text
      from pg_catalog.pg_depend d join pg_catalog.pg_rewrite rw on rw.oid = d.objid
     where d.classid = 'pg_catalog.pg_rewrite'::regclass and d.refobjid = p_tabela and rw.ev_class <> p_tabela
    union all
    select 'policy ' || p.polname || ' de ' || p.polrelid::regclass::text
      from pg_catalog.pg_depend d join pg_catalog.pg_policy p on p.oid = d.objid
     where d.classid = 'pg_catalog.pg_policy'::regclass and d.refobjid = p_tabela and p.polrelid <> p_tabela
    union all
    select 'função ' || f.oid::regprocedure::text
      from pg_catalog.pg_depend d join pg_catalog.pg_proc f on f.oid = d.objid
     where d.classid = 'pg_catalog.pg_proc'::regclass
       and (d.refobjid = p_tabela or d.refobjid = (select c.reltype from pg_catalog.pg_class c where c.oid = p_tabela))
    union all
    select 'on conflict on constraint em ' || f.oid::regprocedure::text
      from pg_catalog.pg_proc f join pg_catalog.pg_constraint k on k.conrelid = p_tabela
     where f.prosrc ~* ('on\s+conflict\s+on\s+constraint\s+"?' || k.conname || '\M')
    union all
    select 'publicação ' || pb.pubname
      from pg_catalog.pg_publication_rel pr join pg_catalog.pg_publication pb on pb.oid = pr.prpubid where pr.prrelid = p_tabela
  ) z
$$;

-- 7. O conversor: uma tabela comum vira particionada por mês, com o mesmo nome e o mesmo catálogo. Chamado dentro de um só `do`.
create or replace function obs_part.converter(p_tabela regclass, p_coluna text, p_soma text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_nsp text; v_rel text; v_kind "char"; v_antiga text; v_nova regclass; v_tipo text;
  v_antes jsonb; v_depois jsonb; v_dep text[]; v_diff text;
  v_ddl text[] := '{}'; v_fks text[] := '{}'; v_cols text; v_com text; v_rls boolean; v_force boolean;
  v_min date; v_mes date; v_ate date; v_meses integer := 0;
  v_n_antes bigint; v_s_antes numeric; v_n_depois bigint; v_s_depois numeric;
  r record; x text;
begin
  select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity into v_nsp, v_rel, v_kind, v_rls, v_force
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where c.oid = p_tabela;
  if v_kind = 'p' then
    return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', false, 'motivo', 'ja_particionada');
  end if;
  if v_kind is distinct from 'r' then
    raise exception 'M2:nao_e_tabela: %', p_tabela::text using errcode = '22023';
  end if;
  execute pg_catalog.format('lock table %I.%I in access exclusive mode', v_nsp, v_rel);

  v_dep := obs_part.dependentes(p_tabela);
  if pg_catalog.cardinality(v_dep) > 0 then
    raise exception 'M2:dependente_novo: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = pg_catalog.array_to_string(v_dep, '; ');
  end if;

  -- o retrato de antes e o DDL que o reproduz (capturados ANTES de renomear: os nomes saem os de agora, qualificados)
  v_antes := obs_part.assinatura(p_tabela);
  v_com := pg_catalog.obj_description(p_tabela, 'pg_class');
  for r in select k.conname, k.contype, pg_catalog.pg_get_constraintdef(k.oid) as def
             from pg_catalog.pg_constraint k
            where k.conrelid = p_tabela and k.contype in ('p', 'u', 'x', 'f')
            order by case k.contype when 'p' then 0 when 'u' then 1 when 'x' then 2 else 3 end, k.conname loop
    v_ddl := v_ddl || pg_catalog.format('alter table %I.%I add constraint %I %s', v_nsp, v_rel, r.conname, r.def);
    if r.contype = 'f' then v_fks := v_fks || r.conname::text; end if;
  end loop;
  for r in select pg_catalog.pg_get_indexdef(i.indexrelid) as def
             from pg_catalog.pg_index i
            where i.indrelid = p_tabela
              and not exists (select 1 from pg_catalog.pg_constraint k where k.conindid = i.indexrelid and k.conrelid = p_tabela)
            order by 1 loop
    v_ddl := v_ddl || r.def;
  end loop;
  if v_rls then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I enable row level security', v_nsp, v_rel); end if;
  if v_force then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I force row level security', v_nsp, v_rel); end if;
  for r in select p.polname, p.polpermissive, p.polcmd,
                  pg_catalog.pg_get_expr(p.polqual, p.polrelid) as q, pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as w,
                  (select pg_catalog.string_agg(case when x0 = 0 then 'public' else pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(x0)::text) end, ', ') from pg_catalog.unnest(p.polroles) x0) as papeis
             from pg_catalog.pg_policy p where p.polrelid = p_tabela order by p.polname loop
    v_ddl := v_ddl || pg_catalog.format('create policy %I on %I.%I as %s for %s to %s%s%s', r.polname, v_nsp, v_rel,
      case when r.polpermissive then 'permissive' else 'restrictive' end,
      case r.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
      r.papeis, coalesce(' using (' || r.q || ')', ''), coalesce(' with check (' || r.w || ')', ''));
  end loop;
  for r in select g.tgname, pg_catalog.pg_get_triggerdef(g.oid) as def, g.tgenabled
             from pg_catalog.pg_trigger g where g.tgrelid = p_tabela and not g.tgisinternal order by g.tgname loop
    v_ddl := v_ddl || r.def;
    if r.tgenabled = 'D' then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I disable trigger %I', v_nsp, v_rel, r.tgname);
    elsif r.tgenabled = 'A' then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I enable always trigger %I', v_nsp, v_rel, r.tgname);
    elsif r.tgenabled = 'R' then v_ddl := v_ddl || pg_catalog.format('alter table %I.%I enable replica trigger %I', v_nsp, v_rel, r.tgname);
    end if;
  end loop;
  v_ddl := v_ddl || pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_rel);
  for r in select x0.grantee, x0.privilege_type, x0.is_grantable
             from pg_catalog.pg_class c, pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) x0
            where c.oid = p_tabela and x0.grantee <> c.relowner loop
    v_ddl := v_ddl || pg_catalog.format('grant %s on table %I.%I to %s%s', r.privilege_type, v_nsp, v_rel,
      case when r.grantee = 0 then 'public' else pg_catalog.quote_ident(pg_catalog.pg_get_userbyid(r.grantee)::text) end,
      case when r.is_grantable then ' with grant option' else '' end);
  end loop;
  if v_com is not null then v_ddl := v_ddl || pg_catalog.format('comment on table %I.%I is %L', v_nsp, v_rel, v_com); end if;
  select pg_catalog.string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped;
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_catalog.pg_attribute a where a.attrelid = p_tabela and a.attname = p_coluna and not a.attisdropped;
  if v_tipo is null then raise exception 'M2:coluna_ausente: %', p_coluna using errcode = '22023'; end if;

  -- a antiga sai do caminho: nome, índices, chaves estrangeiras (sai do fecho de cascata) e concessões
  v_antiga := v_rel || '_antiga';
  execute pg_catalog.format('alter table %I.%I rename to %I', v_nsp, v_rel, v_antiga);
  for r in select ic.relname from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid where i.indrelid = p_tabela loop
    execute pg_catalog.format('alter index %I.%I rename to %I', v_nsp, r.relname, pg_catalog.left(r.relname, 56) || '_antiga');
  end loop;
  foreach x in array v_fks loop
    execute pg_catalog.format('alter table %I.%I drop constraint %I', v_nsp, v_antiga, x);
  end loop;
  execute pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_antiga);

  -- a nova: mesmas colunas, defaults e checks (LIKE), particionada pela coluna de tempo; depois o DDL capturado
  execute pg_catalog.format('create table %I.%I (like %I.%I including defaults including constraints including generated including identity including storage including comments including statistics) partition by range (%I)',
    v_nsp, v_rel, v_nsp, v_antiga, p_coluna);
  v_nova := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_nsp, v_rel));
  foreach x in array v_ddl loop execute x; end loop;

  -- partições: do mês de min(coluna) (vazia: o corrente) até 12 à frente. Mês em São Paulo.
  execute pg_catalog.format('select (min(%I)%s)::date from %I.%I', p_coluna,
    case when v_tipo = 'timestamp with time zone' then ' at time zone ''America/Sao_Paulo''' else '' end, v_nsp, v_antiga) into v_min;
  v_ate := (obs_part.mes_corrente_sp() + interval '12 months')::date;
  v_mes := least(coalesce(obs_part.primeiro_dia(v_min), obs_part.mes_corrente_sp()), obs_part.mes_corrente_sp());
  while v_mes <= v_ate loop
    perform obs_part.criar_particao(v_nova, v_mes);
    v_meses := v_meses + 1;
    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  -- a cópia e a conferência: contagem e soma iguais, ou tudo desfaz
  execute pg_catalog.format('insert into %I.%I (%s) select %s from %I.%I', v_nsp, v_rel, v_cols, v_cols, v_nsp, v_antiga);
  execute pg_catalog.format('select count(*), coalesce(sum(%I), 0) from %I.%I', p_soma, v_nsp, v_antiga) into v_n_antes, v_s_antes;
  execute pg_catalog.format('select count(*), coalesce(sum(%I), 0) from %I.%I', p_soma, v_nsp, v_rel) into v_n_depois, v_s_depois;
  if v_n_antes <> v_n_depois or v_s_antes <> v_s_depois then
    raise exception 'M2:copia_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001',
      detail = pg_catalog.format('antes %s linhas e soma %s; depois %s e %s', v_n_antes, v_s_antes, v_n_depois, v_s_depois);
  end if;

  v_depois := obs_part.assinatura(v_nova);
  if v_depois is distinct from v_antes then
    select pg_catalog.string_agg(k, ', ' order by k) into v_diff from pg_catalog.jsonb_object_keys(v_antes) k where v_antes -> k is distinct from v_depois -> k;
    raise exception 'M2:catalogo_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = coalesce(v_diff, 'chaves');
  end if;

  insert into public.obs_partition_conversions (table_name, old_table, partition_column, converted_at, rows_copied, views_sum, signature)
  values (v_nsp || '.' || v_rel, v_nsp || '.' || v_antiga, p_coluna, pg_catalog.now(), v_n_depois, v_s_depois, v_antes)
  on conflict (table_name) do update set old_table = excluded.old_table, partition_column = excluded.partition_column,
    converted_at = excluded.converted_at, rows_copied = excluded.rows_copied, views_sum = excluded.views_sum, signature = excluded.signature;

  return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', true, 'linhas', v_n_depois, 'soma', v_s_depois, 'meses', v_meses);
end $$;

revoke all on function obs_part.primeiro_dia(date) from public, anon, authenticated, service_role;
revoke all on function obs_part.mes_corrente_sp() from public, anon, authenticated, service_role;
revoke all on function obs_part.nome_da_particao(text, date) from public, anon, authenticated, service_role;
revoke all on function obs_part.criar_particao(regclass, date) from public, anon, authenticated, service_role;
revoke all on function obs_part.assinatura(regclass) from public, anon, authenticated, service_role;
revoke all on function obs_part.dependentes(regclass) from public, anon, authenticated, service_role;
revoke all on function obs_part.converter(regclass, text, text) from public, anon, authenticated, service_role;

-- 7b. A volta atrás dos 7 dias (02 §10.2: "a antiga fica 7 dias como volta atrás"). Só o dono, pelo SQL do painel; ninguém tem execute.
--     Numa transação: a antiga recebe o conteúdo ATUAL da nova (a nova é a verdade: linhas gravadas, atualizadas e apagadas em cascata
--     depois da conversão), volta ao nome, aos índices, às chaves estrangeiras e às concessões de antes (pela assinatura gravada) e a
--     assinatura final tem de ser igual à de antes, ou tudo desfaz. A nova fica como <tabela>_particionada, sem FK e sem concessão.
--     Sem dado: sem registro ou sem assinatura → M2:sem_registro; sem a antiga (já removida no sétimo dia) → M2:antiga_ausente;
--     tabela já comum → {feito: false, motivo: 'nao_particionada'}.
create or replace function obs_part.desfazer(p_tabela regclass) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_nsp text; v_rel text; v_kind "char"; v_antiga text; v_volta regclass; v_cols text; v_parada text;
  v_reg record; v_dep text[]; v_depois jsonb; v_diff text; v_n_nova bigint; v_n_volta bigint;
  r record; x jsonb;
begin
  select n.nspname, c.relname, c.relkind into v_nsp, v_rel, v_kind
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where c.oid = p_tabela;
  if v_kind is distinct from 'p' then
    return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', false, 'motivo', 'nao_particionada');
  end if;
  select c.* into v_reg from public.obs_partition_conversions c where c.table_name = v_nsp || '.' || v_rel;
  if v_reg.table_name is null or v_reg.signature is null then
    raise exception 'M2:sem_registro: %', v_nsp || '.' || v_rel using errcode = 'P0001';
  end if;
  if pg_catalog.to_regclass(v_reg.old_table) is null then
    raise exception 'M2:antiga_ausente: %', v_reg.old_table using errcode = 'P0001';
  end if;
  v_antiga := v_rel || '_antiga';
  v_parada := pg_catalog.left(v_rel, 49) || '_particionada';
  execute pg_catalog.format('lock table %I.%I, %I.%I in access exclusive mode', v_nsp, v_rel, v_nsp, v_antiga);
  v_dep := obs_part.dependentes(p_tabela);
  if pg_catalog.cardinality(v_dep) > 0 then
    raise exception 'M2:dependente_novo: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = pg_catalog.array_to_string(v_dep, '; ');
  end if;

  -- 1. o conteúdo: a antiga passa a ter exatamente o que a nova tem
  select pg_catalog.string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped;
  execute pg_catalog.format('truncate %I.%I', v_nsp, v_antiga);
  execute pg_catalog.format('insert into %I.%I (%s) select %s from %I.%I', v_nsp, v_antiga, v_cols, v_cols, v_nsp, v_rel);
  execute pg_catalog.format('select count(*) from %I.%I', v_nsp, v_rel) into v_n_nova;
  execute pg_catalog.format('select count(*) from %I.%I', v_nsp, v_antiga) into v_n_volta;
  if v_n_nova <> v_n_volta then
    raise exception 'M2:volta_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = pg_catalog.format('nova %s linhas; antiga %s', v_n_nova, v_n_volta);
  end if;

  -- 2. a nova sai do caminho: nome, índices, chaves estrangeiras (sai do fecho de cascata) e concessões
  for r in select ic.relname from pg_catalog.pg_index i join pg_catalog.pg_class ic on ic.oid = i.indexrelid where i.indrelid = p_tabela loop
    execute pg_catalog.format('alter index %I.%I rename to %I', v_nsp, r.relname, pg_catalog.left(r.relname, 50) || '_particao');
  end loop;
  for r in select k.conname from pg_catalog.pg_constraint k where k.conrelid = p_tabela and k.contype = 'f' and k.conparentid = 0 loop
    execute pg_catalog.format('alter table %I.%I drop constraint %I', v_nsp, v_rel, r.conname);
  end loop;
  execute pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_rel);
  execute pg_catalog.format('alter table %I.%I rename to %I', v_nsp, v_rel, v_parada);

  -- 3. a antiga volta: nome, índices (o conversor os renomeou para left(nome, 56) || '_antiga'), FKs e concessões da assinatura
  execute pg_catalog.format('alter table %I.%I rename to %I', v_nsp, v_antiga, v_rel);
  v_volta := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_nsp, v_rel));
  for x in select * from pg_catalog.jsonb_array_elements(v_reg.signature -> 'indices') loop
    if pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_nsp, pg_catalog.left(x ->> 0, 56) || '_antiga')) is not null then
      execute pg_catalog.format('alter index %I.%I rename to %I', v_nsp, pg_catalog.left(x ->> 0, 56) || '_antiga', x ->> 0);
    end if;
  end loop;
  for x in select * from pg_catalog.jsonb_array_elements(v_reg.signature -> 'constraints') loop
    if x ->> 1 = 'f' then
      execute pg_catalog.format('alter table %I.%I add constraint %I %s', v_nsp, v_rel, x ->> 0, x ->> 2);
    end if;
  end loop;
  execute pg_catalog.format('revoke all on table %I.%I from public, anon, authenticated, service_role', v_nsp, v_rel);
  for x in select * from pg_catalog.jsonb_array_elements(v_reg.signature -> 'concessoes') loop
    continue when x ->> 0 = (select pg_catalog.pg_get_userbyid(c.relowner)::text from pg_catalog.pg_class c where c.oid = v_volta);
    execute pg_catalog.format('grant %s on table %I.%I to %s%s', x ->> 1, v_nsp, v_rel,
      case when x ->> 0 = 'public' then 'public' else pg_catalog.quote_ident(x ->> 0) end,
      case when (x ->> 2)::boolean then ' with grant option' else '' end);
  end loop;

  -- 4. a conferência: a assinatura de agora é a de antes da conversão, ou tudo desfaz
  v_depois := obs_part.assinatura(v_volta);
  if v_depois is distinct from v_reg.signature then
    select pg_catalog.string_agg(k, ', ' order by k) into v_diff from pg_catalog.jsonb_object_keys(v_reg.signature) k where v_reg.signature -> k is distinct from v_depois -> k;
    raise exception 'M2:volta_divergente: %', v_nsp || '.' || v_rel using errcode = 'P0001', detail = coalesce(v_diff, 'chaves');
  end if;
  delete from public.obs_partition_conversions c where c.table_name = v_nsp || '.' || v_rel;
  return pg_catalog.jsonb_build_object('tabela', v_nsp || '.' || v_rel, 'feito', true, 'linhas', v_n_volta, 'particionada_fica_em', v_nsp || '.' || v_parada);
end $$;
revoke all on function obs_part.desfazer(regclass) from public, anon, authenticated, service_role;

-- 8. A tabela de ensaio (03 §13.3): mesma forma da leitura horária, sem FK, só linhas sintéticas. Partições: criadas pela carga da M8.
create table if not exists public.obs_archive_rehearsal (
  video_id uuid not null,
  hour_slot timestamptz not null,
  taken_at timestamptz not null,
  site_id uuid not null,
  views bigint not null,
  likes bigint,
  comments bigint,
  synthetic boolean not null default true,
  constraint obs_archive_rehearsal_pkey primary key (video_id, hour_slot),
  constraint obs_archive_rehearsal_check check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC'),
  constraint obs_archive_rehearsal_synthetic check (synthetic)
) partition by range (hour_slot);
alter table public.obs_archive_rehearsal enable row level security;
revoke all on table public.obs_archive_rehearsal from anon, authenticated;
comment on table public.obs_archive_rehearsal is 'Dado de teste do ensaio do arquivo (classe ensaio). Sem FK de propósito (fica fora do fecho de cascata). Só o grupo "Dado de teste" da página do arquivo a lê, pelo servidor.';

-- 9. Criar o que falta à frente (chamada pela tarefa diária particoes_a_frente). Nunca cria mês passado nem mês destacado. Criar partição trava a mãe em access exclusive (medido): no máximo 3 s, uma vez por mês por tabela.
create or replace function public.obs_partitions_ensure(p_months_ahead integer default 12)
returns table (table_name text, last_month date, created integer)
language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare
  v_t text;
  v_oid regclass;
  v_corrente date := obs_part.mes_corrente_sp();
  v_mes date;
  v_criadas integer;
  v_ultimo date;
  v_bloqueado boolean;
  v_tem_registro boolean := pg_catalog.to_regclass('public.obs_archive_months') is not null;
begin
  if p_months_ahead is null or p_months_ahead < 1 or p_months_ahead > 24 then
    raise exception 'M2:meses_fora_da_faixa' using errcode = '22023';
  end if;
  foreach v_t in array array['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] loop
    v_oid := pg_catalog.to_regclass('public.' || v_t);
    if v_oid is null or (select c.relkind from pg_catalog.pg_class c where c.oid = v_oid) <> 'p' then
      raise exception 'M2:tabela_nao_particionada: %', v_t using errcode = 'P0001';
    end if;
    v_criadas := 0;
    v_ultimo := null;
    for i in 0 .. p_months_ahead loop
      v_mes := (v_corrente + pg_catalog.make_interval(months => i))::date;
      v_bloqueado := false;
      if v_tem_registro then
        execute 'select exists (select 1 from public.obs_archive_months m where m.table_name = $1 and m.month = $2 and (m.detached_at is not null or m.dropped_at is not null))'
          into v_bloqueado using v_t, v_mes;
      end if;
      continue when v_bloqueado;
      if obs_part.criar_particao(v_oid, v_mes) then v_criadas := v_criadas + 1; end if;
      v_ultimo := v_mes;
    end loop;
    table_name := v_t; last_month := v_ultimo; created := v_criadas;
    return next;
  end loop;
end $$;

-- 10. O invariante "meses à frente", lido pelo vigia. Contíguos a partir do corrente; -1 = corrente ausente; null = não particionada.
create or replace function public.obs_partitions_months_ahead()
returns table (table_name text, months_ahead integer, last_month date, converted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_t text;
  v_oid regclass;
  v_corrente date := obs_part.mes_corrente_sp();
  v_mes date;
begin
  foreach v_t in array array['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] loop
    v_oid := pg_catalog.to_regclass('public.' || v_t);
    table_name := v_t;
    converted_at := (select c.converted_at from public.obs_partition_conversions c where c.table_name = 'public.' || v_t);
    months_ahead := null;
    last_month := null;
    if v_oid is not null and (select c.relkind from pg_catalog.pg_class c where c.oid = v_oid) = 'p' then
      months_ahead := -1;
      for i in 0 .. 36 loop
        v_mes := (v_corrente + pg_catalog.make_interval(months => i))::date;
        exit when not exists (
          select 1 from pg_catalog.pg_inherits h
            join pg_catalog.pg_class c on c.oid = h.inhrelid
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where h.inhparent = v_oid and n.nspname = 'obs_part' and c.relname = obs_part.nome_da_particao(v_t, v_mes));
        months_ahead := i;
        last_month := v_mes;
      end loop;
    end if;
    return next;
  end loop;
end $$;

revoke all on function public.obs_partitions_ensure(integer) from public, anon, authenticated;
revoke all on function public.obs_partitions_months_ahead() from public, anon, authenticated;
grant execute on function public.obs_partitions_ensure(integer) to service_role;
grant execute on function public.obs_partitions_months_ahead() to service_role;

-- 11. Pedidos 1 e 3: se a MG6 da E10 já estiver aplicada sem o conserto, recria as duas funções com ele.
--     Função ausente: nada (o teste das migrations segura a ordem inversa). Corpo diferente do conhecido e sem o conserto: recusa.
do $$
declare
  v_src text;
begin
  select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.obs_archive_uncovered()');
  if v_src is not null and v_src !~ 'relispartition' then
    if pg_catalog.md5(v_src) <> '04acb555daf84c61933b740e13a85e21' then
      raise exception 'M2:obs_archive_uncovered_divergente' using errcode = 'P0001',
        detail = 'o corpo instalado não é o da fixture de 14/10: copiar o corpo instalado com a cláusula do pedido 1 para esta migration';
    end if;
    execute $f$
create or replace function public.obs_archive_uncovered()
returns text[]
language sql
stable
security definer
set search_path = ''
as $b$
  with recursive alvo (rel) as (
    select 'public.competitor_channels'::regclass::oid
    union
    select k.conrelid
      from pg_catalog.pg_constraint k
      join alvo a on k.confrelid = a.rel
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  )
  select coalesce(array_agg(c.relname::text order by c.relname::text), '{}'::text[])
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where not c.relispartition
     and not (n.nspname = 'public' and c.relname::text in (select r.table_name from public.obs_archive_registry() r))
     and not (n.nspname = 'public' and c.relname::text in (select e.table_name from public.obs_archive_excluded() e));
$b$;
$f$;
  end if;

  select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.obs_db_size_record(timestamp with time zone)');
  if v_src is not null and v_src !~ 'relispartition' then
    if pg_catalog.md5(v_src) <> '3b6daeff58c7e884d8b6e944c8e234a7' then
      raise exception 'M2:obs_db_size_record_divergente' using errcode = 'P0001',
        detail = 'o corpo instalado não é o da fixture de 14/10: copiar o corpo instalado com o conserto do pedido 3 para esta migration';
    end if;
    execute $f$
create or replace function public.obs_db_size_record(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $b$
declare
  v_day date;
  v_db bigint;
  v_comp bigint;
  v_own bigint;
  v_top jsonb;
begin
  if p_now is null then
    raise exception 'E10:parametro_nulo: obs_db_size_record' using errcode = '22023';
  end if;
  v_day := (p_now at time zone 'America/Sao_Paulo')::date;
  v_db := pg_catalog.pg_database_size(pg_catalog.current_database());
  select coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where m.mae like 'competitor\_%'), 0)::bigint,
         coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where m.mae like 'yt\_own\_%' or m.mae like 'yt\_reporting\_%'), 0)::bigint
    into v_comp, v_own
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral (
      select case
               when c.relispartition then (select r.relname::text from pg_catalog.pg_class r where r.oid = pg_catalog.pg_partition_root(c.oid))
               when n.nspname = 'obs_part' then pg_catalog.regexp_replace(c.relname::text, '_[0-9]{6}_saida$', '')
               else c.relname::text
             end as mae
    ) m
   where n.nspname in ('public', 'obs_part') and c.relkind in ('r', 'p');
  select coalesce(jsonb_object_agg(z.nome, z.bytes), '{}'::jsonb) into v_top
    from (
      select y.nome, sum(y.bytes)::bigint as bytes
        from (
          select case
                   when c.relispartition then 'public.' || (select r.relname::text from pg_catalog.pg_class r where r.oid = pg_catalog.pg_partition_root(c.oid))
                   when n.nspname = 'obs_part' then 'public.' || pg_catalog.regexp_replace(c.relname::text, '_[0-9]{6}_saida$', '')
                   else n.nspname || '.' || c.relname
                 end as nome,
                 pg_catalog.pg_total_relation_size(c.oid) as bytes
            from pg_catalog.pg_class c
            join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where c.relkind in ('r', 'm', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
        ) y
       group by y.nome
       order by 2 desc, 1
       limit 30
    ) z;
  insert into public.obs_db_size_daily as d (day, db_bytes, competitor_bytes, own_bytes, measured_at, top_relations)
  values (v_day, v_db, v_comp, v_own, p_now, v_top)
  on conflict (day) do update
    set db_bytes = excluded.db_bytes, competitor_bytes = excluded.competitor_bytes, own_bytes = excluded.own_bytes,
        measured_at = excluded.measured_at, top_relations = excluded.top_relations;
  return jsonb_build_object('day', v_day, 'db_bytes', v_db, 'competitor_bytes', v_comp, 'own_bytes', v_own, 'measured_at', p_now);
end $b$;
$f$;
  end if;
end $$;

-- 11b. A guarda independente de competitor_channel_remove_archived conta n_tup_del por tabela do fecho de cascata; depois da conversão a mãe
--      particionada tem n_tup_del 0 (a estatística é por folha) e as partições entrariam no fecho pelas chaves herdadas. Aqui: o fecho só com
--      relações que não são partição, e o n_tup_del de cada uma é a soma das folhas de pg_partition_tree (a tabela comum é ela mesma: pg_partition_tree não devolve linha para quem não é partição).
--      Ausente: nada. Já com o conserto (pg_partition_tree): nada. Corpo diferente do conhecido: recusa.
do $$
declare
  v_src text;
begin
  select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.competitor_channel_remove_archived(uuid,uuid,uuid)');
  if v_src is not null and v_src !~ 'pg_partition_tree' then
    if pg_catalog.md5(v_src) <> '467d3bc3c887af98196c8e415780d40b' then
      raise exception 'M2:competitor_channel_remove_archived_divergente' using errcode = 'P0001',
        detail = 'o corpo instalado não é o da fixture de 14/10: copiar o corpo instalado com a guarda por folhas para esta migration';
    end if;
    execute $f$
create or replace function public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $b$
declare
  v_batch text;
  v_c record;
  v_falta text[];
  v_urls text[];
  v_linhas bigint;
  v_arquivos integer;
  v_featured integer;
  v_refs jsonb;       -- (revisão Phil 14/10, I-5) quais comentários de OUTROS canais destacavam este: o set null os zera, o rastro fica no audit_log
  v_base jsonb;       -- (revisão Phil 14/10, I-2; M2 11b: soma das folhas da partição) n_tup_del de cada tabela do fecho de cascata, antes do delete
  v_t record;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_actor is null then
    raise exception 'E10:parametro_nulo: competitor_channel_remove_archived' using errcode = '22023';
  end if;
  v_falta := public.obs_archive_uncovered();
  if cardinality(v_falta) > 0 then
    raise exception 'E10:tabela_sem_export: %', array_to_string(v_falta, ', ') using errcode = 'P0001';
  end if;
  select c.channel_id, c.channel_name into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  -- (revisão Yannis 14/10, M-4) a irreversível confere o ator como as outras funções que escrevem em nome de alguém
  if not public.obs_archive_is_site_admin(p_site, p_actor) then
    raise exception 'E10:sem_direito: só quem administra o site remove um canal exportado' using errcode = '42501';
  end if;
  -- o lote mais recente deste canal que ainda não foi apagado
  select b.batch into v_batch
    from public.obs_archive_batches b
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null
   order by b.exported_at desc, b.batch desc
   limit 1;
  if v_batch is null then
    raise exception 'E10:sem_lote: este canal ainda não foi exportado' using errcode = 'P0001';
  end if;
  perform public.obs_archive_guard(p_site, v_batch, p_channel, 'confirmado');
  perform 1 from public.competitor_videos v where v.competitor_channel_id = p_channel for update;
  if to_regclass('public.competitor_video_comments') is not null then
    perform 1 from public.competitor_video_comments k
      where k.competitor_channel_id = p_channel
         or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)
      for update;
  end if;
  if exists (select 1 from public.obs_archive_diff(p_site, v_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, v_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_urls
    from public.competitor_video_versions x
    join public.competitor_videos v on v.id = x.video_id
   where v.competitor_channel_id = p_channel and x.thumb_blob_url is not null;
  select count(*) into v_featured from public.competitor_video_comments k
   where k.featured_channel_id = p_channel and k.competitor_channel_id <> p_channel;
  select coalesce(jsonb_agg(jsonb_build_object('comment_id', k.id, 'video_id', k.video_id, 'channel_ref', k.competitor_channel_id) order by k.id), '[]'::jsonb) into v_refs
    from public.competitor_video_comments k
   where k.featured_channel_id = p_channel and k.competitor_channel_id <> p_channel;
  select sum(b.row_count), count(*) into v_linhas, v_arquivos
    from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text and b.deleted_at is null;

  -- (revisão Phil 14/10, I-2) Conferência INDEPENDENTE do registro. `obs_archive_diff` e `sobrou_linha` usam `obs_archive_registry()`, a mesma
  -- lista que fez o export: um filtro errado numa entrada dava verde nas três conferências e a cascata apagava linha que nunca foi para o
  -- arquivo. Aqui o próprio Postgres conta, por transação (pg_stat_xact_user_tables.n_tup_del, que inclui a cascata), quantas linhas cada
  -- tabela do fecho perdeu, e o fecho vem do CATÁLOGO (chaves estrangeiras em cascata), não do registro. Cada tabela tem de perder
  -- exatamente o que o lote arquivou; a exceção declarada (obs_archive_excluded, os autores de comentário) fica de fora. Diferiu: a
  -- transação inteira desfaz. Sem track_counts a contagem é sempre zero e não vale: recusa também.
  if pg_catalog.current_setting('track_counts') <> 'on' then
    raise exception 'E10:apagou_alem_do_arquivo: track_counts desligado' using errcode = 'P0001';
  end if;
  with recursive alvo (rel) as (
    select 'public.competitor_channels'::regclass::oid
    union
    select k.conrelid from pg_catalog.pg_constraint k join alvo a on k.confrelid = a.rel
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  )
  select coalesce(jsonb_object_agg(c.relname::text, coalesce((select sum(x.n_tup_del) from pg_catalog.pg_stat_xact_user_tables x where x.relid = c.oid or x.relid in (select pt.relid from pg_catalog.pg_partition_tree(c.oid) pt where pt.isleaf)), 0)), '{}'::jsonb) into v_base
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not c.relispartition;

  delete from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;

  for v_t in
    with recursive alvo (rel) as (
      select 'public.competitor_channels'::regclass::oid
      union
      select k.conrelid from pg_catalog.pg_constraint k join alvo a on k.confrelid = a.rel
       where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
    )
    select c.relname::text as nome,
           coalesce((select sum(x.n_tup_del) from pg_catalog.pg_stat_xact_user_tables x where x.relid = c.oid or x.relid in (select pt.relid from pg_catalog.pg_partition_tree(c.oid) pt where pt.isleaf)), 0) - coalesce((v_base ->> c.relname::text)::bigint, 0) as apagadas,
           coalesce((select sum(b.row_count) from public.obs_archive_batches b
                      where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text
                        and b.table_name = c.relname::text and b.deleted_at is null), 0) as arquivadas
      from alvo a
      join pg_catalog.pg_class c on c.oid = a.rel
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not c.relispartition
       and c.relname::text not in (select e.table_name from public.obs_archive_excluded() e)
     order by 1
  loop
    if v_t.apagadas <> v_t.arquivadas then
      raise exception 'E10:apagou_alem_do_arquivo: % apagadas=% arquivadas=%', v_t.nome, v_t.apagadas, v_t.arquivadas using errcode = 'P0001';
    end if;
  end loop;

  if exists (select 1 from public.obs_archive_channel_counts(p_channel)) then
    raise exception 'E10:sobrou_linha: uma tabela do registro não apaga em cascata' using errcode = 'P0001';
  end if;
  update public.obs_archive_batches b
     set deleted_at = v_now, rows_deleted = b.row_count,
         blob_urls_pending = case when b.table_name = 'competitor_channels' then v_urls else b.blob_urls_pending end
   where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  -- (emenda 1: D-I3, S-M4) os outros lotes abertos deste canal apontam para um canal que não existe mais: encerrados
  update public.obs_archive_batches b
     set closed_at = v_now, closed_reason = 'substituido'
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null and b.closed_at is null;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  select p_actor, 'observatorio_canal_removido_com_arquivo', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('channel_id', v_c.channel_id, 'channel_name', v_c.channel_name),
         jsonb_build_object('batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'miniaturas_no_blob', cardinality(v_urls), 'featured_refs_cleared', v_featured, 'featured_refs', v_refs)
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'removido', 'batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'blob_urls', to_jsonb(v_urls), 'featured_refs_cleared', v_featured);
end $b$;
$f$;
    revoke all on function public.competitor_channel_remove_archived(uuid, uuid, uuid) from public, anon, authenticated;
    grant execute on function public.competitor_channel_remove_archived(uuid, uuid, uuid) to service_role;
  end if;
end $$;

-- 12. A conversão das três séries: um só bloco, uma só transação (se uma falhar, nenhuma muda).
do $$
begin
  perform obs_part.converter('public.competitor_video_daily'::regclass, 'snap_date', 'views');
  perform obs_part.converter('public.competitor_video_early'::regclass, 'taken_at', 'views');
  perform obs_part.converter('public.competitor_video_hourly'::regclass, 'hour_slot', 'views');
end $$;

-- o autovacuum nunca analisa a mãe particionada, só as partições: a estatística da mãe nasce aqui
analyze public.competitor_video_daily, public.competitor_video_early, public.competitor_video_hourly;

notify pgrst, 'reload schema';
