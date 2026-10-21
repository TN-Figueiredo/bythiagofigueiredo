-- ab_native_observados_registro (F1a-dado, T13): as duas tabelas da migration ..._ab_native_observados entram na purga do "Remover canal".
--   (1) obs_archive_registry(): 30 -> 32 entradas (lista inteira recriada por CÓPIA do corpo vigente, lido do banco migrado, mais as duas linhas no fim).
--   (2) competitor_channel_remove_archived(uuid,uuid,uuid): CÓPIA do corpo vigente (F1, 20261021000002) com as duas tabelas apagadas antes do canal,
--       no laço apagadas = arquivadas, no "nada sobra" e no after_data do audit_log. Sem (2), a lista do registro sozinha não apaga nada e remover
--       um canal com linha observada lança E10:sobrou_linha.
--   (3) competitor_channel_delete_unarchived e obs_unarchived_watch_sweep ("apagar sem guardar" e a varredura do disparo em voo): CÓPIA do corpo da F1 com as duas
--       tabelas apagadas também (sem isto o canal apagado deixava trocas observadas órfãs; a poda diária `obs_native_poda` varre o que sobrar).
-- ATENÇÃO: recriadas por cópia; se outra frente as recriar depois, perde esta. Rode observatorio-a5-remover-f1.test.ts e ab-native-observados-registro.test.ts.
-- Guarda: o registro instalado tem de ter exatamente 30 entradas (F1) ou 32 (idempotência), E cada uma das quatro funções tem de estar no corpo exato da F1
-- (md5 de pg_get_functiondef) ou já conter as tabelas novas; senão a migration RECUSA e pede reconciliação (uma emenda de outra frente não é desfeita em silêncio).
-- Idempotente. Volta: recriar as quatro funções com o corpo de 20261021000002.
set lock_timeout = '5s';

do $$
declare
  v_n integer;
  -- md5 de pg_get_functiondef do corpo da F1 (20261021000002), medido no bythiago_int
  c_md5_registro constant text := '36d586af91777093ac1487a60b461c3e';
  c_md5_remove constant text := '450800e70bb8b4a6b20b4f4c02b11d15';
  c_md5_delete constant text := 'a857275ba8ddcde7957b91538e02bd4b';
  c_md5_sweep constant text := 'd4091bc610e1a489752e182b6043e858';
  f record;
begin
  if to_regclass('public.ab_native_observados') is null or to_regclass('public.ab_native_obs_cursor') is null then
    raise exception 'T13: aplique antes a migration ab_native_observados';
  end if;
  select count(*) into v_n from public.obs_archive_registry();
  if v_n not in (30, 32) then
    raise exception 'T13: o registro instalado tem % entradas (esperado 30 ou 32): reconciliar com a F1 antes de aplicar', v_n;
  end if;
  if v_n = 30 and pg_catalog.pg_get_functiondef('public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure) like '%ab_native_observados%' then
    raise exception 'T13: a remoção já conhece as tabelas novas, mas o registro tem 30 entradas: reconciliar';
  end if;
  for f in
    select x.nome, x.assinatura, x.md5_f1, x.marca
      from (values
        ('obs_archive_registry', 'public.obs_archive_registry()', c_md5_registro, 'ab_native_obs_cursor'),
        ('competitor_channel_remove_archived', 'public.competitor_channel_remove_archived(uuid,uuid,uuid)', c_md5_remove, 'ab_native_obs_cursor'),
        ('competitor_channel_delete_unarchived', 'public.competitor_channel_delete_unarchived(uuid,uuid,uuid,text,text)', c_md5_delete, 'ab_native_obs_cursor'),
        ('obs_unarchived_watch_sweep', 'public.obs_unarchived_watch_sweep(timestamptz)', c_md5_sweep, 'ab_native_obs_cursor')
      ) x (nome, assinatura, md5_f1, marca)
  loop
    if pg_catalog.pg_get_functiondef(f.assinatura::regprocedure) not like '%' || f.marca || '%'
       and pg_catalog.md5(pg_catalog.pg_get_functiondef(f.assinatura::regprocedure)) <> f.md5_f1 then
      raise exception 'T13: % foi emendada depois da F1 (md5 diferente): copiar o corpo vigente para esta migration e reconciliar antes de aplicar', f.nome;
    end if;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.obs_archive_registry()
 RETURNS TABLE(table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  values
    ('competitor_channels', 't.id = $1', null, null, 't.id'),
    ('competitor_collection_pauses', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_channel_snapshots', 't.competitor_channel_id = $1', 't.snapshot_date', 't.view_count', 't.id'),
    ('competitor_channel_hour_map', 't.competitor_channel_id = $1', 't.month', null, 't.month, t.format, t.phase'),
    ('competitor_videos', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_field_versions',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_raw',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_video_versions',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_changes',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)', null, null, 't.id'),
    ('competitor_video_tier_spans',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.from_date', null, 't.video_id, t.from_date'),
    ('competitor_video_daily',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.snap_date', 't.views', 't.video_id, t.snap_date'),
    -- (emenda 1: D-I1) tabela da MG4, que ainda não existe: a contagem a pula até existir. Chave primária (video_id, age_days) do spec.
    ('competitor_video_marks',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.age_days'),
    -- (reconciliação 13/10: R1) segunda tabela da MG4 (plano da E4, desvio 4): mesma chave (video_id, age_days). Pulada até existir. NÃO RODADA.
    ('competitor_video_mark_misses',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.age_days'),
    -- (reconciliação 13/10: R2) tabela da MG18 (plano da E9): piso da prova dos ausentes, chave (video_id, missing_since). Pulada até existir. NÃO RODADA.
    ('competitor_missing_baseline',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.missing_since'),
    ('competitor_video_early',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.taken_at at time zone ''UTC'')::date', 't.views', 't.video_id, t.taken_at'),
    ('competitor_video_hourly',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.hour_slot at time zone ''UTC'')::date', 't.views', 't.video_id, t.hour_slot'),
    ('competitor_hour_fold_log',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.day', null, 't.video_id, t.day'),
    ('competitor_video_comment_snaps',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.taken_at at time zone ''UTC'')::date', null, 't.video_id, t.mark'),
    ('competitor_video_comments',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_video_comment_marks',
     't.comment_id in (select k.id from public.competitor_video_comments k where k.competitor_channel_id = $1 or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     null, 't.likes', 't.comment_id, t.mark'),
    -- (revisão Phil 14/10, I-3) a tarefa da forja vem ANTES da leitura: `competitor_readings.task_id` tem chave estrangeira para ela, e a recarga
    -- (`comandos-recarga`) imprime os `\copy` na ordem desta lista. Pai antes de filho; um teste confere todas as chaves entre as tabelas daqui.
    ('youtube_intelligence_tasks',
     't.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.requested_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_readings',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.generated_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_playlist_reads', 't.competitor_channel_id = $1', null, null, 't.competitor_channel_id'),
    ('competitor_playlists', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_playlist_versions',
     't.playlist_ref in (select p.id from public.competitor_playlists p where p.competitor_channel_id = $1)',
     '(t.observed_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_playlist_items',
     't.playlist_ref in (select p.id from public.competitor_playlists p where p.competitor_channel_id = $1)',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.playlist_ref, t.item_id'),
    ('competitor_channel_sections', 't.competitor_channel_id = $1', '(t.observed_at at time zone ''UTC'')::date', null, 't.id'),
    -- F1: a watch é chaveada por (site, vídeo do YouTube) e NÃO está no fecho de cascata do canal; o filtro pega o site e os vídeos do canal
    ('yt_watch_alvos',
     't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, 't.id + t.rodadas', 't.id'),
    ('yt_watch_thumbs',
     't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.primeira_vista at time zone ''UTC'')::date', 't.id + t.vistas', 't.id'),
    ('yt_watch_readings',
     't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.lida_em at time zone ''UTC'')::date', 't.id', 't.id'),
    ('ab_native_observados',
     't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.primeira_troca_em at time zone ''UTC'')::date', 't.id + t.n_versoes', 't.id'),
    ('ab_native_obs_cursor',
     't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.avaliado_em at time zone ''UTC'')::date', 't.avaliado_ate_rodada', 't.site_id, t.youtube_video_id');
$function$;

CREATE OR REPLACE FUNCTION public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_batch text;
  v_c record;
  v_falta text[];
  v_urls text[];
  v_linhas bigint;
  v_arquivos integer;
  v_featured integer;
  v_refs jsonb;       -- (revisão Phil 14/10, I-5) quais comentários de OUTROS canais destacavam este: o set null os zera, o rastro fica no audit_log
  v_yt text[];        -- F1: ids de YouTube dos vídeos do canal (chave das yt_watch_*)
  v_n_l bigint := 0;  -- F1: linhas da watch apagadas
  v_n_t bigint := 0;
  v_n_a bigint := 0;
  v_n_o bigint := 0;  -- T13: trocas observadas e cursor
  v_n_k bigint := 0;
  v_base jsonb;       -- (revisão Phil 14/10, I-2) n_tup_del de cada tabela do fecho de cascata, antes do delete
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
  -- F1 (1/3): vídeo que outro canal do site ou um teste nosso também acompanha não se apaga com este canal
  perform public.obs_f1_video_compartilhado(p_site, p_channel);
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
  -- F1 (2/3): a watch não está no fecho de cascata: apaga explicitamente, ANTES do canal, e compara linha a linha com o lote
  select coalesce(array_agg(v.video_id), '{}'::text[]) into v_yt from public.competitor_videos v where v.competitor_channel_id = p_channel;
  perform 1 from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt) for update;
  delete from public.yt_watch_readings r where r.site_id = p_site and r.youtube_video_id = any(v_yt);
  get diagnostics v_n_l = row_count;
  delete from public.yt_watch_thumbs t where t.site_id = p_site and t.youtube_video_id = any(v_yt);
  get diagnostics v_n_t = row_count;
  delete from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt);
  get diagnostics v_n_a = row_count;
  -- T13: trocas observadas e cursor (chave: site + vídeo do YouTube), antes de competitor_videos
  delete from public.ab_native_observados o where o.site_id = p_site and o.youtube_video_id = any(v_yt);
  get diagnostics v_n_o = row_count;
  delete from public.ab_native_obs_cursor k where k.site_id = p_site and k.youtube_video_id = any(v_yt);
  get diagnostics v_n_k = row_count;
  for v_t in
    select x.nome, x.apagadas,
           coalesce((select sum(b.row_count) from public.obs_archive_batches b
                      where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text
                        and b.table_name = x.nome and b.deleted_at is null), 0) as arquivadas
      from (values ('yt_watch_readings', v_n_l), ('yt_watch_thumbs', v_n_t), ('yt_watch_alvos', v_n_a),
                   ('ab_native_observados', v_n_o), ('ab_native_obs_cursor', v_n_k)) x (nome, apagadas)
  loop
    if v_t.apagadas <> v_t.arquivadas then
      raise exception 'E10:apagou_alem_do_arquivo: % apagadas=% arquivadas=%', v_t.nome, v_t.apagadas, v_t.arquivadas using errcode = 'P0001';
    end if;
  end loop;
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
  select coalesce(jsonb_object_agg(c.relname::text, coalesce(s.n_tup_del, 0)), '{}'::jsonb) into v_base
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_stat_xact_user_tables s on s.relid = c.oid
   where n.nspname = 'public';

  delete from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;

  for v_t in
    with recursive alvo (rel) as (
      select 'public.competitor_channels'::regclass::oid
      union
      select k.conrelid from pg_catalog.pg_constraint k join alvo a on k.confrelid = a.rel
       where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
    )
    select c.relname::text as nome,
           coalesce(s.n_tup_del, 0) - coalesce((v_base ->> c.relname::text)::bigint, 0) as apagadas,
           coalesce((select sum(b.row_count) from public.obs_archive_batches b
                      where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text
                        and b.table_name = c.relname::text and b.deleted_at is null), 0) as arquivadas
      from alvo a
      join pg_catalog.pg_class c on c.oid = a.rel
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      left join pg_catalog.pg_stat_xact_user_tables s on s.relid = c.oid
     where n.nspname = 'public'
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
  -- F1 (3/3): nada da watch sobra para os vídeos do canal
  if exists (select 1 from public.yt_watch_readings r where r.site_id = p_site and r.youtube_video_id = any(v_yt))
     or exists (select 1 from public.yt_watch_thumbs t where t.site_id = p_site and t.youtube_video_id = any(v_yt))
     or exists (select 1 from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt))
     or exists (select 1 from public.ab_native_observados o where o.site_id = p_site and o.youtube_video_id = any(v_yt))
     or exists (select 1 from public.ab_native_obs_cursor k where k.site_id = p_site and k.youtube_video_id = any(v_yt)) then
    raise exception 'E10:sobrou_linha: watch' using errcode = 'P0001';
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
                            'miniaturas_no_blob', cardinality(v_urls), 'featured_refs_cleared', v_featured, 'featured_refs', v_refs,
                            'watch', jsonb_build_object('readings', v_n_l, 'thumbs', v_n_t, 'alvos', v_n_a, 'observados', v_n_o, 'obs_cursor', v_n_k))
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'removido', 'batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'blob_urls', to_jsonb(v_urls), 'featured_refs_cleared', v_featured,
                            'watch', jsonb_build_object('readings', v_n_l, 'thumbs', v_n_t, 'alvos', v_n_a, 'observados', v_n_o, 'obs_cursor', v_n_k));
end $function$;

revoke all on function public.obs_archive_registry() from public, anon, authenticated;
grant execute on function public.obs_archive_registry() to service_role;
revoke all on function public.competitor_channel_remove_archived(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.competitor_channel_remove_archived(uuid, uuid, uuid) to service_role;

CREATE OR REPLACE FUNCTION public.competitor_channel_delete_unarchived(p_site uuid, p_channel uuid, p_actor uuid, p_confirm_name text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_max_dias constant integer := 30;
  v_c record;
  v_yt text[];
  v_busy bigint;
  v_antes jsonb;
  v_urls text[];
  v_base jsonb;
  v_rows jsonb := '{}'::jsonb;
  v_t record;
  v_n_l bigint := 0;
  v_n_t bigint := 0;
  v_n_a bigint := 0;
  v_n_o bigint := 0;  -- T13: trocas observadas e cursor
  v_n_k bigint := 0;
  v_watch jsonb;
  v_id bigint;
  v_featured integer;
  v_refs jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_actor is null or p_confirm_name is null or btrim(p_confirm_name) = ''
     or p_motivo is null or p_motivo !~ '^[a-z_]{1,40}$' then
    raise exception 'E10:parametro_nulo: competitor_channel_delete_unarchived' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_actor) then
    raise exception 'E10:sem_direito: só quem administra o site apaga um canal' using errcode = '42501';
  end if;
  select c.channel_id, c.channel_name, c.added_at, c.missing_since into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_c.missing_since is not null then
    raise exception 'E10:saiu_do_youtube: este canal saiu do YouTube' using errcode = 'P0001';
  end if;
  if v_c.added_at is null or v_now - v_c.added_at > make_interval(days => v_max_dias) then
    raise exception 'E10:canal_antigo: canal com mais de % dias não se apaga sem guardar', v_max_dias using errcode = 'P0001';
  end if;
  -- maiúscula e minúscula valem igual (mockup aprovado em 19/10); espaço de qualquer tipo é normalizado; caractere de controle não
  if public.obs_nome_normalizado(p_confirm_name) is distinct from public.obs_nome_normalizado(v_c.channel_name) then
    raise exception 'E10:nome_nao_confere: o nome digitado não é o nome do canal' using errcode = 'P0001';
  end if;

  perform 1 from public.competitor_videos v where v.competitor_channel_id = p_channel order by v.id for update;
  select coalesce(array_agg(v.video_id), '{}'::text[]) into v_yt from public.competitor_videos v where v.competitor_channel_id = p_channel;
  perform public.obs_f1_video_compartilhado(p_site, p_channel);

  -- tarefa da forja em andamento (janela fixa de 30 min, como na E9)
  perform 1 from public.youtube_intelligence_tasks t
    where t.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)
    order by t.id for update;
  select count(*) into v_busy
    from public.youtube_intelligence_tasks t
    join public.competitor_videos v on v.id = t.target_video_id
   where v.competitor_channel_id = p_channel and t.status = 'running'
     and (t.started_at is null or t.started_at > v_now - interval '30 minutes');
  if v_busy > 0 then
    raise exception 'E10:forja_em_andamento: % tarefa(s) da forja em andamento', v_busy using errcode = 'P0001';
  end if;

  -- retrato do que existe, por tabela, ANTES de apagar
  select coalesce(jsonb_object_agg(x.table_name, x.total), '{}'::jsonb) into v_antes
    from (select n.table_name, sum(n.row_count) as total from public.obs_archive_channel_counts(p_channel) n group by n.table_name) x;
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_urls
    from public.competitor_video_versions x
    join public.competitor_videos v on v.id = x.video_id
   where v.competitor_channel_id = p_channel and x.thumb_blob_url is not null;

  -- medição independente do apagado (n_tup_del do fecho de cascata); sem track_counts a contagem é zero e não vale
  if pg_catalog.current_setting('track_counts') <> 'on' then
    raise exception 'E10:apagou_alem_do_arquivo: track_counts desligado' using errcode = 'P0001';
  end if;
  with recursive alvo (rel) as (
    select 'public.competitor_channels'::regclass::oid
    union
    select k.conrelid from pg_catalog.pg_constraint k join alvo a on k.confrelid = a.rel
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  )
  select coalesce(jsonb_object_agg(c.relname::text, coalesce(s.n_tup_del, 0)), '{}'::jsonb) into v_base
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_stat_xact_user_tables s on s.relid = c.oid
   where n.nspname = 'public';

  -- (Phil I-1) a FK featured_channel_id zera o campo em comentários de OUTROS canais; o n_tup_del não vê update, então o rastro vai ao audit
  select count(*) into v_featured from public.competitor_video_comments k
   where k.featured_channel_id = p_channel and k.competitor_channel_id <> p_channel;
  select coalesce(jsonb_agg(jsonb_build_object('comment_id', k.id, 'video_id', k.video_id, 'channel_ref', k.competitor_channel_id) order by k.id), '[]'::jsonb) into v_refs
    from public.competitor_video_comments k
   where k.featured_channel_id = p_channel and k.competitor_channel_id <> p_channel;

  -- a watch não está no fecho de cascata: apaga explicitamente, antes do canal
  perform 1 from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt) for update;
  delete from public.yt_watch_readings r where r.site_id = p_site and r.youtube_video_id = any(v_yt);
  get diagnostics v_n_l = row_count;
  delete from public.yt_watch_thumbs t where t.site_id = p_site and t.youtube_video_id = any(v_yt);
  get diagnostics v_n_t = row_count;
  delete from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt);
  get diagnostics v_n_a = row_count;
  -- T13: as trocas observadas e o cursor dos mesmos (site, vídeo); também não estão no fecho de cascata
  delete from public.ab_native_observados o where o.site_id = p_site and o.youtube_video_id = any(v_yt);
  get diagnostics v_n_o = row_count;
  delete from public.ab_native_obs_cursor k where k.site_id = p_site and k.youtube_video_id = any(v_yt);
  get diagnostics v_n_k = row_count;

  -- o canal: pela M3b quando ela existir (declara o destino), senão delete direto
  if to_regprocedure('public.competitor_channel_remove(uuid,uuid,text,text,uuid)') is not null then
    perform public.competitor_channel_remove(p_site, p_channel, 'apagar', 'botao', p_actor);
  else
    delete from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;
  end if;
  if exists (select 1 from public.competitor_channels c where c.id = p_channel) then
    raise exception 'E10:sobrou_linha: o canal não foi apagado' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.obs_archive_channel_counts(p_channel)) then
    raise exception 'E10:sobrou_linha: uma tabela do registro não apaga em cascata' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.yt_watch_readings r where r.site_id = p_site and r.youtube_video_id = any(v_yt))
     or exists (select 1 from public.yt_watch_thumbs t where t.site_id = p_site and t.youtube_video_id = any(v_yt))
     or exists (select 1 from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt))
     or exists (select 1 from public.ab_native_observados o where o.site_id = p_site and o.youtube_video_id = any(v_yt))
     or exists (select 1 from public.ab_native_obs_cursor k where k.site_id = p_site and k.youtube_video_id = any(v_yt)) then
    raise exception 'E10:sobrou_linha: watch' using errcode = 'P0001';
  end if;

  -- o apagado medido tem de ser igual ao retrato de antes, tabela a tabela
  for v_t in
    with recursive alvo (rel) as (
      select 'public.competitor_channels'::regclass::oid
      union
      select k.conrelid from pg_catalog.pg_constraint k join alvo a on k.confrelid = a.rel
       where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
    )
    select c.relname::text as nome,
           coalesce(s.n_tup_del, 0) - coalesce((v_base ->> c.relname::text)::bigint, 0) as apagadas
      from alvo a
      join pg_catalog.pg_class c on c.oid = a.rel
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      left join pg_catalog.pg_stat_xact_user_tables s on s.relid = c.oid
     where n.nspname = 'public'
       and c.relname::text not in (select e.table_name from public.obs_archive_excluded() e)
     order by 1
  loop
    if v_t.apagadas <> coalesce((v_antes ->> v_t.nome)::bigint, 0) then
      raise exception 'E10:apagou_alem_do_arquivo: % apagadas=% antes=%', v_t.nome, v_t.apagadas, coalesce(v_antes ->> v_t.nome, '0') using errcode = 'P0001';
    end if;
    if v_t.apagadas > 0 then
      v_rows := v_rows || jsonb_build_object(v_t.nome, v_t.apagadas);
    end if;
  end loop;
  if v_n_l <> coalesce((v_antes ->> 'yt_watch_readings')::bigint, 0)
     or v_n_t <> coalesce((v_antes ->> 'yt_watch_thumbs')::bigint, 0)
     or v_n_a <> coalesce((v_antes ->> 'yt_watch_alvos')::bigint, 0)
     or v_n_o <> coalesce((v_antes ->> 'ab_native_observados')::bigint, 0)
     or v_n_k <> coalesce((v_antes ->> 'ab_native_obs_cursor')::bigint, 0) then
    raise exception 'E10:apagou_alem_do_arquivo: watch leituras=% miniaturas=% alvos=%', v_n_l, v_n_t, v_n_a using errcode = 'P0001';
  end if;
  v_watch := jsonb_build_object('readings', v_n_l, 'thumbs', v_n_t, 'alvos', v_n_a);
  -- as três chaves da watch existem SEMPRE (zero quando nada foi apagado): quem lê não distingue "0" de "não medido"
  v_rows := v_rows || jsonb_build_object('yt_watch_readings', v_n_l, 'yt_watch_thumbs', v_n_t, 'yt_watch_alvos', v_n_a);
  v_rows := v_rows || jsonb_build_object('ab_native_observados', v_n_o, 'ab_native_obs_cursor', v_n_k); -- T13: idem, sempre presentes

  -- lotes abertos deste canal apontam para um canal que não existe mais
  update public.obs_archive_batches b
     set closed_at = v_now, closed_reason = 'apagado_sem_arquivo'
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null and b.closed_at is null;

  insert into public.obs_unarchived_deletions
    (site_id, channel_ref, channel_name, youtube_channel_id, reason, deleted_at, deleted_by, rows_deleted, youtube_video_ids, blob_urls_pending)
  values (p_site, p_channel::text, v_c.channel_name, v_c.channel_id, p_motivo, v_now, p_actor, v_rows, v_yt, v_urls)
  returning id into v_id;

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  select p_actor, 'observatorio_canal_apagado_sem_arquivo', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('channel_id', v_c.channel_id, 'channel_name', v_c.channel_name, 'added_at', v_c.added_at),
         jsonb_build_object('motivo', p_motivo, 'videos', cardinality(v_yt), 'rows_deleted', v_rows, 'watch', v_watch,
                            'miniaturas_no_blob', cardinality(v_urls), 'deletion_id', v_id,
                            'featured_refs_cleared', v_featured, 'featured_refs', v_refs)
    from public.sites s where s.id = p_site;

  return jsonb_build_object('status', 'apagado', 'deletion_id', v_id, 'videos', cardinality(v_yt), 'linhas', v_rows,
                            'watch', v_watch, 'blob_urls', to_jsonb(v_urls),
                            'featured_refs_cleared', v_featured, 'featured_refs', v_refs);
end $function$;

CREATE OR REPLACE FUNCTION public.obs_unarchived_watch_sweep(p_agora timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d record;
  v_total integer := 0;
  v_n integer;
begin
  if p_agora is null then
    raise exception 'E10:parametro_nulo: obs_unarchived_watch_sweep' using errcode = '22023';
  end if;
  for d in select * from public.obs_unarchived_deletions u where u.deleted_at > p_agora - interval '7 days' order by u.id loop
    delete from public.yt_watch_readings r
     where r.site_id = d.site_id and r.youtube_video_id = any(d.youtube_video_ids)
       and not exists (select 1 from public.yt_watch_alvos a where a.site_id = r.site_id and a.youtube_video_id = r.youtube_video_id)
       and not exists (select 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
                        where c.site_id = r.site_id and v.video_id = r.youtube_video_id);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    delete from public.yt_watch_thumbs t
     where t.site_id = d.site_id and t.youtube_video_id = any(d.youtube_video_ids)
       and not exists (select 1 from public.yt_watch_alvos a where a.site_id = t.site_id and a.youtube_video_id = t.youtube_video_id)
       and not exists (select 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
                        where c.site_id = t.site_id and v.video_id = t.youtube_video_id);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    -- T13: as trocas observadas e o cursor do mesmo vídeo (a poda diária também os varre, como órfãos)
    delete from public.ab_native_observados o
     where o.site_id = d.site_id and o.youtube_video_id = any(d.youtube_video_ids)
       and not exists (select 1 from public.yt_watch_alvos a where a.site_id = o.site_id and a.youtube_video_id = o.youtube_video_id)
       and not exists (select 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
                        where c.site_id = o.site_id and v.video_id = o.youtube_video_id);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    delete from public.ab_native_obs_cursor k
     where k.site_id = d.site_id and k.youtube_video_id = any(d.youtube_video_ids)
       and not exists (select 1 from public.yt_watch_alvos a where a.site_id = k.site_id and a.youtube_video_id = k.youtube_video_id)
       and not exists (select 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
                        where c.site_id = k.site_id and v.video_id = k.youtube_video_id);
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;
  -- (Phil M-1) guarda diária: 'infinity' órfão (canal do pedido apagado por outra via) nunca seria podado
  update public.yt_watch_alvos a set reter_ate = null
   where a.tipo = 'concorrente' and a.reter_ate = 'infinity'
     and not exists (select 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
                      where c.site_id = a.site_id and v.video_id = a.youtube_video_id and c.removal_requested_at is not null);
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  return v_total;
end $function$;

reset lock_timeout;
