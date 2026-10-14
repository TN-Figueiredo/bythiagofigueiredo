-- O corpo único de obs_archive_schema_fp, obs_archive_unit_source, obs_archive_content_hash e obs_archive_read_unit (spec 02 §9.3,
-- decisão B; §10.4). Lido pela migration da M3b (byte a byte, entre marcadores) e pelo comando ensaiar-restauracao (M8).
-- Os cinco ajustes de sessão ficam no cabeçalho de cada função: o resultado não depende de quem chama.

create or replace function public.obs_archive_schema_fp(p_rel regclass)
returns text language sql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
  select encode(sha256(convert_to(string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), E'\n' order by a.attnum), 'UTF8')), 'hex')
    from pg_catalog.pg_attribute a
   where a.attrelid = p_rel and a.attnum > 0 and not a.attisdropped
$$;

create or replace function public.obs_archive_unit_source(p_class text, p_table text)
returns table (rel regclass, from_where text, order_by text, control_expr text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
-- $1 site, $2 canal, $3 mês (date, dia 1), $4 início e $5 fim do mês em São Paulo com -03 explícito (timestamptz), $6 dia 1 do mês seguinte (date)
declare
  v_rel regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_pol record;
  v_pk text;
  -- competitor_videos não tem site_id: o site vem do canal (Phil I1; 20261007000002_...:37).
  v_video text := 'join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id where ch.site_id = $1 and v.competitor_channel_id = $2';
begin
  select * into v_pol from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  if not found then raise exception 'classe_tabela_invalida' using errcode = 'P0001', detail = p_class || '/' || p_table; end if;
  if v_rel is null then raise exception 'tabela_ausente' using errcode = 'P0001', detail = p_table; end if;
  select string_agg('t.' || pg_catalog.quote_ident(a.attname), ', ' order by k.ord) into v_pk
    from pg_catalog.pg_index i
    cross join lateral unnest(i.indkey) with ordinality k(attnum, ord)
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
   where i.indrelid = v_rel and i.indisprimary;
  if v_pk is null then raise exception 'sem_chave_primaria' using errcode = 'P0001', detail = p_table; end if;
  rel := v_rel; order_by := v_pk;
  control_expr := case when v_pol.control_column is null then 'null::numeric' else 't.' || pg_catalog.quote_ident(v_pol.control_column) || '::numeric' end;
  from_where := case
    when p_class = 'horaria' then format('from public.%I t %s and t.hour_slot >= $4 and t.hour_slot < $5', p_table, v_video)
    when p_class = 'ensaio' then 'from public.obs_archive_rehearsal t join public.competitor_videos v on v.id = t.video_id where t.site_id = $1 and v.competitor_channel_id = $2 and t.hour_slot >= $4 and t.hour_slot < $5'
    when p_table = 'competitor_video_daily' then format('from public.%I t %s and t.snap_date >= $3 and t.snap_date < $6', p_table, v_video)
    when p_table = 'competitor_video_early' then format('from public.%I t %s and t.taken_at >= $4 and t.taken_at < $5', p_table, v_video)
    when p_class = 'texto' and p_table = 'competitor_video_comments' then
      'from public.competitor_video_comments t left join public.competitor_video_comments p on p.id = t.parent_id
        where t.site_id = $1 and t.competitor_channel_id = $2 and coalesce(p.first_seen_at, t.first_seen_at) >= $4 and coalesce(p.first_seen_at, t.first_seen_at) < $5'
    when p_class = 'texto' and p_table = 'competitor_video_comment_marks' then
      'from public.competitor_video_comment_marks t join public.competitor_video_comments k on k.id = t.comment_id
        left join public.competitor_video_comments p on p.id = k.parent_id
        where k.site_id = $1 and k.competitor_channel_id = $2 and coalesce(p.first_seen_at, k.first_seen_at) >= $4 and coalesce(p.first_seen_at, k.first_seen_at) < $5'
    when p_class = 'texto' and p_table = 'competitor_raw' then
      'from public.competitor_raw t where t.site_id = $1 and t.competitor_channel_id = $2 and not t.is_current and t.last_seen_at >= $4 and t.last_seen_at < $5'
    when p_class = 'video_antigo' and p_table = 'competitor_raw' then
      format('from public.competitor_raw t %s and t.is_current and v.archive_frozen_at >= $4 and v.archive_frozen_at < $5', v_video)
    when p_class = 'video_antigo' then
      format('from public.%I t %s and v.archive_frozen_at >= $4 and v.archive_frozen_at < $5', p_table, v_video)
  end;
  return next;
end $$;

create or replace function public.obs_archive_read_unit(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_offset bigint, p_limit integer)
returns table (rows jsonb, row_count bigint, control_sum text, hash_conteudo text, columns jsonb, schema_fp text, first_key text, last_key text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v_cols text; v_colnames jsonb; v_keyexpr text;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_offset < 0 or p_limit < 1 or p_limit > 50000 then raise exception 'faixa_invalida' using errcode = 'P0001'; end if;
  select * into s from public.obs_archive_unit_source(p_class, p_table);
  select string_agg('t.' || pg_catalog.quote_ident(a.attname) || '::text', ', ' order by a.attnum),
         jsonb_agg(jsonb_build_object('nome', a.attname, 'tipo', pg_catalog.format_type(a.atttypid, a.atttypmod), 'nulo', not a.attnotnull) order by a.attnum)
    into v_cols, v_colnames
    from pg_catalog.pg_attribute a where a.attrelid = s.rel and a.attnum > 0 and not a.attisdropped;
  v_keyexpr := 'concat_ws(''|'', ' || s.order_by || ')';
  return query execute format(
    'with u as (select to_jsonb(array[%1$s]::text[]) as r, %2$s as k, %3$s as c, row_number() over (order by %4$s) as n %5$s)
     select (select coalesce(jsonb_agg(u.r order by u.n), ''[]''::jsonb) from u where u.n > $7 and u.n <= $7 + $8),
            (select count(*) from u)::bigint,
            (coalesce((select sum(u.c) from u), $11::numeric))::text,
            (select encode(sha256(convert_to(coalesce(string_agg(u.r::text, E''\n'' order by u.n), ''''), ''UTF8'')), ''hex'') from u),
            $9::jsonb, public.obs_archive_schema_fp($10),
            (select u.k from u where u.n = $7 + 1),
            (select u.k from u where u.n = least($7 + $8, (select count(*) from u)))',
    v_cols, v_keyexpr, s.control_expr, s.order_by, s.from_where)
  using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date, p_offset, p_limit, v_colnames, s.rel,
        case when s.control_expr = 'null::numeric' then null::numeric else 0::numeric end;
end $$;

create or replace function public.obs_archive_content_hash(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date)
returns table (row_count bigint, control_sum text, hash_conteudo text)
language sql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
  select r.row_count, r.control_sum, r.hash_conteudo from public.obs_archive_read_unit(p_site, p_class, p_table, p_channel, p_month, 0, 1) r
$$;
