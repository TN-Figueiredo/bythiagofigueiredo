-- Manutenção M5: as telas (spec 2026-10-13-fase-manutencao-nas, 04 §14; 02 §10.4). RASCUNHO até a Tarefa 13 do plano M5 (TRAVA M5-1):
-- não mover para supabase/migrations à mão; o arquivo nasce por `npm run db:new manutencao_m5_telas`. Depende da M2, da M10a e da M3b em produção.

-- M5 PARTE 1: online desde (02 §10.4)
-- Por tabela de série (horária e série; o texto e o vídeo antigo não têm data de série): o 1º dia do mês seguinte ao último mês com detached_at OU
-- dropped_at. Nada saiu: nulo ("tudo online desde o começo da série"), nunca "sem dado". O mês destacado já conta como fora (a tabela-mãe não o lê).
-- A saída é da TABELA inteira (obs_partitions_ensure não tem site_id): os meses fora são lidos sem filtro de site. `divergencia`: o registro diz "nada
-- saiu" mas há evidência de que um mês saiu do banco (buraco de partição desde o início da classe, ou unidade com dado anterior à partição mais antiga): a tela trata como NÃO LIDO.
-- Tabela que simplesmente começou depois do first_month da classe NÃO é divergência (sem evidência).
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
         where h.inhparent = v_rel and n.nspname = 'obs_part' and f.relname ~ '_[0-9]{6}$';
        -- Evidência de que um mês saiu SEM registro, nunca só "a tabela começou depois do 1º mês da classe" (Phil I2: a tabela early pode começar depois da diária):
        -- (a) buraco: mês entre a partição mais antiga presente (ou o início da classe, o que vier depois) e o mês corrente sem a sua partição (Yannis I-1);
        -- (b) dado: unidade copiada com dado de um mês anterior à partição mais antiga presente (o mês mais velho saiu e não deixou buraco).
        divergencia := v_min is not null and (
          exists (select 1 from pg_catalog.generate_series(greatest(v_min, v_fm), pg_catalog.date_trunc('month', public.obs_archive_hoje_sp())::date, interval '1 month') g(m)
                   where not exists (select 1 from pg_catalog.pg_inherits h join pg_catalog.pg_class f on f.oid = h.inhrelid join pg_catalog.pg_namespace n on n.oid = f.relnamespace
                                      where h.inhparent = v_rel and n.nspname = 'obs_part' and f.relname = obs_part.nome_da_particao(t.tb, g.m::date)))
          or exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.class = t.cl and u.table_name = t.tb and u.month < v_min and u.row_count > 0));
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
-- Os itens em atraso, mesma assinatura e mesmo resultado de obs_archive_atraso_itens da M3b, sem a consulta correlacionada (Phil I1 = Yannis I-2): o esperado e as
-- unidades terminais saem UMA vez por (classe, mês), em vez de current_units rodar por par esperado (4 s na página e no aviso no caso cheio).
create or replace function public.obs_archive_atraso_itens(p_site uuid)
returns table (tipo text, classe text, tabela text, canal text, mes date, desde date)
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_due date;
begin
  for r in select * from public.obs_archive_meses_devidos(p_site, false) loop
    v_due := public.obs_archive_due_on(r.mes, r.margem);
    return query
      with e as materialized (select x.table_name, x.channel_ref from public.obs_archive_expected_units(p_site, r.classe, r.mes) x),
           t as materialized (select cu.table_name, cu.channel_ref from public.obs_archive_current_units(p_site, r.classe, r.mes) cu
                               where public.obs_archive_is_terminal(cu.received_at, cu.redo_reason, cu.row_count, cu.lost_at, cu.purged_at))
      select 'unidade'::text, r.classe, e.table_name, e.channel_ref, r.mes, v_due
        from e where not exists (select 1 from t where t.table_name = e.table_name and t.channel_ref = e.channel_ref)
      union all
      select 'mes'::text, r.classe, null::text, null::text, r.mes, v_due
       where exists (select 1 from e)
         and not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = r.classe and m.month = r.mes
                           and m.sealed_at is not null and m.unsealed_at is null);
  end loop;
end $$;
revoke all on function public.obs_archive_atraso_itens(uuid) from public, anon, authenticated, service_role;

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
  with i as materialized (select * from public.obs_archive_atraso_itens(p_site)),
       -- o mês mais atrasado: o item `unidade` de menor `desde`, desempate pelo menor mês (Phil I4: a TS não pode subtrair a margem, que é 28 ou 45 conforme a classe)
       am as (select i2.mes from i i2 where i2.tipo = 'unidade' order by i2.desde, i2.mes limit 1)
  select jsonb_build_object(
    'versao', 1, 'lido_em', public.obs_archive_agora(), 'hoje', public.obs_archive_hoje_sp(),
    -- Phil I1: o mês só sai das telas em (mês + 1 + janela) e o espaço volta wait_days depois disso; o selo só adia, nunca antecipa.
    -- Quando a M6 entrar, esta conta passa a ser a função dela (obs_archive_pode_sair_em, com o piso) + wait_days.
    'proximo_mes', (select jsonb_build_object('class', y.class, 'month', y.month, 'pronto_em', y.pronto)
                      from (select x.class, x.month,
                                   greatest((x.month + pg_catalog.make_interval(months => 1 + k.window_months))::date, (x.sealed_at at time zone 'America/Sao_Paulo')::date) + k.wait_days as pronto
                              from public.obs_archive_months x
                              join (select distinct p.class, p.wait_days, p.window_months from public.obs_archive_policy() p where p.class in ('horaria', 'serie')) k on k.class = x.class
                             where x.site_id = p_site and x.sealed_at is not null and x.unsealed_at is null and x.detached_at is null and x.dropped_at is null) y
                     order by y.pronto, y.month, y.class limit 1),
    -- Phil r2 R1: o início vem do registro (obs_archive_switch.first_month), sem piso fixo no texto. Sem registro: nulos (a TS diz "Ainda não há cópia"), nunca uma data inventada.
    'primeira_devida_em', (select public.obs_archive_due_on(sw.first_month, (select min(p.seal_margin_days) from public.obs_archive_policy() p where p.class = 'horaria'))
                             from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = 'horaria' and sw.first_month is not null),
    'primeira_devida_mes', (select sw.first_month from public.obs_archive_switch sw where sw.site_id = p_site and sw.class = 'horaria'),
    'ultima_copia', (select max(u.received_at) from public.obs_archive_units u where u.site_id = p_site and u.class in ('horaria', 'serie', 'texto')),
    'casa', coalesce((select jsonb_agg(jsonb_build_object('worker', h.worker, 'last_poll_at', h.last_poll_at, 'updated_at', h.updated_at, 'nas_ok', h.nas_ok,
              'nas_checked_at', h.nas_checked_at) order by h.worker) from public.obs_archive_heartbeat h where h.site_id = p_site), '[]'::jsonb),
    'vermelhos_n', cardinality(public.obs_archive_vermelhos(p_site)),
    -- as mesmas contas de obs_archive_atraso (m3b), sobre os itens lidos UMA vez
    'atraso', (select jsonb_build_object(
        'amarelos', count(*) filter (where i.tipo = 'unidade' and public.obs_archive_hoje_sp() - i.desde > 5 and public.obs_archive_hoje_sp() - i.desde <= 30),
        'vermelhos', count(*) filter (where i.tipo = 'unidade' and public.obs_archive_hoje_sp() - i.desde > 30),
        'mais_antiga', min(i.desde) filter (where i.tipo = 'unidade'),
        'meses_sem_selo', count(*) filter (where i.tipo = 'mes')) from i),
    'atraso_mes', (select am.mes from am))
$$;
revoke all on function public.obs_archive_aviso(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_aviso(uuid) to service_role;

-- M5 PARTE 3: lista de canais removidos v2, o desde da horária e o impacto da remoção (04 §14.1 e §14.2; Phil I5, I6, I7; Yannis I-8, I-14)
-- (a) lista v2 (nome, removido_em, faixa de meses e registros; nulos, não zero, sem unidade)
create or replace function public.obs_archive_removed_channel_list(p_site uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with ausentes as (
    select u.channel_ref from public.obs_archive_units u
     where u.site_id = p_site and not exists (select 1 from public.competitor_channels k where k.id::text = u.channel_ref and k.site_id = p_site)
     group by u.channel_ref
  ), refs as (
    select r.channel_ref from public.obs_archive_channel_removals r where r.site_id = p_site
    union select a.channel_ref from ausentes a
  ), cur as (
    select distinct on (u.class, u.table_name, u.month, u.channel_ref) u.channel_ref, u.class, u.month, u.row_count
      from public.obs_archive_units u
     where u.site_id = p_site and u.channel_ref in (select channel_ref from refs)
     order by u.class, u.table_name, u.month, u.channel_ref, u.version desc
  ), agg as (
    select c.channel_ref, min(c.month) filter (where c.row_count > 0) as primeiro, max(c.month) filter (where c.row_count > 0) as ultimo,
           count(distinct c.month) filter (where c.row_count > 0) as meses, coalesce(sum(c.row_count), 0) as registros, array_agg(distinct c.class order by c.class) as classes
      from cur c group by c.channel_ref
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'channel_ref', f.channel_ref, 'versao', 2,
      'estado', case when r.channel_ref is null then 'sem_destino'
                     when not exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = f.channel_ref)
                          and not exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = f.channel_ref) then 'sem_arquivo'
                     when r.archive_decision = 'guardar' then 'guardado'
                     else 'pedido' end,
      'decided_at', r.decided_at, 'nas_absent_at', r.nas_absent_at, 'b2_absent_at', r.b2_absent_at, 'snapshots_clear_on', r.snapshots_clear_on,
      'reappeared_at', r.reappeared_at, 'reappeared_count', coalesce(r.reappeared_count, 0), 'online_thumbs_known', r.online_thumbs_known,
      'thumbs_unknown_ack_at', r.thumbs_unknown_ack_at, 'blobs_pendentes', coalesce(array_length(r.blobs_pending, 1), 0), 'youtube_channel_id', r.youtube_channel_id,
      'nome', r.name_at_removal, 'removido_em', r.removed_at, 'removido_via', coalesce(r.removed_via, 'sem_registro'),
      'primeiro_mes', to_char(coalesce(a.primeiro, r.first_month), 'YYYY-MM'), 'ultimo_mes', to_char(coalesce(a.ultimo, r.last_month), 'YYYY-MM'),
      'meses', a.meses, 'registros', a.registros, 'classes', to_jsonb(coalesce(a.classes, '{}'::text[]))
    ) order by f.channel_ref), '[]'::jsonb)
    from refs f
    left join public.obs_archive_channel_removals r on r.site_id = p_site and r.channel_ref = f.channel_ref
    left join agg a on a.channel_ref = f.channel_ref
$$;
revoke all on function public.obs_archive_removed_channel_list(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_removed_channel_list(uuid) to service_role;

-- (b) o desde da horária (D-M5-11): mês fora -> 1º dia do mês mais antigo à meia-noite de São Paulo (precisão mês); senão a 1ª hora lida (precisão hora). Nunca min_key.
create or replace function public.obs_archive_horaria_desde(p_site uuid) returns table (desde timestamptz, precisao text)
language sql stable security definer set search_path = '' as $$
  select coalesce(m.d, h.d), case when m.d is not null then 'mes' when h.d is not null then 'hora' end
    from (select (min(x.month)::timestamp at time zone 'America/Sao_Paulo') as d
            from public.obs_archive_months x
           where x.site_id = p_site and x.class = 'horaria' and x.sealed_kind = 'com_dado' and (x.detached_at is not null or x.dropped_at is not null)) m
    cross join (select min(hv.hour_slot) as d from public.competitor_video_hourly hv where hv.site_id = p_site) h
$$;
revoke all on function public.obs_archive_horaria_desde(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_horaria_desde(uuid) to service_role;

-- (c) competitor_hourly_health com desde, desde_precisao e online_desde
-- Gerado por gerar-m5-parte3.py a partir de 20261013000002_observatorio_a5_e15_leitura_horaria.sql; só a linha 'desde' muda (M5, Phil I7).
create or replace function public.competitor_hourly_health(p_site_id uuid, p_now timestamptz, p_age_days integer, p_cap integer)
returns jsonb language sql stable strict security invoker set search_path = '' as $$
  with lista as (
    select v.id, row_number() over (partition by v.competitor_channel_id order by v.published_at desc, v.id) as pos
    from public.competitor_videos v
    join public.competitor_channels c on c.id = v.competitor_channel_id
    where c.site_id = p_site_id
      and v.missing_since is null and c.missing_since is null
      and v.published_at > p_now - make_interval(days => p_age_days)
      and v.published_at <= p_now
      and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
  ), cobrados as (
    select v.id,
           (select count(*) from public.competitor_video_hourly h
             where h.video_id = v.id and h.hour_slot > p_now - interval '24 hours' and h.hour_slot <= p_now) as lidas
    from lista l join public.competitor_videos v on v.id = l.id
    where l.pos <= p_cap
      and v.published_at < p_now - interval '1 day'
      and v.published_at > p_now - make_interval(days => p_age_days) + interval '1 day'
      and v.miss_streak = 0
      and coalesce(v.views_hidden, false) = false
      and (v.discovered_at is null or v.discovered_at < p_now - interval '25 hours')
      and (v.live_actual_end_at is null or v.live_actual_end_at < p_now - interval '25 hours')
  ), proprios_lista as (
    -- (emenda do portão: D-C1, caso 2) o MESMO teto por canal que o código aplica (todo vídeo do dono na janela, na mesma ordem)
    select y.youtube_video_id, y.published_at, y.created_at,
           row_number() over (partition by y.channel_id order by y.published_at desc, y.id) as pos,
           (select m.privacy_status from public.yt_own_video_meta_daily m
             where m.youtube_video_id = y.youtube_video_id and m.privacy_status is not null
               and m.day_pt >= (p_now at time zone 'America/Los_Angeles')::date - 3
             order by m.day_pt desc limit 1) as privacidade
    from public.youtube_videos y
    where y.site_id = p_site_id
      and y.published_at > p_now - make_interval(days => p_age_days)
      and y.published_at <= p_now
  ), proprios as (
    select l.youtube_video_id,
           (select count(*) from public.yt_own_public_video_hourly h
             where h.youtube_video_id = l.youtube_video_id and h.site_id = p_site_id
               and h.hour_slot > p_now - interval '24 hours' and h.hour_slot <= p_now) as lidas
    from proprios_lista l
    where l.pos <= p_cap
      and l.published_at < p_now - interval '1 day'
      and l.published_at > p_now - make_interval(days => p_age_days) + interval '1 day'
      and l.created_at < p_now - interval '25 hours'
      and l.privacidade = 'public'
      -- (emenda do portão: D-C1, caso 1) público há 26 horas pelo INSTANTE da captura: day_pt é o dia ANTERIOR ao da
      -- captura e não serve de relógio (a captura de day_pt = hoje − 2 pode ter só 19 horas)
      and (select m.privacy_status from public.yt_own_video_meta_daily m
            where m.youtube_video_id = l.youtube_video_id and m.privacy_status is not null
              and m.captured_at < p_now - interval '26 hours'
            order by m.day_pt desc limit 1) = 'public'
  ), horas as (
    -- horas (cheias) em que a tarefa gravou alguma leitura do site, de concorrente ou do dono
    select h.hour_slot from public.competitor_video_hourly h
     where h.site_id = p_site_id and h.hour_slot > p_now - interval '24 hours' and h.hour_slot <= p_now
    union
    select h.hour_slot from public.yt_own_public_video_hourly h
     where h.site_id = p_site_id and h.hour_slot > p_now - interval '24 hours' and h.hour_slot <= p_now
  ), n as (select count(*) as lidas from horas), d as materialized (select x.desde, x.precisao from public.obs_archive_horaria_desde(p_site_id) x)
  select jsonb_build_object(
    'desde', (select d.desde from d),
    'desde_precisao', (select d.precisao from d),
    'online_desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),
    -- (emenda do portão: D-m1) pelo índice da hora; max(taken_at) varria a tabela inteira a cada disparo
    'ultima_leitura', (select h.taken_at from public.competitor_video_hourly h where h.site_id = p_site_id
                        order by h.hour_slot desc, h.taken_at desc limit 1),
    'horas_lidas_24h', (select n.lidas from n),
    'videos_na_lista', (select count(*) from lista l where l.pos <= p_cap),
    'videos_fora_do_teto', (select count(*) from lista l where l.pos > p_cap),
    'videos_cobrados', (select count(*) from cobrados),
    'videos_abaixo_de_22h', (select count(*) from cobrados k where k.lidas < 22),
    -- (emenda do portão: D-I5) falha DAQUELE vídeo: menos leituras que as horas em que a tarefa leu alguém, menos 2
    'videos_abaixo_do_lido', (select count(*) from cobrados k, n where k.lidas < n.lidas - 2),
    'proprios_desde', (select min(h.hour_slot) from public.yt_own_public_video_hourly h where h.site_id = p_site_id),
    'proprios_ultima_leitura', (select h.taken_at from public.yt_own_public_video_hourly h where h.site_id = p_site_id
                                 order by h.hour_slot desc, h.taken_at desc limit 1),
    'proprios_na_lista', (select count(*) from proprios_lista l where l.pos <= p_cap),
    'proprios_fora_do_teto', (select count(*) from proprios_lista l where l.pos > p_cap),
    -- dentro do teto, conhecido há mais de 25 horas e sem captura de privacidade nos últimos 3 dias: fora da prova, em nota
    'proprios_sem_captura', (select count(*) from proprios_lista l
                              where l.pos <= p_cap and l.privacidade is null and l.created_at < p_now - interval '25 hours'),
    'proprios_cobrados', (select count(*) from proprios),
    'proprios_abaixo_de_22h', (select count(*) from proprios k where k.lidas < 22),
    'proprios_abaixo_do_lido', (select count(*) from proprios k, n where k.lidas < n.lidas - 2),
    'proprios_em_competitor', (select count(*) from public.competitor_channels c
                                join public.youtube_channels y on y.channel_id = c.channel_id and y.site_id = c.site_id
                               where c.site_id = p_site_id)
  );
$$;
revoke all on function public.competitor_hourly_health(uuid, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.competitor_hourly_health(uuid, timestamptz, integer, integer) to service_role;

-- (d) impacto da remoção: fora_do_banco leva registros e por_tabela
create or replace function public.obs_archive_channel_archive_impact(p_site uuid, p_channel uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ref text := p_channel::text; j jsonb;
begin
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel and c.site_id = p_site) then
    return jsonb_build_object('status', 'nao_encontrado');
  end if;
  with cur as (
    select distinct on (u.class, u.table_name, u.month) u.class, u.table_name, u.month, u.row_count
      from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = v_ref and u.purged_at is null
     order by u.class, u.table_name, u.month, u.version desc
  ), cheios as (select * from cur where row_count > 0),
  fora as (
    select c.table_name, c.month, c.row_count from cheios c where exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = c.class and m.table_name = c.table_name and m.month = c.month
                                                 and (m.dropped_at is not null or m.detached_at is not null))
  ), vr as (
    select v.published_at from public.competitor_videos v where v.competitor_channel_id = p_channel and v.archive_dropped_at is not null
  )
  select jsonb_build_object('status', 'ok',
      'meses', (select count(distinct month) from cheios), 'de', (select to_char(min(month), 'YYYY-MM') from cheios), 'ate', (select to_char(max(month), 'YYYY-MM') from cheios),
      'registros', (select coalesce(sum(row_count), 0) from cheios),
      'fora_do_banco', jsonb_build_object('meses', (select count(distinct month) from fora), 'de', (select to_char(min(month), 'YYYY-MM') from fora), 'ate', (select to_char(max(month), 'YYYY-MM') from fora),
         'registros', (select coalesce(sum(row_count), 0) from fora),
         'por_tabela', coalesce((select jsonb_agg(jsonb_build_object('table_name', t.table_name, 'meses', t.meses, 'registros', t.registros) order by t.table_name)
                                   from (select table_name, count(distinct month) as meses, sum(row_count) as registros from fora group by table_name) t), '[]'::jsonb)),
      'videos_retirados', jsonb_build_object('n', (select count(*) from vr), 'de', (select min(published_at)::date::text from vr), 'ate', (select max(published_at)::date::text from vr)),
      'imagens_blob', coalesce(array_length(public.obs_archive_channel_blobs(p_site, v_ref), 1), 0))
    into j;
  return j;
end $$;
revoke all on function public.obs_archive_channel_archive_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_channel_archive_impact(uuid, uuid) to service_role;

-- M5 PARTE 4: liberar serie e horaria (TRAVA M5-3, item 87). Corpo da M3b, só `released` muda nas 3 linhas.
create or replace function public.obs_archive_policy()
returns table (class text, table_name text, exit_mode text, window_months int, seal_margin_days int, wait_days int,
               auto_allowed text, released boolean, control_column text, filho text)
language sql immutable set search_path = '' as $$
  values
    ('horaria', 'competitor_video_hourly', 'particao', 3, 28, 7, 'depois_de_3', true, 'views', 'numerico'),
    ('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true, 'views', 'numerico'),
    ('serie', 'competitor_video_early', 'particao', 6, 28, 7, 'depois_de_3_da_tabela', true, 'views', 'numerico'),
    ('texto', 'competitor_video_comments', 'faixa', 6, 45, 0, 'nunca', false, null, 'texto'),
    ('texto', 'competitor_video_comment_marks', 'faixa', 6, 45, 0, 'nunca', false, 'likes', 'texto'),
    ('texto', 'competitor_raw', 'faixa', 6, 45, 0, 'nunca', false, null, 'texto'),
    ('ensaio', 'obs_archive_rehearsal', 'particao', 6, 28, 1, 'nunca', false, 'views', 'numerico'),
    ('video_antigo', 'competitor_video_versions', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_field_versions', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_raw', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_video_tier_spans', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_video_comment_snaps', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_hour_fold_log', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_changes', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_readings', 'lista', 0, 28, 0, 'nunca', false, null, 'texto')
$$;
revoke all on function public.obs_archive_policy() from public, anon, authenticated;
grant execute on function public.obs_archive_policy() to service_role;
