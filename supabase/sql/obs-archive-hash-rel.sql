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
