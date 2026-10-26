-- Manutenção M5: as telas (spec 2026-10-13-fase-manutencao-nas, 04 §14; 02 §10.4). RASCUNHO até a Tarefa 13 do plano M5 (TRAVA M5-1):
-- não mover para supabase/migrations à mão; o arquivo nasce por `npm run db:new manutencao_m5_telas`. Depende da M2, da M10a e da M3b em produção.

-- M5 PARTE 1: online desde (02 §10.4)
-- Por tabela de série (horária e série; o texto e o vídeo antigo não têm data de série): o 1º dia do mês seguinte ao último mês com detached_at OU
-- dropped_at. Nada saiu: nulo ("tudo online desde o começo da série"), nunca "sem dado". O mês destacado já conta como fora (a tabela-mãe não o lê).
-- A saída é da TABELA inteira (obs_partitions_ensure não tem site_id): os meses fora são lidos sem filtro de site. `divergencia`: o registro diz "nada
-- saiu" mas a partição mais antiga presente começa depois do 1º mês da classe (obs_archive_switch.first_month): a tela trata como NÃO LIDO.
create or replace function public.obs_archive_online_since(p_site uuid)
returns table (class text, table_name text, online_since date, divergencia boolean)
language plpgsql stable security definer set search_path = '' as $$
declare t record; v_rel regclass; v_min date; v_fm date;
begin
  for t in select distinct x.class as cl, x.table_name as tb from public.obs_archive_policy() x where x.class in ('horaria', 'serie') order by 1, 2 loop
    class := t.cl; table_name := t.tb; divergencia := false;
    select (max(m.month) + interval '1 month')::date into online_since from public.obs_archive_months m
     where m.class = t.cl and m.table_name = t.tb and (m.detached_at is not null or m.dropped_at is not null);
    if online_since is null then
      v_rel := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(t.tb));
      select s.first_month into v_fm from public.obs_archive_switch s where s.site_id = p_site and s.class = t.cl;
      if v_rel is not null and v_fm is not null and (select c.relkind from pg_catalog.pg_class c where c.oid = v_rel) = 'p' then
        select min(pg_catalog.to_date(pg_catalog.right(f.relname, 6), 'YYYYMM')) into v_min
          from pg_catalog.pg_inherits h join pg_catalog.pg_class f on f.oid = h.inhrelid join pg_catalog.pg_namespace n on n.oid = f.relnamespace
         where h.inhparent = v_rel and n.nspname = 'obs_part';
        divergencia := v_min is not null and v_min > v_fm;
      end if;
    end if;
    return next;
  end loop;
end $$;
revoke all on function public.obs_archive_online_since(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_online_since(uuid) to service_role;

-- M5 PARTE 2: a leitura única da página do Arquivo (04 §14.2) e a leitura leve do aviso (18-v2). Só leem; nunca gravam.
-- A GRADE (classe, tabela, mês) vem do início da classe até o mês corrente e NÃO das linhas do registro: a linha só nasce com a 1ª unidade recebida
-- (obs_archive_record_core), então o mês que a casa nunca copiou não teria linha (Phil C1). O devido vem de obs_archive_expected_units (D19), nunca de count(*) das unidades.
create or replace function public.obs_archive_pagina(p_site uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := public.obs_archive_hoje_sp();
  v_agora timestamptz := public.obs_archive_agora();
  v_teto date := pg_catalog.date_trunc('month', public.obs_archive_hoje_sp())::date;
  v_meses jsonb; v_prog jsonb := '[]'::jsonb;
  g record; v_esp integer; v_pro integer; v_per integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'class', x.cl, 'table_name', x.tb, 'month', x.mes, 'devido_em', public.obs_archive_due_on(x.mes, x.mg), 'tem_linha', m.id is not null,
      'sealed_at', m.sealed_at, 'sealed_kind', m.sealed_kind, 'unsealed_at', m.unsealed_at, 'unsealed_reason', m.unsealed_reason,
      'nas_attested_at', m.nas_attested_at, 'manifest_nas_withdrawn_at', m.manifest_nas_withdrawn_at,
      'b2_attested_at', m.b2_attested_at, 'b2_attested_via', m.b2_attested_via, 'b2_forja_ok_at', m.b2_forja_ok_at, 'b2_dono_ok_at', m.b2_dono_ok_at,
      'b2_forja_diverged_at', m.b2_forja_diverged_at, 'b2_withdrawn_at', m.b2_withdrawn_at, 'b2_withdrawn_reason', m.b2_withdrawn_reason,
      'b2_last_attempt_at', m.b2_last_attempt_at, 'b2_last_attempt_result', m.b2_last_attempt_result,
      'detached_at', m.detached_at, 'dropped_at', m.dropped_at, 'closed_at', m.closed_at,
      'rows_total', m.rows_total, 'units_total', m.units_total, 'units_empty', m.units_empty, 'days_measured', m.days_measured, 'days_in_month', m.days_in_month,
      'rows_dropped', m.rows_dropped, 'bytes_freed', m.bytes_freed,
      -- a coluna é da M6: lida pelo jsonb da linha, então existe ou não sem quebrar esta função nem a ordem do deploy
      'reattach_out_of_order', coalesce((pg_catalog.to_jsonb(m) ->> 'reattach_out_of_order')::boolean, false),
      -- lista fechada de chaves, SEM `por` (uuid de pessoa; Phil r3 N5): nunca o jsonb inteiro de obs_archive_b2_month_state
      'b2', (select coalesce(pg_catalog.jsonb_object_agg(e.key, e.value), '{}'::jsonb)
               from pg_catalog.jsonb_each(public.obs_archive_b2_month_state(p_site, x.cl, x.mes)) e
              where e.key in ('atestada_em', 'via', 'forja_ok_at', 'dono_ok_at', 'forja_divergiu_em', 'retirada', 'ultima_tentativa', 'idade_dias'))
    ) order by x.cl, x.tb, x.mes desc), '[]'::jsonb)
    into v_meses
    from (select p.class as cl, p.table_name as tb, p.seal_margin_days as mg, gs.mes
            from public.obs_archive_policy() p
            cross join lateral (select greatest(coalesce((select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = p.class), date '2026-10-01'), date '2026-10-01') as ini) i
            cross join lateral (select s::date as mes from generate_series(greatest(i.ini, (v_teto - interval '239 months')::date), v_teto, interval '1 month') s) gs
           where p.class in ('horaria', 'serie', 'texto')) x
    left join public.obs_archive_months m on m.site_id = p_site and m.class = x.cl and m.table_name = x.tb and m.month = x.mes;

  -- o progresso de cópia, só dos (classe, mês) SEM selo: o devido de verdade contra o conjunto corrente; canal pronto = todas as suas tabelas terminadas
  for g in
    select distinct p.class as cl, gs.mes
      from public.obs_archive_policy() p
      cross join lateral (select greatest(coalesce((select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = p.class), date '2026-10-01'), date '2026-10-01') as ini) i
      cross join lateral (select s::date as mes from generate_series(greatest(i.ini, (v_teto - interval '239 months')::date), v_teto, interval '1 month') s) gs
     where p.class in ('horaria', 'serie', 'texto')
       and not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p.class and m.month = gs.mes and m.sealed_at is not null and m.unsealed_at is null)
     order by 1, 2
  loop
    with cu as (select * from public.obs_archive_current_units(p_site, g.cl, g.mes)),
         por_canal as (
           select e.channel_ref,
                  bool_and(exists (select 1 from cu where cu.table_name = e.table_name and cu.channel_ref = e.channel_ref
                                      and public.obs_archive_is_terminal(cu.received_at, cu.redo_reason, cu.row_count, cu.lost_at, cu.purged_at))) as pronto,
                  bool_or(exists (select 1 from cu where cu.table_name = e.table_name and cu.channel_ref = e.channel_ref and cu.lost_at is not null)) as perdido
             from public.obs_archive_expected_units(p_site, g.cl, g.mes) e group by e.channel_ref)
    select count(*), count(*) filter (where pronto), count(*) filter (where perdido) into v_esp, v_pro, v_per from por_canal;
    v_prog := v_prog || jsonb_build_object('class', g.cl, 'month', g.mes, 'canais_esperados', v_esp, 'canais_prontos', v_pro, 'canais_perdidos', v_per);
  end loop;

  return jsonb_build_object(
    'versao', 1, 'lido_em', v_agora, 'hoje', v_hoje,
    'casa', coalesce((select jsonb_agg(jsonb_build_object('worker', h.worker, 'last_poll_at', h.last_poll_at, 'updated_at', h.updated_at, 'version', h.version,
              'machine_time', h.machine_time, 'stopped_at_cap', h.stopped_at_cap, 'nas_ok', h.nas_ok, 'nas_checked_at', h.nas_checked_at, 'last_error', h.last_error,
              'livre_bytes', h.free_bytes, 'total_bytes', h.total_bytes, 'sentinel_ok', h.sentinel_ok, 'mounts_ok', h.mounts_ok) order by h.worker)
              from public.obs_archive_heartbeat h where h.site_id = p_site), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('class', k.class, 'first_month', s.first_month, 'released', k.released,
              'window_months', k.window_months, 'seal_margin_days', k.seal_margin_days, 'wait_days', k.wait_days) order by k.class)
              from (select distinct on (p.class) p.class, p.released, p.window_months, p.seal_margin_days, p.wait_days
                      from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto') order by p.class, p.table_name) k
              left join public.obs_archive_switch s on s.site_id = p_site and s.class = k.class), '[]'::jsonb),
    'online_since', coalesce((select jsonb_agg(jsonb_build_object('class', o.class, 'table_name', o.table_name, 'online_since', o.online_since, 'divergencia', o.divergencia)
              order by o.table_name) from public.obs_archive_online_since(p_site) o), '[]'::jsonb),
    'meses', v_meses, 'progresso', v_prog,
    'recuperacao', coalesce((select jsonb_agg(jsonb_build_object('class', t.class, 'table_name', t.table_name, 'done_at', r.done_at, 'schema_fp', r.schema_fp,
              'schema_fp_atual', public.obs_archive_schema_fp(pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(t.table_name))), 'diff_rows', r.diff_rows)
              order by t.class, t.table_name)
              from (select distinct p.class, p.table_name from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto')) t
              left join lateral (select x.done_at, x.schema_fp, x.diff_rows from public.obs_archive_restores x
                                  where x.site_id = p_site and x.class = t.class and x.table_name = t.table_name order by x.done_at desc limit 1) r on true), '[]'::jsonb),
    'meses_a_frente', coalesce((select jsonb_agg(jsonb_build_object('table_name', a.table_name, 'months_ahead', a.months_ahead, 'last_month', a.last_month,
              'converted_at', a.converted_at) order by a.table_name) from public.obs_partitions_months_ahead() a), '[]'::jsonb),
    'teste', jsonb_build_object(
              'aberto', exists (select 1 from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio' and t.closed_at is null),
              'meses', coalesce((select jsonb_agg(jsonb_build_object('month', t.month, 'sealed_at', t.sealed_at, 'nas_attested_at', t.nas_attested_at,
                        'b2_attested_at', t.b2_attested_at, 'detached_at', t.detached_at, 'dropped_at', t.dropped_at, 'closed_at', t.closed_at) order by t.month)
                        from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio' and t.closed_at is null), '[]'::jsonb),
              'encerrado_em', (select max(t.closed_at) from public.obs_archive_months t where t.site_id = p_site and t.class = 'ensaio')),
    -- o que o pulso já mostra, para a página e o pulso não dizerem coisas diferentes do mesmo fato (paridade; Phil I1)
    'vermelhos', to_jsonb(public.obs_archive_vermelhos(p_site)),
    'atraso', public.obs_archive_atraso(p_site),
    'teto_b2', public.obs_archive_b2_teto_cor(p_site));
end $$;
revoke all on function public.obs_archive_pagina(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_pagina(uuid) to service_role;

-- A leitura leve do chrome (Phil I9): o aviso do banco aparece em toda aba do Observatório, e a página inteira (grade + expected_units por mês + b2_month_state
-- por linha) não pode ir em cada navegação. Só o que o 18-v2 usa: o próximo mês pronto, a última cópia, a casa e os vermelhos CONTADOS.
create or replace function public.obs_archive_aviso(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'versao', 1, 'lido_em', public.obs_archive_agora(), 'hoje', public.obs_archive_hoje_sp(),
    'proximo_mes', (select jsonb_build_object('class', x.class, 'month', x.month, 'pronto_em', ((x.sealed_at at time zone 'America/Sao_Paulo')::date + k.wait_days))
                      from public.obs_archive_months x
                      join (select distinct p.class, p.wait_days from public.obs_archive_policy() p where p.class in ('horaria', 'serie')) k on k.class = x.class
                     where x.site_id = p_site and x.sealed_at is not null and x.unsealed_at is null and x.detached_at is null and x.dropped_at is null
                     order by x.month, x.class limit 1),
    'primeira_devida_em', public.obs_archive_due_on(
        greatest(coalesce((select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = 'horaria'), date '2026-10-01'), date '2026-10-01'),
        (select min(p.seal_margin_days) from public.obs_archive_policy() p where p.class = 'horaria')),
    'ultima_copia', (select max(u.received_at) from public.obs_archive_units u where u.site_id = p_site),
    'casa', coalesce((select jsonb_agg(jsonb_build_object('worker', h.worker, 'last_poll_at', h.last_poll_at, 'updated_at', h.updated_at, 'nas_ok', h.nas_ok,
              'nas_checked_at', h.nas_checked_at) order by h.worker) from public.obs_archive_heartbeat h where h.site_id = p_site), '[]'::jsonb),
    'vermelhos_n', cardinality(public.obs_archive_vermelhos(p_site)),
    'atraso', public.obs_archive_atraso(p_site))
$$;
revoke all on function public.obs_archive_aviso(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_aviso(uuid) to service_role;
