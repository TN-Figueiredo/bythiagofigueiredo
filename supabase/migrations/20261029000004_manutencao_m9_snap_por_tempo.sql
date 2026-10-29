-- M9-snap (D-M9-9b, emenda 29/10 do dono): snapshots por TEMPO. Pela NFS da forja cada snapshot aparece vazio; o kit só mede a lista
-- (nome, hora, mtime) e o BANCO decide: um snapshot só guarda o prefixo se foi tirado antes de ele sumir (nas_absent_first_at + 1 h),
-- com piso de 14 dias. O contrato r2.7 aceita `snapshots: 'por_tempo' | 'indisponivel'`; 'ausente' e 'presente' deixam de valer.
-- Copiado da 20261029000002 (attest_prefixos e owner_pending); só mudam o bloco dos snapshots e as três chaves de espera.
alter table public.obs_archive_absence add column if not exists snap_motivo text
  check (snap_motivo in ('lista_vazia','fora_do_padrao','mtime_diverge','relogio','ilegivel','anterior','retido'));

create or replace function public.obs_archive_attest_prefixos(p_site uuid, p_fonte text, p_execucao uuid, p_filhos jsonb, p_prefixos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; a public.obs_archive_absence; v_saida jsonb := '[]'::jsonb; v_resp text; v_mot text; v_run public.obs_archive_b2_runs; v_nomes text[]; v_estado text; v_snap text;
  v_old timestamptz; v_new timestamptz; v_snap_ok boolean; v_motivo text;
  v_filho_ok boolean; v_controle boolean := false;
begin
  if p_fonte not in ('nas', 'b2') then raise exception 'forma' using errcode = 'P0001'; end if;
  if p_fonte = 'b2' then
    select * into v_run from public.obs_archive_b2_runs r where r.id = p_execucao and r.site_id = p_site;
    v_controle := v_run.id is not null and v_run.estado = 'controle_ok' and v_run.expires_at > now();
  end if;
  for it in select x from jsonb_array_elements(coalesce(p_prefixos, '[]'::jsonb)) x loop
    v_resp := 'recusado'; v_mot := null;
    select * into a from public.obs_archive_absence x
     where x.site_id = p_site and x.alvo = it->>'alvo' and x.filho = it->>'filho' and x.prefixo = it->>'prefixo' for update;
    v_estado := it->>'estado';
    if a.id is null then v_mot := 'desconhecido';
    elsif a.liberado_em is null or a.encerrada_at is not null then v_mot := 'nao_aberto';
    elsif p_fonte = 'nas' then
      v_filho_ok := coalesce((p_filhos->(a.filho)->>'montado')::boolean, false) and coalesce((p_filhos->(a.filho)->>'sentinela')::boolean, false);
      v_snap := it->>'snapshots';
      if not v_filho_ok then v_mot := 'filho_fora';
      elsif v_estado = 'presente' then
        if a.nas_absent_at is not null then perform public.obs_archive_reabrir(a.id, 'nas');
        else update public.obs_archive_absence set nas_absent_first_at = null, nas_last_absent_at = null, nas_present_at = now() where id = a.id; end if;
        v_resp := 'aceito';
      elsif v_estado = 'ausente' then
        update public.obs_archive_absence set
               nas_absent_first_at = coalesce(nas_absent_first_at, now()),
               nas_last_absent_at = now(),
               nas_absent_at = case when nas_absent_at is not null then nas_absent_at
                                    when nas_absent_first_at is not null and now() - nas_absent_first_at >= interval '11 hours' then now() end
         where id = a.id returning * into a;
        -- M9-snap (D-M9-9b): o kit mede a LISTA; o banco compara com a hora de ausência, que só ele tem.
        if a.nas_absent_at is not null and v_snap in ('por_tempo', 'indisponivel') then
          v_old := case when v_snap = 'por_tempo' and it->>'snap_mais_antigo_s' ~ '^[0-9]{10}$' then to_timestamp((it->>'snap_mais_antigo_s')::bigint) end;
          v_new := case when v_snap = 'por_tempo' and it->>'snap_mais_novo_s'   ~ '^[0-9]{10}$' then to_timestamp((it->>'snap_mais_novo_s')::bigint) end;
          v_snap_ok := coalesce(v_old <= v_new
                       and v_new <= now() + interval '15 minutes'                    -- relógio do NAS em salto
                       and v_new - v_old <= interval '14 days 6 hours'               -- lista maior que a retenção ⇒ hold (Yannis M3)
                       and v_old >  a.nas_absent_first_at + interval '1 hour'        -- o mais antigo é posterior à ausência
                       and now() - a.nas_absent_first_at >= interval '14 days', false); -- piso (critério c; cobre NAS adiantado)
          v_motivo := case
            when v_snap_ok then null
            when v_snap = 'indisponivel' then case when it->>'snap_motivo' in ('lista_vazia','fora_do_padrao','mtime_diverge','ilegivel') then it->>'snap_motivo' else 'ilegivel' end
            when v_old is null or v_new is null or v_old > v_new then 'ilegivel'
            when v_new > now() + interval '15 minutes' then 'relogio'
            when now() >= a.nas_absent_first_at + interval '15 days' then 'retido'
            else 'anterior' end;
          update public.obs_archive_absence set
                 snap_checked_at = now(),
                 snap_oldest = coalesce((v_old at time zone 'America/Sao_Paulo')::date, snap_oldest),
                 snap_absent_at = case when v_snap_ok then coalesce(snap_absent_at, now()) else snap_absent_at end,
                 snap_motivo = case when v_snap_ok or snap_absent_at is not null then null else v_motivo end
           where id = a.id;
        end if;
        v_resp := 'aceito';
      else v_mot := 'forma';
      end if;
    else   -- b2
      if not v_controle then v_mot := 'controle_pendente';
      elsif v_estado = 'ausente' and a.snap_absent_at is null then v_mot := 'snapshots_pendentes';
      elsif v_estado = 'ausente' and not (a.nas_last_absent_at > now() - interval '24 hours') then v_mot := 'conferencia_nas_velha';
      elsif v_estado in ('ausente', 'presente') then
        select coalesce(array_agg(x), '{}') into v_nomes from (select jsonb_array_elements_text(coalesce(it->'nomes', '[]'::jsonb)) x limit 20) q;
        if v_estado = 'presente' and cardinality(v_nomes) = 0 then v_mot := 'forma';
        elsif v_estado = 'ausente' and coalesce(jsonb_array_length(it->'nomes'), 0) > 0 then v_mot := 'forma';
        elsif v_estado = 'presente' then
          if a.b2_absent_at is not null then perform public.obs_archive_reabrir(a.id, 'b2'); end if;
          update public.obs_archive_absence set b2_present_at = now(), b2_checked_at = now(), b2_nomes = v_nomes where id = a.id;
          v_resp := 'aceito';
        else
          update public.obs_archive_absence set b2_absent_at = coalesce(b2_absent_at, now()), b2_checked_at = now(), b2_nomes = '{}' where id = a.id;
          v_resp := 'aceito';
        end if;
      else v_mot := 'forma';
      end if;
    end if;
    v_saida := v_saida || jsonb_strip_nulls(jsonb_build_object('alvo', it->>'alvo', 'filho', it->>'filho', 'prefixo', it->>'prefixo', 'resposta', v_resp, 'motivo', v_mot));
  end loop;
  perform public.obs_archive_removal_advance(p_site);
  perform public.obs_archive_item_advance(p_site);
  return jsonb_build_object('prefixos', v_saida);
end $$;
revoke all on function public.obs_archive_attest_prefixos(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_prefixos(uuid, text, uuid, jsonb, jsonb) to service_role;

-- As pendências do dono: as três chaves de espera por snapshot (snap_espera_desde, snap_libera_em, snap_bloqueio).
create or replace function public.obs_archive_owner_pending(p_site uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_site uuid := p_site; v_itens jsonb; v_agora timestamptz := public.obs_archive_agora(); v_lig boolean;
begin
  if v_site is null then
    if (select count(*) from (select c.site_id from public.competitor_channels c union select r.site_id from public.obs_archive_channel_removals r
                              union select u.site_id from public.obs_archive_units u) x) <> 1 then raise exception 'site_ambiguo' using errcode = 'P0001'; end if;
    select c.site_id into v_site from (select c0.site_id from public.competitor_channels c0 union select r.site_id from public.obs_archive_channel_removals r
                                       union select u.site_id from public.obs_archive_units u) c;
  end if;
  v_lig := public.obs_archive_m9_ligado(v_site);
  with alvos as (
    select t.item_id,
           count(*) filter (where t.estado = 'copiar') as n_copiar, count(*) filter (where t.estado = 'bloqueado') as n_bloq,
           count(*) filter (where t.estado = 'aguardando_nova') as n_agu,
           bool_and(public.obs_archive_grupo_pronto(t.site_id, t.class, t.channel_ref, t.month)) filter (where t.estado = 'copiar') as copiar_pronto,
           min(t.month) as mes, min(t.channel_ref) as channel_ref, min(t.item_kind) as kind,
           min(public.obs_archive_item_falta(t.id)) filter (where t.estado = 'aguardando_nova') as falta_agu,
           min(t.motivo) filter (where t.estado = 'bloqueado') as motivo
      from public.obs_archive_item_targets t where t.site_id = v_site and t.done_at is null and t.item_id is not null group by t.item_id
  ), ab as (
    select t.item_id, count(*) filter (where a.nas_absent_first_at is null) as sem_primeiro, count(*) filter (where a.nas_absent_at is null) as sem_nas,
           count(*) filter (where a.snap_absent_at is null) as sem_snap, min(a.nas_last_absent_at) as min_last,
           count(*) filter (where a.b2_checked_at is null) as nao_checado, min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest,
           min(a.nas_absent_first_at) filter (where a.snap_absent_at is null) as snap_espera_desde, max(a.nas_absent_first_at) filter (where a.snap_absent_at is null) + interval '14 days 8 hours' as snap_libera_em, (array_agg(a.snap_motivo order by case a.snap_motivo when 'ilegivel' then 1 when 'lista_vazia' then 2 when 'fora_do_padrao' then 3 when 'mtime_diverge' then 4 when 'relogio' then 5 when 'retido' then 6 end) filter (where a.snap_absent_at is null and a.snap_motivo in ('ilegivel','lista_vazia','fora_do_padrao','mtime_diverge','relogio','retido') and a.snap_checked_at >= a.nas_absent_at))[1] as snap_bloqueio
      from public.obs_archive_item_targets t join public.obs_archive_absence a on a.site_id = t.site_id and a.alvo_id = t.id and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null
     where t.site_id = v_site and t.estado in ('apagar_antigas', 'conferir_b2') group by t.item_id
  ), it as (
    select x.*, i.youtube_id, i.decided_at, i.marcado_rodado_em, ab.snap_oldest, ab.snap_espera_desde, ab.snap_libera_em, ab.snap_bloqueio,
           public.obs_archive_etapa(coalesce(ab.sem_primeiro, 0), coalesce(ab.sem_nas, 0), coalesce(ab.sem_snap, 0), ab.min_last, coalesce(ab.nao_checado, 0), v_lig, v_agora) as et
      from alvos x left join ab on ab.item_id = x.item_id left join public.competitor_removed_items i on i.id = x.item_id
  ), it_tempo as (
    select it.*,
           case when n_copiar > 0 and coalesce(copiar_pronto, false) then 'copiar' when n_bloq > 0 then 'bloqueado'
                when n_copiar > 0 or n_agu > 0 then 'sem_comando' when et in ('apagar_antigas', 'conferir_b2') then et else 'sem_comando' end as tempo,
           case when n_copiar > 0 and coalesce(copiar_pronto, false) then null when n_bloq > 0 then null
                when n_copiar > 0 then 'versao_em_curso' when n_agu > 0 then coalesce(falta_agu, 'versao_em_curso')
                when et in ('apagar_antigas', 'conferir_b2') then null else et end as falta
      from it
  ), item_item as (
    select 'item:' || x.item_id as item_id, x.kind, x.tempo, x.falta, case when x.tempo = 'bloqueado' then x.motivo end as motivo, x.decided_at as desde,
           to_char(x.mes, 'YYYY-MM') as mes, x.channel_ref, x.youtube_id, x.marcado_rodado_em as marcado, x.n_bloq as bloqueados, x.snap_oldest, x.snap_espera_desde, x.snap_libera_em, x.snap_bloqueio,
           case when x.tempo = 'apagar_antigas' then public.obs_archive_apagar_do_item(v_site, x.item_id) else '[]'::jsonb end as apagar,
           case when x.tempo = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || n order by a.filho, n), '[]'::jsonb)
                                                     from public.obs_archive_item_targets t2 join public.obs_archive_absence a on a.site_id = v_site and a.alvo_id = t2.id
                                                     cross join lateral unnest(a.b2_nomes) n
                                                    where t2.site_id = v_site and t2.item_id = x.item_id and t2.estado = 'conferir_b2' and a.encerrada_at is null and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           '[]'::jsonb as prefixos
      from it_tempo x
  ), canal as (
    select r.*, (select count(*) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as n_abertas,
           (select count(*) filter (where a.nas_absent_first_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_primeiro,
           (select count(*) filter (where a.nas_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_nas,
           (select count(*) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_snap,
           (select min(a.nas_last_absent_at) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as min_last,
           (select count(*) filter (where a.b2_checked_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as nao_checado,
           (select min(a.snap_oldest) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null) as snap_oldest,
           (select min(a.nas_absent_first_at) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null) as snap_espera_desde,
           (select max(a.nas_absent_first_at) filter (where a.snap_absent_at is null) + interval '14 days 8 hours' from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null) as snap_libera_em,
           (select (array_agg(a.snap_motivo order by case a.snap_motivo when 'ilegivel' then 1 when 'lista_vazia' then 2 when 'fora_do_padrao' then 3 when 'mtime_diverge' then 4 when 'relogio' then 5 when 'retido' then 6 end) filter (where a.snap_absent_at is null and a.snap_motivo in ('ilegivel','lista_vazia','fora_do_padrao','mtime_diverge','relogio','retido') and a.snap_checked_at >= a.nas_absent_at))[1] from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null) as snap_bloqueio,
           jsonb_array_length(public.obs_archive_arquivos_do_canal(v_site, r.channel_ref)) as n_arquivos
      from public.obs_archive_channel_removals r where r.site_id = v_site and r.archive_decision = 'apagar' and r.completed_at is null
  ), canal_tempo as (
    select c.*, public.obs_archive_etapa(coalesce(c.sem_primeiro, 0), coalesce(c.sem_nas, 0), coalesce(c.sem_snap, 0), c.min_last, coalesce(c.nao_checado, 0), v_lig, v_agora) as et
      from canal c
  ), canal_item as (
    select 'canal:' || c.channel_ref as item_id, 'canal'::text as kind,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then 'apagar_antigas'
                when c.n_abertas > 0 and c.et = 'conferir_b2' then 'conferir_b2' else 'sem_comando' end as tempo,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then null
                when c.n_abertas > 0 and c.et = 'apagar_antigas' then 'so_prefixo'
                when c.n_abertas > 0 and c.et = 'conferir_b2' then null
                when c.n_abertas > 0 then c.et
                when cardinality(c.blobs_pending) > 0 then 'blobs'
                when not c.online_thumbs_known and c.thumbs_unknown_ack_at is null then 'imagens'
                when exists (select 1 from public.obs_archive_batches b where b.site_id = c.site_id and b.kind = 'canal' and b.channel_ref = c.channel_ref
                              and b.deleted_at is null and b.closed_at is null) then 'lote_e10'
                when not v_lig then 'm9_desligado' else 'so_prefixo' end as falta,
           null::text as motivo, greatest(c.decided_at, c.reappeared_at) as desde, null::text as mes, c.channel_ref, nullif(c.youtube_channel_id, '') as youtube_id,
           c.marcado_rodado_em as marcado, 0::bigint as bloqueados, c.snap_oldest, c.snap_espera_desde, c.snap_libera_em, c.snap_bloqueio,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then public.obs_archive_arquivos_do_canal(v_site, c.channel_ref) else '[]'::jsonb end as apagar,
           case when c.n_abertas > 0 and c.et = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || n order by a.filho, n), '[]'::jsonb)
                                                                    from public.obs_archive_absence a cross join lateral unnest(a.b2_nomes) n
                                                                   where a.site_id = v_site and a.alvo = 'canal:' || c.channel_ref and a.encerrada_at is null and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           (select coalesce(jsonb_agg(a.prefixo order by a.prefixo), '[]'::jsonb) from public.obs_archive_absence a
             where a.site_id = v_site and a.alvo = 'canal:' || c.channel_ref and a.prefixo not like '\_recebendo/%') as prefixos
      from canal_tempo c
  ), antiga as (
    select a.alvo as item_id, 'versao'::text as kind,
           case when e.et in ('apagar_antigas', 'conferir_b2') then e.et else 'sem_comando' end as tempo,
           case when e.et in ('apagar_antigas', 'conferir_b2') then null else e.et end as falta, null::text as motivo,
           min(a.liberado_em) as desde, to_char(min(u.month), 'YYYY-MM') as mes, min(u.channel_ref) as channel_ref, null::text as youtube_id, null::timestamptz as marcado,
           0::bigint as bloqueados, min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest,
           min(a.nas_absent_first_at) filter (where a.snap_absent_at is null) as snap_espera_desde, max(a.nas_absent_first_at) filter (where a.snap_absent_at is null) + interval '14 days 8 hours' as snap_libera_em, (array_agg(a.snap_motivo order by case a.snap_motivo when 'ilegivel' then 1 when 'lista_vazia' then 2 when 'fora_do_padrao' then 3 when 'mtime_diverge' then 4 when 'relogio' then 5 when 'retido' then 6 end) filter (where a.snap_absent_at is null and a.snap_motivo in ('ilegivel','lista_vazia','fora_do_padrao','mtime_diverge','relogio','retido') and a.snap_checked_at >= a.nas_absent_at))[1] as snap_bloqueio,
           case when e.et = 'apagar_antigas' then public.obs_archive_apagar_da_antiga(v_site, a.alvo) else '[]'::jsonb end as apagar,
           case when e.et = 'conferir_b2' then (select coalesce(jsonb_agg(a2.filho || '/' || n order by a2.filho, n), '[]'::jsonb)
                                                  from public.obs_archive_absence a2 cross join lateral unnest(a2.b2_nomes) n
                                                 where a2.site_id = v_site and a2.alvo = a.alvo and a2.encerrada_at is null and a2.b2_absent_at is null) else '[]'::jsonb end as b2_nomes,
           '[]'::jsonb as prefixos
      from public.obs_archive_absence a join public.obs_archive_units u on u.id = a.unidade_id
      cross join lateral (select public.obs_archive_etapa(count(*) filter (where z.nas_absent_first_at is null), count(*) filter (where z.nas_absent_at is null),
                                  count(*) filter (where z.snap_absent_at is null), min(z.nas_last_absent_at), count(*) filter (where z.b2_checked_at is null), v_lig, v_agora) as et
                            from public.obs_archive_absence z where z.site_id = v_site and z.alvo = a.alvo and z.encerrada_at is null and z.liberado_em is not null and z.b2_absent_at is null) e
     where a.site_id = v_site and a.alvo like 'antiga:%' and a.encerrada_at is null and a.b2_absent_at is null
     group by a.alvo, e.et
  ), tudo (item_id, kind, tempo, falta, motivo, desde, mes, channel_ref, youtube_id, marcado, bloqueados, snap_oldest, snap_espera_desde, snap_libera_em, snap_bloqueio, apagar, b2_nomes, prefixos) as (
    select * from item_item union all select * from canal_item union all select * from antiga
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', item_id, 'kind', kind, 'tempo', tempo, 'falta', falta, 'motivo', motivo, 'desde', desde, 'mes', mes,
           'channel_ref', channel_ref, 'youtube_id', youtube_id, 'marcado_rodado_em', marcado, 'bloqueados', bloqueados,
           'snapshot_mais_antigo', snap_oldest, 'snap_espera_desde', snap_espera_desde, 'snap_libera_em', snap_libera_em, 'snap_bloqueio', snap_bloqueio, 'apagar', apagar, 'b2_nomes', b2_nomes, 'prefixos', prefixos) order by desde, item_id), '[]'::jsonb)
    into v_itens from tudo;
  return jsonb_build_object('versao', 2, 'lido_em', now(), 'total', jsonb_array_length(v_itens), 'itens', v_itens);
end $$;
revoke all on function public.obs_archive_owner_pending(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_owner_pending(uuid) to service_role, postgres;
