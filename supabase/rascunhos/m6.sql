-- Manutenção M6: a saída do mês. RASCUNHO (TRAVA M6-1): fora de supabase/migrations até a Tarefa 14 do plano
-- docs/superpowers/plans/2026-10-14-manutencao-nas-m6-saida.md. Depende de M2 (obs_part, partições) e M3b (registro).
-- M6 PARTE 1: o hash sobre uma relação (a partição anexada ou a tabela destacada)
-- obs-archive-hash-rel.sql: início
-- Tabela-mãe (p_rel nulo), partição anexada ou tabela destacada (_saida): o mesmo from_where da M3b, trocando só a relação (M6, decisão 5).
create or replace function public.obs_archive_unit_source_rel(p_class text, p_table text, p_rel regclass)
returns table (rel regclass, from_where text, order_by text, control_expr text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record;
  v_modo text;
  v_de text;
begin
  select * into s from public.obs_archive_unit_source(p_class, p_table);
  if p_rel is null then
    rel := s.rel; from_where := s.from_where; order_by := s.order_by; control_expr := s.control_expr;
    return next; return;
  end if;
  select p.exit_mode into v_modo from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  if v_modo is distinct from 'particao' then raise exception 'relacao_so_em_particao' using errcode = 'P0001', detail = p_class || '/' || p_table; end if;
  if not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                  where c.oid = p_rel and n.nspname = 'obs_part' and c.relname::text ~ ('^' || p_table || '_[0-9]{6}(_saida)?$')) then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text;
  end if;
  v_de := 'from public.' || pg_catalog.quote_ident(p_table) || ' t ';
  rel := p_rel; order_by := s.order_by; control_expr := s.control_expr;
  from_where := pg_catalog.replace(s.from_where, v_de, 'from ' || p_rel::text || ' t ');
  if from_where = s.from_where then raise exception 'fonte_sem_tabela' using errcode = 'P0001', detail = p_table; end if;
  return next;
end $$;

-- Os três valores de obs_archive_content_hash, lidos de p_rel (sem paginação). Mesma serialização de obs_archive_read_unit.
create or replace function public.obs_archive_content_hash_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date)
returns table (row_count bigint, control_sum text, hash_conteudo text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v_cols text;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_rel is not null and p_rel::text !~ ('_' || pg_catalog.to_char(p_month, 'YYYYMM') || '(_saida)?$') then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text || ' não é a relação de ' || p_month::text;   -- m-13
  end if;
  select * into s from public.obs_archive_unit_source_rel(p_class, p_table, p_rel);
  select string_agg('t.' || pg_catalog.quote_ident(a.attname) || '::text', ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = (select x.rel from public.obs_archive_unit_source(p_class, p_table) x) and a.attnum > 0 and not a.attisdropped;
  return query execute format(
    'with u as (select to_jsonb(array[%1$s]::text[]) as r, %2$s as c, row_number() over (order by %3$s) as n %4$s)
     select (select count(*) from u)::bigint,
            (coalesce((select sum(u.c) from u), $7::numeric))::text,
            (select encode(sha256(convert_to(coalesce(string_agg(u.r::text, E''\n'' order by u.n), ''''), ''UTF8'')), ''hex'') from u)',
    v_cols, s.control_expr, s.order_by, s.from_where)
  using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date,
        case when s.control_expr = 'null::numeric' then null::numeric else 0::numeric end;
end $$;

-- C-1/I1: o resumo da LINHA INTEIRA do canal no mês, sobre as mesmas linhas do from_where do hash. A conferência o guarda; o tally o compara sob a trava
-- (o hash caro roda antes da trava; contagem e soma sozinhas não pegam uma coluna que não é a de controle).
create or replace function public.obs_archive_row_digest_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date)
returns numeric
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v numeric;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_rel is not null and p_rel::text !~ ('_' || pg_catalog.to_char(p_month, 'YYYYMM') || '(_saida)?$') then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text;
  end if;
  select * into s from public.obs_archive_unit_source_rel(p_class, p_table, p_rel);
  execute pg_catalog.format('select coalesce(sum(pg_catalog.hashtextextended(t::text, 0)::numeric), 0) %s', s.from_where)
    into v using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date;
  return v;
end $$;
revoke all on function public.obs_archive_unit_source_rel(text, text, regclass) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_row_digest_rel(uuid, text, text, regclass, uuid, date) from public, anon, authenticated, service_role;
-- obs-archive-hash-rel.sql: fim
-- M6 PARTE 2: o invariante do mês destacado
-- O invariante (02 §10.5): enquanto existir mês destacado e não descartado, de qualquer site e de qualquer tabela que sai por partição
-- (inclusive o ensaio), nada apaga vídeo nem canal de concorrente. VOLATILE: em read committed, lê retrato novo e enxerga um destaque
-- confirmado enquanto o apagamento esperava a trava.
create or replace function public.obs_archive_block_delete_while_detached()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_meses text;
begin
  select string_agg(m.table_name || ' ' || pg_catalog.to_char(m.month, 'MM/YYYY'), ', ' order by m.month, m.table_name) into v_meses
    from public.obs_archive_months m
   where m.detached_at is not null and m.dropped_at is null;
  if v_meses is not null then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001', detail = v_meses;
  end if;
  if tg_level = 'ROW' then return old; end if;
  return null;
end $$;
revoke all on function public.obs_archive_block_delete_while_detached() from public, anon, authenticated, service_role;

-- Nomes com "a_": em ordem alfabética antes de obs_archive_z_destino_declarado e obs_archive_z_truncate (M3b). O teste de ordem é da M6.
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_videos;
create trigger obs_archive_a_mes_destacado before delete on public.competitor_videos
  for each row execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_videos;
create trigger obs_archive_a_mes_destacado_truncate before truncate on public.competitor_videos
  for each statement execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_channels;
create trigger obs_archive_a_mes_destacado before delete on public.competitor_channels
  for each row execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_channels;
create trigger obs_archive_a_mes_destacado_truncate before truncate on public.competitor_channels
  for each statement execute function public.obs_archive_block_delete_while_detached();

-- Os quatro gatilhos, ligados ('O' ou 'A'); 'D' e 'R' contam como ausentes (MEDIDO 13/10: com 'R' o apagamento passa).
create or replace function public.obs_archive_invariante_faltam()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.tab || '.' || e.nome order by e.tab, e.nome) filter (where t.oid is null), '{}'::text[])
    from (values ('competitor_videos', 'obs_archive_a_mes_destacado'), ('competitor_videos', 'obs_archive_a_mes_destacado_truncate'),
                 ('competitor_channels', 'obs_archive_a_mes_destacado'), ('competitor_channels', 'obs_archive_a_mes_destacado_truncate')) e(tab, nome)
    left join pg_catalog.pg_trigger t
      on t.tgrelid = pg_catalog.to_regclass('public.' || e.tab) and t.tgname = e.nome and t.tgenabled in ('O', 'A')
     and t.tgfoid = 'public.obs_archive_block_delete_while_detached()'::pg_catalog.regprocedure
$$;
revoke all on function public.obs_archive_invariante_faltam() from public, anon, authenticated;
grant execute on function public.obs_archive_invariante_faltam() to service_role;

-- Item 89: o mês destacado é imutável no registro também (expurgo e reexportação esperam o reattach).
create or replace function public.obs_archive_unit_in_detached_month() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (select 1 from public.obs_archive_months m
              where m.site_id = new.site_id and m.class = new.class and m.table_name = new.table_name and m.month = new.month
                and m.detached_at is not null and m.dropped_at is null) then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001', detail = new.table_name || ' ' || pg_catalog.to_char(new.month, 'MM/YYYY');
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_unit_in_detached_month() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_a_unidade_em_mes_destacado on public.obs_archive_units;
create trigger obs_archive_a_unidade_em_mes_destacado before insert on public.obs_archive_units
  for each row execute function public.obs_archive_unit_in_detached_month();
-- M6 PARTE 3: colunas novas, o portão e a conferência por canal
-- M6 PARTE 4: destacar e trazer de volta
-- M6 PARTE 5: descartar e a composta
-- M6 PARTE 6 [M6a]: contadores do interruptor, simulação vista, em trânsito, vermelhos da saída e encerrar o dado de teste
-- M6 PARTE 7 [M6b]: o interruptor (estado, ligar, desligar, vigia), os candidatos, o vermelho do desarme e a próxima saída
