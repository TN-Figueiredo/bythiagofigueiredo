-- A5, F1 do "Remover canal" (dono, 19/10): só banco. Uma migration, quatro seções.
--   §A  yt_watch_* entram no registro do export (27 -> 30), a remoção arquivada as apaga depois de exportadas e conferidas,
--       e a pausa de um canal tira os alvos dele da fila da watch.
--   §B  "remoção pedida" (pausa na hora, libera a vaga, pode ser desfeita) e o Desfazer.
--   §C  apagar sem guardar (só quem administra o site, só canal com até 30 dias, nome digitado, nenhum vídeo compartilhado).
--   §D  privilégios.
-- Idempotente (aplicada duas vezes no bythiago_int; a segunda só traz NOTICE).
-- Volta: drop das funções novas e da tabela obs_unarchived_deletions, drop do gatilho competitor_channels_pausa_tira_watch, drop das
-- colunas removal_*, e recriar obs_archive_registry() (corpo da X3, 27 entradas) e competitor_channel_remove_archived (corpo da MG6).
-- ATENÇÃO: obs_archive_registry() e competitor_channel_remove_archived() são recriadas aqui por CÓPIA do corpo anterior (X3 e MG6).
-- Se outra frente as recriar depois, perde a F1: rode B1.1 e B1.3 (observatorio-a5-remover-f1.test.ts) no portão de qualquer migration que as toque.
set lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.obs_archive_registry()') is null or to_regprocedure('public.competitor_channel_remove_archived(uuid,uuid,uuid)') is null then
    raise exception 'F1 depende da MG6 (export do E10)';
  end if;
  if to_regclass('public.yt_watch_readings') is null or to_regclass('public.yt_watch_thumbs') is null or to_regclass('public.yt_watch_alvos') is null then
    raise exception 'F1 depende da S4 (yt_watch_*)';
  end if;
  if to_regclass('public.competitor_channel_sections') is null then
    raise exception 'F1 depende da X3 (registro com 27 entradas)';
  end if;
end $$;

-- A.0 (Phil C-1, 19/10) As quatro funções da coleta precisam conhecer a pausa. A 20261018000002 recriou competitor_comment_health sem o
-- remendo da MG6 §10, e a pausa (de que o pedido de remoção depende) recusa com pausa_sem_remendo. Cópia literal do bloco da MG6 §10: idempotente.
do $$
declare
  r record;
  v_def text;
  v_n integer;
begin
  for r in
    select * from (values
      ('public.competitor_series_health(uuid,timestamptz)',
       'or v.missing_since is not null or c.missing_since is not null',
       'or v.missing_since is not null or c.missing_since is not null or public.competitor_channel_pause_covers(c.id, p_now, interval ''3 days'')'),
      ('public.competitor_hourly_health(uuid,timestamptz,integer,integer)',
       'and v.missing_since is null and c.missing_since is null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''26 hours'')'),
      ('public.competitor_comment_due(timestamptz,jsonb,interval,integer,text[],interval,timestamptz,uuid)',
       'and v.missing_since is null and c.missing_since is null and v.published_at is not null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''0'') and v.published_at is not null'),
      ('public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)',
       'and v.missing_since is null and c.missing_since is null and v.published_at is not null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''7 days'') and v.published_at is not null')
    ) as t(assinatura, ancora, troca)
  loop
    v_def := pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
    continue when v_def like '%competitor_channel_pause_covers%';
    v_n := (length(v_def) - length(replace(v_def, r.ancora, ''))) / length(r.ancora);
    if v_n <> 1 then
      raise exception 'MG6: a âncora do remendo aparece % vez(es) em % (esperado: 1). O corpo da função mudou: conferir antes de aplicar.', v_n, r.assinatura;
    end if;
    execute replace(v_def, r.ancora, r.troca);
  end loop;
end $$;

-- ═══════════════════════════ §A. yt_watch_* no arquivo, remoção arquivada e pausa ═══════════════════════════

-- A.1 Guarda do registro: o instalado tem de ser as 27 da X3 (ou as 30, reaplicação).
do $$
declare
  v_inst text[];
  v_22 text[] := array['competitor_channels', 'competitor_collection_pauses', 'competitor_channel_snapshots',
    'competitor_channel_hour_map', 'competitor_videos', 'competitor_field_versions', 'competitor_raw',
    'competitor_video_versions', 'competitor_changes', 'competitor_video_tier_spans', 'competitor_video_daily',
    'competitor_video_marks', 'competitor_video_mark_misses', 'competitor_missing_baseline', 'competitor_video_early',
    'competitor_video_hourly', 'competitor_hour_fold_log', 'competitor_video_comment_snaps', 'competitor_video_comments',
    'competitor_video_comment_marks', 'youtube_intelligence_tasks', 'competitor_readings'];
  v_5 text[] := array['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions',
    'competitor_playlist_items', 'competitor_channel_sections'];
  v_3 text[] := array['yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings'];
begin
  select array_agg(r.table_name order by r.table_name) into v_inst from public.obs_archive_registry() r;
  if v_inst is distinct from (select array_agg(x order by x) from unnest(v_22 || v_5) x)
     and v_inst is distinct from (select array_agg(x order by x) from unnest(v_22 || v_5 || v_3) x) then
    raise exception 'F1: registro instalado inesperado (%): reconciliar antes de aplicar', array_to_string(v_inst, ', ');
  end if;
end $$;

-- A.2 O registro do export: corpo da X3 igual, mais as três tabelas da watch no fim (thumbs antes de readings: readings tem FK para thumbs).
-- sum_sql é obrigatório: sem ele o diff só confere contagem por mês e uma troca de linha passa.
-- F1:REGISTRO:INICIO
create or replace function public.obs_archive_registry()
returns table (table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
language sql
stable
set search_path = ''
as $$
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
     '(t.lida_em at time zone ''UTC'')::date', 't.id', 't.id');
$$;
revoke all on function public.obs_archive_registry() from public, anon, authenticated;
grant execute on function public.obs_archive_registry() to service_role;
-- F1:REGISTRO:FIM

-- A.3 Trava comum: vídeo que outro canal do site, ou um teste nosso (alvo que não é de concorrente), também acompanha.
create or replace function public.obs_f1_video_compartilhado(p_site uuid, p_channel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
       select 1
         from public.competitor_videos v
         join public.competitor_channels c on c.id = v.competitor_channel_id
        where c.site_id = p_site and c.id <> p_channel
          and v.video_id in (select m.video_id from public.competitor_videos m where m.competitor_channel_id = p_channel))
     or exists (
       select 1 from public.yt_watch_alvos a
        where a.site_id = p_site and a.tipo <> 'concorrente'
          and a.youtube_video_id in (select m.video_id from public.competitor_videos m where m.competitor_channel_id = p_channel)) then
    raise exception 'E10:video_compartilhado: um vídeo deste canal também é acompanhado por outro canal ou por um teste nosso' using errcode = 'P0001';
  end if;
end $$;

-- A.4 A remoção arquivada (passo 4 do E10), agora com a watch.
create or replace function public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  for v_t in
    select x.nome, x.apagadas,
           coalesce((select sum(b.row_count) from public.obs_archive_batches b
                      where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text
                        and b.table_name = x.nome and b.deleted_at is null), 0) as arquivadas
      from (values ('yt_watch_readings', v_n_l), ('yt_watch_thumbs', v_n_t), ('yt_watch_alvos', v_n_a)) x (nome, apagadas)
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
     or exists (select 1 from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt)) then
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
                            'watch', jsonb_build_object('readings', v_n_l, 'thumbs', v_n_t, 'alvos', v_n_a))
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'removido', 'batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'blob_urls', to_jsonb(v_urls), 'featured_refs_cleared', v_featured,
                            'watch', jsonb_build_object('readings', v_n_l, 'thumbs', v_n_t, 'alvos', v_n_a));
end $$;

-- A.5 Pausar um canal tira os alvos dele da fila da watch (cobre toda via de pausa: CLI, pedido de remoção, futuras).
-- Na despausa, a conciliação já reativa `removido` + `janela_concorrente`.
create or replace function public.competitor_channel_pause_stops_watch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.collection_paused_at is null and new.collection_paused_at is not null then
    update public.yt_watch_alvos a
       set saiu_em = pg_catalog.clock_timestamp(), saiu_por = 'removido'
     where a.site_id = new.site_id and a.tipo = 'concorrente' and a.saiu_em is null
       and a.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = new.id);
  end if;
  return null;
end $$;
comment on function public.competitor_channel_pause_stops_watch() is
  'saiu_por=removido aqui significa pausado; valor proprio so quando a S4 for recriada (Phil M-3)';

drop trigger if exists competitor_channels_pausa_tira_watch on public.competitor_channels;
create trigger competitor_channels_pausa_tira_watch
  after update of collection_paused_at on public.competitor_channels
  for each row execute function public.competitor_channel_pause_stops_watch();

-- A.6 Backfill idempotente: canal que já estava pausado antes desta migration (a segunda execução atualiza 0 linhas).
update public.yt_watch_alvos a
   set saiu_em = pg_catalog.clock_timestamp(), saiu_por = 'removido'
  from public.competitor_channels c
  join public.competitor_videos v on v.competitor_channel_id = c.id
 where c.collection_paused_at is not null
   and a.site_id = c.site_id and a.youtube_video_id = v.video_id
   and a.tipo = 'concorrente' and a.saiu_em is null;

-- ═══════════════════════════ §B. Remoção pedida e Desfazer ═══════════════════════════

alter table public.competitor_channels add column if not exists removal_requested_at timestamptz;
alter table public.competitor_channels add column if not exists removal_requested_by uuid;
alter table public.competitor_channels add column if not exists removal_was_paused boolean;
alter table public.competitor_channels add column if not exists removal_reason text;
-- (Phil C-2) reter_ate de cada alvo ANTES do pedido (id do alvo -> valor), para o Desfazer e a recarga devolverem a retenção da prova de A/B
alter table public.competitor_channels add column if not exists removal_reter_antes jsonb;

alter table public.competitor_channels drop constraint if exists competitor_channels_removal_par;
alter table public.competitor_channels add constraint competitor_channels_removal_par check (
  (removal_requested_at is null) = (removal_requested_by is null)
  and (removal_requested_at is null) = (removal_was_paused is null)
  and (removal_requested_at is null) = (removal_reason is null)
  and (removal_requested_at is null) = (removal_reter_antes is null));
alter table public.competitor_channels drop constraint if exists competitor_channels_removal_reason_forma;
alter table public.competitor_channels add constraint competitor_channels_removal_reason_forma check (
  removal_reason is null or removal_reason ~ '^[a-z_]{1,40}$');
create index if not exists idx_competitor_channels_removal
  on public.competitor_channels (site_id) where removal_requested_at is not null;

-- B.1 Pedir a remoção: pausa na hora (se ainda não estava), libera a vaga (a conta é do código), segura a poda da watch até o export.
create or replace function public.competitor_channel_request_removal(p_site uuid, p_channel uuid, p_by uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_was boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_ret integer;
  v_paused timestamptz;
  v_prev jsonb;
begin
  if p_site is null or p_channel is null or p_by is null or p_motivo is null or p_motivo !~ '^[a-z_]{1,40}$' then
    raise exception 'E10:parametro_nulo: competitor_channel_request_removal' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: só quem administra o site pede a remoção de um canal' using errcode = '42501';
  end if;
  select c.missing_since, c.collection_paused_at, c.removal_requested_at into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_c.missing_since is not null then
    raise exception 'E10:saiu_do_youtube: este canal saiu do YouTube' using errcode = 'P0001';
  end if;
  if v_c.removal_requested_at is not null then
    select count(*) into v_ret from public.yt_watch_alvos a
     where a.site_id = p_site and a.tipo = 'concorrente' and a.reter_ate = 'infinity'
       and a.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel);
    return jsonb_build_object('status', 'ja_pedido', 'requested_at', v_c.removal_requested_at,
                              'paused_at', v_c.collection_paused_at, 'retido_ate_exportar', v_ret);
  end if;
  -- a trava vem ANTES da pausa e dos updates
  perform public.obs_f1_video_compartilhado(p_site, p_channel);
  v_was := v_c.collection_paused_at is not null;
  if not v_was then
    perform public.competitor_channel_pause(p_site, p_channel, p_by);
  end if;
  select coalesce(jsonb_object_agg(a.id::text, a.reter_ate), '{}'::jsonb) into v_prev
    from public.yt_watch_alvos a
   where a.site_id = p_site and a.tipo = 'concorrente' and a.reter_ate is not null
     and a.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel);
  update public.competitor_channels c
     set removal_requested_at = v_now, removal_requested_by = p_by, removal_was_paused = v_was, removal_reason = p_motivo,
         removal_reter_antes = v_prev
   where c.id = p_channel and c.site_id = p_site
  returning c.collection_paused_at into v_paused;
  -- o pedido segura a poda: sem isso a yt_watch_poda apaga a watch 30 dias depois da pausa e o export sai sem ela
  update public.yt_watch_alvos a set reter_ate = 'infinity'
   where a.site_id = p_site and a.tipo = 'concorrente'
     and a.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel);
  get diagnostics v_ret = row_count;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data)
  select p_by, 'observatorio_remocao_pedida', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('channel_id', p_channel, 'ja_pausado', v_was, 'motivo', p_motivo)
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'pedido', 'requested_at', v_now, 'paused_at', v_paused, 'retido_ate_exportar', v_ret);
end $$;

-- B.2 Desfazer. D-RC1: a conta de vaga daqui e a do "adicionar" do CMS não têm trava entre si; uma corrida no mesmo segundo pode dar
-- 76 de 75, sem perda de dado (já existe hoje entre dois "adicionar"). O 75 é o DEFAULT_CHANNEL_LIMIT do código (teste S5.4).
create or replace function public.competitor_channel_cancel_removal(p_site uuid, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_usados integer;
  v_limite integer;
  v_u jsonb;
  v_desp boolean := false;
  v_inv integer := 0;
begin
  if p_site is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: competitor_channel_cancel_removal' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: só quem administra o site desfaz a remoção de um canal' using errcode = '42501';
  end if;
  select c.removal_requested_at, c.removal_was_paused, c.removal_reter_antes into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_c.removal_requested_at is null then
    return jsonb_build_object('status', 'nao_pedido', 'despausado', false, 'arquivos_invalidados', 0);
  end if;
  select count(*) into v_usados from public.competitor_channels c where c.site_id = p_site and c.removal_requested_at is null;
  v_limite := coalesce((select s.channel_limit from public.competitor_settings s where s.site_id = p_site), 75);
  if v_usados >= v_limite then
    raise exception 'E10:sem_vaga: não há vaga para este canal voltar' using errcode = 'P0001';
  end if;
  update public.competitor_channels c
     set removal_requested_at = null, removal_requested_by = null, removal_was_paused = null, removal_reason = null, removal_reter_antes = null
   where c.id = p_channel and c.site_id = p_site;
  update public.yt_watch_alvos a set reter_ate = (v_c.removal_reter_antes ->> a.id::text)::timestamptz
   where a.site_id = p_site and a.tipo = 'concorrente' and a.reter_ate = 'infinity'
     and a.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel);
  if not v_c.removal_was_paused then
    v_u := public.competitor_channel_unpause(p_site, p_channel, p_by);
    v_desp := (v_u ->> 'status') = 'despausado';
    v_inv := coalesce((v_u ->> 'arquivos_invalidados')::integer, 0);
  end if;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data)
  select p_by, 'observatorio_remocao_cancelada', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('channel_id', p_channel, 'despausado', v_desp)
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'cancelado', 'despausado', v_desp, 'arquivos_invalidados', v_inv);
end $$;

-- ═══════════════════════════ §C. Apagar sem guardar ═══════════════════════════

-- C.1 O registro do que foi apagado sem arquivo (miniaturas do Blob pendentes, retrato do apagado, ids da watch para o sweep).
create table if not exists public.obs_unarchived_deletions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_ref text not null,
  channel_name text not null,
  youtube_channel_id text not null,
  reason text not null check (reason ~ '^[a-z_]{1,40}$'),
  deleted_at timestamptz not null,
  deleted_by uuid not null,
  rows_deleted jsonb not null,
  youtube_video_ids text[] not null default '{}',
  blob_urls_pending text[] not null default '{}'
);
create index if not exists idx_obs_unarchived_deletions_site on public.obs_unarchived_deletions (site_id, deleted_at desc);
alter table public.obs_unarchived_deletions enable row level security;
alter table public.obs_unarchived_deletions force row level security;
drop policy if exists obs_unarchived_deletions_select on public.obs_unarchived_deletions;
create policy obs_unarchived_deletions_select on public.obs_unarchived_deletions for select using (public.can_edit_site(site_id));
revoke all on public.obs_unarchived_deletions from anon, authenticated;
grant select on public.obs_unarchived_deletions to authenticated;
grant all on public.obs_unarchived_deletions to service_role;

-- C.2 O lote de um canal apagado sem guardar encerra com um motivo próprio.
alter table public.obs_archive_batches drop constraint if exists obs_archive_batches_closed_reason_check;
alter table public.obs_archive_batches add constraint obs_archive_batches_closed_reason_check
  check (closed_reason in ('despausado', 'substituido', 'canal_apagado', 'apagado_sem_arquivo'));

-- C.2b A regra da confirmação do nome, para a tela espelhar: espaços de qualquer tipo (inclusive NBSP e espaços Unicode) viram um espaço,
-- pontas aparadas, caixa ignorada, acento preservado ("São" <> "Sao"). Caractere de controle NÃO é espaço: continua diferente.
create or replace function public.obs_nome_normalizado(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(p_nome, '[\u200b\u2060\ufeff]', '', 'g'),
    '[ \t\n\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+', ' ', 'g')))
$$;

-- C.3 Apagar sem guardar. Uma transação: tudo ou nada.
create or replace function public.competitor_channel_delete_unarchived(
  p_site uuid, p_channel uuid, p_actor uuid, p_confirm_name text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
     or exists (select 1 from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt)) then
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
     or v_n_a <> coalesce((v_antes ->> 'yt_watch_alvos')::bigint, 0) then
    raise exception 'E10:apagou_alem_do_arquivo: watch leituras=% miniaturas=% alvos=%', v_n_l, v_n_t, v_n_a using errcode = 'P0001';
  end if;
  v_watch := jsonb_build_object('readings', v_n_l, 'thumbs', v_n_t, 'alvos', v_n_a);
  -- as três chaves da watch existem SEMPRE (zero quando nada foi apagado): quem lê não distingue "0" de "não medido"
  v_rows := v_rows || jsonb_build_object('yt_watch_readings', v_n_l, 'yt_watch_thumbs', v_n_t, 'yt_watch_alvos', v_n_a);

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
end $$;

-- C.4 A leitura que um disparo em voo gravou depois do apagamento (yt_watch_gravar_disparo não confere o alvo e a poda só alcança
-- leitura com alvo): varre leituras e miniaturas dos vídeos de apagamentos recentes, poupando vídeo que voltou (alvo ou competitor_videos).
create or replace function public.obs_unarchived_watch_sweep(p_agora timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
  end loop;
  -- (Phil M-1) guarda diária: 'infinity' órfão (canal do pedido apagado por outra via) nunca seria podado
  update public.yt_watch_alvos a set reter_ate = null
   where a.tipo = 'concorrente' and a.reter_ate = 'infinity'
     and not exists (select 1 from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
                      where c.site_id = a.site_id and v.video_id = a.youtube_video_id and c.removal_requested_at is not null);
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  return v_total;
end $$;

-- C.5 Baixa das miniaturas já apagadas do Blob.
create or replace function public.obs_unarchived_blobs_done(p_site uuid, p_id bigint, p_urls text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restam integer;
begin
  if p_site is null or p_id is null or p_urls is null then
    raise exception 'E10:parametro_nulo: obs_unarchived_blobs_done' using errcode = '22023';
  end if;
  update public.obs_unarchived_deletions u
     set blob_urls_pending = coalesce((select array_agg(x) from unnest(u.blob_urls_pending) x where x <> all (p_urls)), '{}'::text[])
   where u.site_id = p_site and u.id = p_id
  returning cardinality(u.blob_urls_pending) into v_restam;
  return v_restam;
end $$;

-- C.6 Só a contagem da watch de um canal (a janela do botão não pode usar .in() com muitos ids: estoura a URL). Somente leitura.
create or replace function public.competitor_channel_removal_extra(p_site uuid, p_channel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_yt text[];
begin
  if p_site is null or p_channel is null then
    raise exception 'E10:parametro_nulo: competitor_channel_removal_extra' using errcode = '22023';
  end if;
  perform 1 from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(v.video_id), '{}'::text[]) into v_yt from public.competitor_videos v where v.competitor_channel_id = p_channel;
  return jsonb_build_object(
    'readings', (select count(*) from public.yt_watch_readings r where r.site_id = p_site and r.youtube_video_id = any(v_yt)),
    'thumbs', (select count(*) from public.yt_watch_thumbs t where t.site_id = p_site and t.youtube_video_id = any(v_yt)),
    'alvos', (select count(*) from public.yt_watch_alvos a where a.site_id = p_site and a.youtube_video_id = any(v_yt)));
end $$;

-- ═══════════════════════════ §D. Privilégios ═══════════════════════════
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.obs_archive_registry()',
    'public.competitor_channel_remove_archived(uuid, uuid, uuid)',
    'public.obs_f1_video_compartilhado(uuid, uuid)',
    'public.competitor_channel_pause_stops_watch()',
    'public.competitor_channel_request_removal(uuid, uuid, uuid, text)',
    'public.competitor_channel_cancel_removal(uuid, uuid, uuid)',
    'public.competitor_channel_delete_unarchived(uuid, uuid, uuid, text, text)',
    'public.obs_unarchived_watch_sweep(timestamptz)',
    'public.obs_unarchived_blobs_done(uuid, bigint, text[])',
    'public.competitor_channel_removal_extra(uuid, uuid)',
    'public.obs_nome_normalizado(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- (Phil C-1) falha a migration inteira em vez de subir um botão morto
do $$ begin
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health')
                and p.prosrc not like '%competitor_channel_pause_covers%') then
    raise exception 'F1: alguma função da coleta não conhece a pausa';
  end if;
end $$;
