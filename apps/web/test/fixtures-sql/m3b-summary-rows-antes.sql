-- Cópia congelada de obs_archive_summary_rows como estava em 36af7fb15/8e1cee4ea, ANTES da extração da calc (M3b Passo 1b).
-- Só o teste de selagem a usa, renomeada, para provar saída antes = depois.
create or replace function public.obs_archive_summary_rows_antes(p_site uuid, p_class text, p_channel uuid, p_month date)
returns jsonb language plpgsql security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  v_ch text := p_channel::text; v_pend text; v_hashes jsonb; v_last record; v_ver integer; v_vazio boolean;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
  v_seg date := (p_month + interval '1 month')::date;
  u record; x record; v_src record; v_canal jsonb := '[]'; v_video jsonb := '[]'; v_c jsonb; v_v jsonb; v_mes text := to_char(p_month, 'YYYY-MM');
begin
  if p_class = 'video_antigo' then raise exception 'resumo_da_m10b' using errcode = 'P0001'; end if;
  if p_month is null or p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel and c.site_id = p_site)
     or exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = v_ch) then
    raise exception 'canal_removido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month and (m.detached_at is not null or m.dropped_at is not null)) then
    raise exception 'ja_no_arquivo' using errcode = 'P0001';
  end if;
  -- o canal tem de ser devido no mês (a mesma definição do plano) ou já ter unidade nele
  if not exists (select 1 from public.obs_archive_expected_units(p_site, p_class, p_month) e where e.channel_ref = v_ch)
     and not exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = v_ch) then
    raise exception 'canal_fora_do_mes' using errcode = 'P0001';
  end if;
  select string_agg(coalesce(regexp_replace(q.faltando, ':[^:]+$', ''), q.unidade), ',' order by coalesce(q.faltando, q.unidade)) into v_pend
    from public.obs_archive_pending_units(p_site, p_class, p_month, v_ch) q;
  if v_pend is not null then raise exception 'unidades_pendentes' using errcode = 'P0001', detail = v_pend; end if;
  v_hashes := public.obs_archive_channel_unit_hashes(p_site, p_class, v_ch, p_month);
  select * into v_last from public.obs_archive_summaries s where s.site_id = p_site and s.class = p_class and s.channel_ref = v_ch and s.month = p_month order by s.version desc limit 1;
  v_ver := case when found and v_last.unit_hashes = v_hashes and v_last.superseded_at is null and v_last.nas_withdrawn_at is null then v_last.version else coalesce(v_last.version, 0) + 1 end;
  select coalesce(bool_and(c.row_count = 0), false) into v_vazio from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = v_ch and c.purged_at is null;
  if not v_vazio then
    for u in select c.* from public.obs_archive_current_units(p_site, p_class, p_month) c
              where c.channel_ref = v_ch and c.purged_at is null and c.lost_at is null order by c.table_name loop
      select * into x from public.obs_archive_table_exprs(u.table_name);
      select * into v_src from public.obs_archive_unit_source(p_class, u.table_name);
      execute format($q$
        with s as (select %1$s as v, %2$s as ts, %3$s as d, %4$s as a, %5$s as b, %6$s as c %7$s),
        pv as (select v, count(*) as n, count(distinct d) as nd, min(ts) as t1, max(ts) as t2,
                      (array_agg(a order by ts asc))[1] as a1, (array_agg(a order by ts desc))[1] as a2,
                      (array_agg(b order by ts asc))[1] as b1, (array_agg(b order by ts desc))[1] as b2,
                      (array_agg(c order by ts asc))[1] as c1, (array_agg(c order by ts desc))[1] as c2
                 from s group by v)
        select to_jsonb(array[ $8, $9, $10, (select count(*) from pv)::text, (select count(*) from s)::text, (select count(distinct d) from s)::text, $7,
                              (select min(t1) from pv)::text, (select max(t2) from pv)::text,
                              (select case when count(*) filter (where a1 is null or a2 is null) > 0 then null else sum(a2 - a1)::text end from pv),
                              (select case when count(*) filter (where b1 is null or b2 is null) > 0 then null else sum(b2 - b1)::text end from pv),
                              (select case when count(*) filter (where c1 is null or c2 is null) > 0 then null else sum(c2 - c1)::text end from pv),
                              $11, $12 ]::text[]),
               (select coalesce(jsonb_agg(to_jsonb(array[ pv.v::text, $8, $9, $10, pv.n::text, pv.nd::text, pv.a1::text, pv.a2::text, pv.b1::text, pv.b2::text, pv.c1::text, pv.c2::text, $11, $12 ]::text[]) order by pv.v), '[]'::jsonb) from pv)
      $q$, x.video_expr, x.ts_expr, x.day_expr,
           case when x.measured then 't.views' else 'null::bigint' end, case when x.measured then 't.likes' else 'null::bigint' end, case when x.measured then 't.comments' else 'null::bigint' end,
           v_src.from_where)
        into v_c, v_v using p_site, p_channel, p_month, v_ini, v_fim, v_seg, (v_seg - p_month)::text, v_ch, u.table_name, v_mes, u.hash_conteudo, v_ver::text;
      v_canal := v_canal || jsonb_build_array(v_c);
      v_video := v_video || (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(v_v) e);
    end loop;
  end if;
  return jsonb_build_object('versao', v_ver, 'vazio', v_vazio, 'unit_hashes', v_hashes,
    'colunas_canal', jsonb_build_array('canal','tabela','mes','videos_com_linha','linhas','dias_medidos','dias_do_mes','primeira_leitura','ultima_leitura','var_views','var_likes','var_comments','hash_conteudo_unidade','versao_resumo'),
    'colunas_video', jsonb_build_array('video','canal','tabela','mes','linhas','dias_medidos','views_primeira','views_ultima','likes_primeira','likes_ultima','comments_primeira','comments_ultima','hash_conteudo_unidade','versao_resumo'),
    'canal', case when v_vazio then '[]'::jsonb else v_canal end, 'video', case when v_vazio then '[]'::jsonb else v_video end);
end $$;
