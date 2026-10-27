-- RASCUNHO (não é migration). Desfaz a 20261027000003_manutencao_m5_telas.sql. Gerado por texto das migrations anteriores
-- (A5 E15 20261013000002 e M3b 20261025000002); travado por apps/web/test/integration/manutencao-m5-desfazer.test.ts (md5 e ACL).
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/rascunhos/m5-desfazer.sql (atômico). Reverter o código do site ANTES ou junto: o código tolera
-- 42883/PGRST202 só enquanto SAIDA_DE_MES_EXISTE=false.
-- Ordem: restaurar os corpos antigos (nunca drop de atraso_itens/policy, são da M3b; competitor_hourly_health ANTES do drop de horaria_desde,
-- senão o cron responde 42883), só depois apagar as funções que a M5 criou.
begin;

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
  ), n as (select count(*) as lidas from horas)
  select jsonb_build_object(
    'desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),
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

create or replace function public.obs_archive_policy()
returns table (class text, table_name text, exit_mode text, window_months int, seal_margin_days int, wait_days int,
               auto_allowed text, released boolean, control_column text, filho text)
language sql immutable set search_path = '' as $$
  values
    ('horaria', 'competitor_video_hourly', 'particao', 3, 28, 7, 'depois_de_3', false, 'views', 'numerico'),
    ('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false, 'views', 'numerico'),
    ('serie', 'competitor_video_early', 'particao', 6, 28, 7, 'depois_de_3_da_tabela', false, 'views', 'numerico'),
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

create or replace function public.obs_archive_atraso_itens(p_site uuid)
returns table (tipo text, classe text, tabela text, canal text, mes date, desde date)
language sql stable security definer set search_path = '' as $$
  select 'unidade'::text, r.classe, e.table_name, e.channel_ref, r.mes, public.obs_archive_due_on(r.mes, r.margem)
    from public.obs_archive_meses_devidos(p_site, false) r
    cross join lateral public.obs_archive_expected_units(p_site, r.classe, r.mes) e
   where not exists (select 1 from public.obs_archive_current_units(p_site, r.classe, r.mes) cu
                      where cu.table_name = e.table_name and cu.channel_ref = e.channel_ref
                        and public.obs_archive_is_terminal(cu.received_at, cu.redo_reason, cu.row_count, cu.lost_at, cu.purged_at))
  union all
  select 'mes'::text, r.classe, null::text, null::text, r.mes, public.obs_archive_due_on(r.mes, r.margem)
    from public.obs_archive_meses_devidos(p_site, false) r
   where exists (select 1 from public.obs_archive_expected_units(p_site, r.classe, r.mes))
     and not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = r.classe and m.month = r.mes and m.sealed_at is not null and m.unsealed_at is null)
$$;
revoke all on function public.obs_archive_atraso_itens(uuid) from public, anon, authenticated, service_role;

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
      'channel_ref', f.channel_ref,
      'estado', case when r.channel_ref is null then 'sem_destino'
                     when not exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = f.channel_ref)
                          and not exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = f.channel_ref) then 'sem_arquivo'
                     when r.archive_decision = 'guardar' then 'guardado'
                     else 'pedido' end,
      'decided_at', r.decided_at, 'nas_absent_at', r.nas_absent_at, 'b2_absent_at', r.b2_absent_at, 'snapshots_clear_on', r.snapshots_clear_on,
      'reappeared_at', r.reappeared_at, 'reappeared_count', coalesce(r.reappeared_count, 0), 'online_thumbs_known', r.online_thumbs_known,
      'thumbs_unknown_ack_at', r.thumbs_unknown_ack_at, 'blobs_pendentes', coalesce(array_length(r.blobs_pending, 1), 0), 'youtube_channel_id', r.youtube_channel_id,
      'primeiro_mes', case when r.channel_ref is null then to_char(a.primeiro, 'YYYY-MM') end, 'ultimo_mes', case when r.channel_ref is null then to_char(a.ultimo, 'YYYY-MM') end,
      'meses', case when r.channel_ref is null then coalesce(a.meses, 0) end, 'registros', case when r.channel_ref is null then coalesce(a.registros, 0) end,
      'classes', case when r.channel_ref is null then to_jsonb(coalesce(a.classes, '{}'::text[])) end
    ) order by f.channel_ref), '[]'::jsonb)
    from refs f
    left join public.obs_archive_channel_removals r on r.site_id = p_site and r.channel_ref = f.channel_ref
    left join agg a on a.channel_ref = f.channel_ref
$$;
revoke all on function public.obs_archive_removed_channel_list(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_removed_channel_list(uuid) to service_role;

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
    select c.month from cheios c where exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = c.class and m.table_name = c.table_name and m.month = c.month
                                                 and (m.dropped_at is not null or m.detached_at is not null))
  ), vr as (
    select v.published_at from public.competitor_videos v where v.competitor_channel_id = p_channel and v.archive_dropped_at is not null
  )
  select jsonb_build_object('status', 'ok',
      'meses', (select count(distinct month) from cheios), 'de', (select to_char(min(month), 'YYYY-MM') from cheios), 'ate', (select to_char(max(month), 'YYYY-MM') from cheios),
      'registros', (select coalesce(sum(row_count), 0) from cheios),
      'fora_do_banco', jsonb_build_object('meses', (select count(distinct month) from fora), 'de', (select to_char(min(month), 'YYYY-MM') from fora), 'ate', (select to_char(max(month), 'YYYY-MM') from fora)),
      'videos_retirados', jsonb_build_object('n', (select count(*) from vr), 'de', (select min(published_at)::date::text from vr), 'ate', (select max(published_at)::date::text from vr)),
      'imagens_blob', coalesce(array_length(public.obs_archive_channel_blobs(p_site, v_ref), 1), 0))
    into j;
  return j;
end $$;
revoke all on function public.obs_archive_channel_archive_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_channel_archive_impact(uuid, uuid) to service_role;

drop function if exists public.obs_archive_aviso(uuid);
drop function if exists public.obs_archive_pagina(uuid);
drop function if exists public.obs_archive_online_since(uuid);
drop function if exists public.obs_archive_horaria_desde(uuid);
commit;
