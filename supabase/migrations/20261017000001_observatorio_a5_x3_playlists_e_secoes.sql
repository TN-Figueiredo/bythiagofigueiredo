-- A5, X3 (dono, 17/10: "siga com as recomendações"): playlists e seções dos canais concorrentes, só o que muda.
-- Aditiva: cinco tabelas e quatro funções novas (vazias, sem chamador até OBS_X3_PLAYLISTS=on) e o registro do export
-- recriado com as 22 entradas da MG6 iguais e cinco a mais. Idempotente (provada dentro de transação, 2×). Volta: drop das cinco tabelas e das quatro funções,
-- e recriar o registro com as 22 (corpo da MG6).
set lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.obs_archive_registry()') is null then
    raise exception 'X3 depende da MG6 (obs_archive_registry)';
  end if;
  if to_regprocedure('public.competitor_channel_pause_covers(uuid,timestamptz,interval)') is null then
    raise exception 'X3 depende da MG6 (pausa)';
  end if;
end $$;

-- 1. Estado da leitura por canal
create table if not exists public.competitor_playlist_reads (
  competitor_channel_id uuid primary key references public.competitor_channels(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  first_visit_at timestamptz not null,                           -- 1ª visita, nunca muda (J4: alarme de canal que nunca fecha a volta)
  last_visit_at timestamptz not null,
  last_visit_day date not null,                                  -- dia de São Paulo
  last_status text not null check (last_status in ('ok', 'parcial', 'erro')),
  last_reason text check (last_reason ~ '^[a-z0-9_]{1,60}$'),
  last_units integer not null check (last_units >= 0),
  playlists_left integer check (playlists_left >= 0),
  last_complete_at timestamptz,                                  -- só visita 'ok'
  last_cycle_at timestamptz,                                     -- volta terminada (toda playlist tentada até o teto; Phil I-4)
  empty_streak smallint not null default 0 check (empty_streak >= 0),
  sections_empty_streak smallint not null default 0 check (sections_empty_streak >= 0)
);
create index if not exists idx_cplr_site on public.competitor_playlist_reads (site_id);

-- 2. Playlists
create table if not exists public.competitor_playlists (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  playlist_id text not null check (length(playlist_id) between 2 and 64 and playlist_id !~ '^(UU|LL|FL)'),
  title text,
  published_at timestamptz,
  item_count integer check (item_count >= 0),                    -- nulo = a API não mandou; nunca 0 por falta
  privacy text,
  state_sha256 text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since date,                                            -- só com lista completa
  items_read_at timestamptz,                                     -- só a ordem da fila
  items_complete_at timestamptz,                                 -- última leitura COMPLETA sem saída em massa pendente (J3 = N2)
  items_status text check (items_status in ('ok', 'parcial', 'erro')),
  items_reason text check (items_reason ~ '^[a-z0-9_]{1,60}$'),
  mass_exit_day date,                                            -- dia (SP) em que uma saída em massa ficou a confirmar (Phil I-1)
  unique (competitor_channel_id, playlist_id)
);
create index if not exists idx_cpl_site on public.competitor_playlists (site_id);

create table if not exists public.competitor_playlist_versions (
  id bigint generated always as identity primary key,
  playlist_ref uuid not null references public.competitor_playlists(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  state_sha256 text not null,
  raw jsonb not null,                                            -- o item inteiro da API, sem etag (P-4: miniaturas e itemCount inclusos)
  prev_seen_at timestamptz,                                      -- quando o estado anterior foi visto pela última vez (Phil I-6)
  observed_at timestamptz not null default now()                 -- a 1ª linha é "pelo menos desde"
);
create index if not exists idx_cplv_playlist on public.competitor_playlist_versions (playlist_ref, observed_at desc, id desc);

create table if not exists public.competitor_playlist_items (
  playlist_ref uuid not null references public.competitor_playlists(id) on delete cascade,
  item_id text not null check (length(item_id) between 1 and 128),
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  position integer check (position >= 0),
  added_at timestamptz,                                          -- snippet.publishedAt: quando entrou na playlist
  video_published_at timestamptz,
  video_owner_channel_id text,
  privacy text,
  note text,                                                     -- contentDetails.note, texto do criador, sanitizado (Phil M-3)
  first_seen_at timestamptz not null,
  removed_since date,                                            -- só com leitura completa da playlist
  removed_after timestamptz,                                     -- limite inferior da janela: items_complete_at anterior da playlist (Phil I-6, J3; nulo = sem leitura completa antes)
  primary key (playlist_ref, item_id)
);
create index if not exists idx_cpli_site_video on public.competitor_playlist_items (site_id, youtube_video_id);

create table if not exists public.competitor_channel_sections (
  id bigint generated always as identity primary key,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  state_sha256 text not null,
  raw jsonb not null,
  prev_seen_at timestamptz,                                      -- last_visit_at anterior do canal (Phil I-6)
  observed_at timestamptz not null default now()
);
create index if not exists idx_ccs_channel on public.competitor_channel_sections (competitor_channel_id, observed_at desc, id desc);

do $$
declare t text;
begin
  foreach t in array array['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions',
                           'competitor_playlist_items', 'competitor_channel_sections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_select', t);
  end loop;
end $$;

-- 3. A guarda comum das quatro funções: canal deste site, presente e não pausado. Trava o canal (consultivo) na transação.
create or replace function public.competitor_x3_guard(p_site uuid, p_channel uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if p_site is null or p_channel is null then
    raise exception 'X3:parametro_nulo' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('x3:' || p_channel::text, 0));
  perform 1 from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site and c.missing_since is null and c.collection_paused_at is null;
  if not found then
    raise exception 'X3:canal_indisponivel' using errcode = 'P0001';
  end if;
end $$;

-- 4. Lista de playlists. p_rows = [{playlist_id, title, published_at, item_count, privacy, state_sha256, raw}].
create or replace function public.competitor_x3_playlists_record(
  p_site uuid, p_channel uuid, p_now timestamptz, p_rows jsonb, p_complete boolean
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_ids jsonb;
  v_versoes integer;
  v_sumidas integer := 0;
  v_prev jsonb;
  v_max timestamptz;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or jsonb_typeof(p_rows) <> 'array' or p_complete is null then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- J2, N5: portão monotônico no topo; execução abandonada com p_now velho não marca sumidas nem grava versão
  select max(q.last_seen_at) into v_max from public.competitor_playlists q where q.competitor_channel_id = p_channel;
  if v_max is not null and p_now < v_max then
    return jsonb_build_object('atrasada', true, 'ids', '{}'::jsonb, 'versoes', 0, 'sumidas', 0);
  end if;
  -- Phil I-6: o último "visto" de cada playlist, lido ANTES do upsert que o sobrescreve
  select coalesce(jsonb_object_agg(q.playlist_id, q.last_seen_at), '{}'::jsonb) into v_prev
    from public.competitor_playlists q where q.competitor_channel_id = p_channel;
  with lido as (
    select distinct on (x.playlist_id) x.*
      from jsonb_to_recordset(p_rows) as x(playlist_id text, title text, published_at timestamptz, item_count integer,
                                           privacy text, state_sha256 text, raw jsonb)
     order by x.playlist_id
  ), up as (
    insert into public.competitor_playlists as p
      (site_id, competitor_channel_id, playlist_id, title, published_at, item_count, privacy, state_sha256, first_seen_at, last_seen_at)
    select p_site, p_channel, l.playlist_id, l.title, l.published_at, l.item_count, l.privacy, l.state_sha256, p_now, p_now from lido l
    on conflict (competitor_channel_id, playlist_id) do update
      set title = excluded.title, published_at = excluded.published_at, item_count = excluded.item_count,
          privacy = excluded.privacy, state_sha256 = excluded.state_sha256, last_seen_at = excluded.last_seen_at,
          missing_since = null
    returning p.id, p.playlist_id
  )
  select coalesce(jsonb_object_agg(up.playlist_id, up.id), '{}'::jsonb) into v_ids from up;

  -- versão nova só quando o hash difere do último gravado da playlist
  -- Yannis M-6: o "último" casa com o índice (observed_at desc, id desc), igual à X1
  insert into public.competitor_playlist_versions (playlist_ref, site_id, state_sha256, raw, prev_seen_at, observed_at)
  select distinct on (l.playlist_id) (v_ids ->> l.playlist_id)::uuid, p_site, l.state_sha256, l.raw, (v_prev ->> l.playlist_id)::timestamptz, p_now   -- Yannis: distinct on
    from jsonb_to_recordset(p_rows) as l(playlist_id text, state_sha256 text, raw jsonb)
   where l.state_sha256 is distinct from (
     select m.state_sha256 from public.competitor_playlist_versions m
      where m.playlist_ref = (v_ids ->> l.playlist_id)::uuid
      order by m.observed_at desc, m.id desc limit 1);
  get diagnostics v_versoes = row_count;

  if p_complete then
    update public.competitor_playlists p
       set missing_since = (p_now at time zone 'America/Sao_Paulo')::date
     where p.competitor_channel_id = p_channel and p.missing_since is null
       and not (v_ids ? p.playlist_id);
    get diagnostics v_sumidas = row_count;
  end if;
  return jsonb_build_object('ids', v_ids, 'versoes', v_versoes, 'sumidas', v_sumidas);
end $$;

-- 5. Itens de uma playlist. p_rows = [{item_id, youtube_video_id, position, added_at, video_published_at, video_owner_channel_id, privacy, note}].
--    p_complete = o código já conferiu (a) todas as páginas sem erro e sem corte e (b) totalResults presente e igual ao lido (Phil I-1).
create or replace function public.competitor_x3_items_record(
  p_site uuid, p_channel uuid, p_playlist uuid, p_now timestamptz, p_rows jsonb, p_complete boolean, p_status text, p_reason text
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_novos integer;
  v_saidos integer := 0;
  v_massa boolean := false;
  v_ant timestamptz;
  v_compl timestamptz;
  v_massa_dia date;
  v_hoje date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_presentes integer;
  v_sairiam integer;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  select p.items_read_at, p.items_complete_at, p.mass_exit_day into v_ant, v_compl, v_massa_dia
    from public.competitor_playlists p where p.id = p_playlist and p.competitor_channel_id = p_channel;
  if not found then
    raise exception 'X3:playlist_de_outro_canal' using errcode = 'P0001';
  end if;
  if p_now is null or jsonb_typeof(p_rows) <> 'array' or p_complete is null
     or p_status not in ('ok', 'parcial', 'erro') or (p_complete and p_status <> 'ok') then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- J2, N5: portão monotônico no TOPO (antes de tocar em itens e em removed_since): execução abandonada com p_now velho morre aqui
  if v_ant is not null and p_now < v_ant then
    return jsonb_build_object('gravados', 0, 'saidos', 0, 'saida_em_massa_a_confirmar', false, 'atrasada', true);
  end if;
  with lido as (
    select distinct on (x.item_id) x.*
      from jsonb_to_recordset(p_rows) as x(item_id text, youtube_video_id text, position integer, added_at timestamptz,
                                           video_published_at timestamptz, video_owner_channel_id text, privacy text, note text)
     order by x.item_id
  )
  -- `position` reescreve a playlist inteira quando entra item no topo (~7 mil updates por semana no pior caso; aceito, Yannis M-2)
  insert into public.competitor_playlist_items as i
    (playlist_ref, item_id, site_id, youtube_video_id, position, added_at, video_published_at, video_owner_channel_id, privacy, note, first_seen_at)
  select p_playlist, l.item_id, p_site, l.youtube_video_id, l.position, l.added_at, l.video_published_at, l.video_owner_channel_id, l.privacy, l.note, p_now
    from lido l
  on conflict (playlist_ref, item_id) do update
    set position = excluded.position, privacy = excluded.privacy, video_owner_channel_id = excluded.video_owner_channel_id,
        note = excluded.note, removed_since = null, removed_after = null,
        -- Phil M-2: campo que a origem passa a mandar depois (vídeo privado que vira público) não se perde
        video_published_at = coalesce(excluded.video_published_at, i.video_published_at),
        added_at = coalesce(excluded.added_at, i.added_at)
    where i.position is distinct from excluded.position or i.privacy is distinct from excluded.privacy
       or i.video_owner_channel_id is distinct from excluded.video_owner_channel_id or i.note is distinct from excluded.note
       or i.removed_since is not null
       or (i.video_published_at is null and excluded.video_published_at is not null)
       or (i.added_at is null and excluded.added_at is not null);
  get diagnostics v_novos = row_count;   -- inseridos + alterados

  if p_complete then
    -- Phil I-1: saída em massa (mais da metade dos presentes e mais de 5) não é gravada na 1ª vez; a visita de OUTRO dia confirma
    select count(*), count(*) filter (where i.item_id not in (select x.item_id from jsonb_to_recordset(p_rows) as x(item_id text)))
      into v_presentes, v_sairiam
      from public.competitor_playlist_items i where i.playlist_ref = p_playlist and i.removed_since is null;
    if v_sairiam > 5 and v_sairiam * 2 > v_presentes and (v_massa_dia is null or v_massa_dia >= v_hoje) then
      v_massa := true;
    else
      -- Phil I-6, J3 = N2: removed_after = items_complete_at ANTERIOR da playlist (lido antes do update final; v_compl; nulo = sem leitura completa antes)
      update public.competitor_playlist_items i
         set removed_since = v_hoje, removed_after = v_compl
       where i.playlist_ref = p_playlist and i.removed_since is null
         and i.item_id not in (select x.item_id from jsonb_to_recordset(p_rows) as x(item_id text));
      get diagnostics v_saidos = row_count;
    end if;
  end if;
  update public.competitor_playlists p
     set items_read_at = p_now,
         items_complete_at = case when p_complete and not v_massa then p_now else p.items_complete_at end,
         items_status = case when v_massa then 'parcial' else p_status end,
         items_reason = case when v_massa then 'saida_em_massa_a_confirmar' else p_reason end,
         -- Phil M-3: leitura parcial não apaga a marca pendente; só a leitura completa sem massa a zera
         mass_exit_day = case when v_massa then coalesce(v_massa_dia, v_hoje) when p_complete then null else p.mass_exit_day end
   where p.id = p_playlist;   -- o portão monotônico está no topo (J2)
  return jsonb_build_object('gravados', v_novos, 'saidos', v_saidos, 'saida_em_massa_a_confirmar', v_massa, 'atrasada', false);
end $$;

-- 6. Seções: só quando o hash muda.
create or replace function public.competitor_x3_sections_record(p_site uuid, p_channel uuid, p_now timestamptz, p_sha text, p_raw jsonb)
returns integer language plpgsql set search_path = '' as $$
declare k integer;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or p_sha is null or p_raw is null then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- Phil M-4: portão monotônico, como nas outras três: execução abandonada com p_now velho não grava versão antiga
  if exists (select 1 from public.competitor_channel_sections m where m.competitor_channel_id = p_channel and m.observed_at > p_now) then
    return 0;
  end if;
  -- prev_seen_at (Phil I-6): last_visit_at do canal, lido aqui, antes do visit_close que o sobrescreve.
  -- Yannis M-6: "último" por (observed_at desc, id desc), casando com idx_ccs_channel.
  insert into public.competitor_channel_sections (competitor_channel_id, site_id, state_sha256, raw, prev_seen_at, observed_at)
  select p_channel, p_site, p_sha, p_raw,
         (select r.last_visit_at from public.competitor_playlist_reads r where r.competitor_channel_id = p_channel), p_now
   where p_sha is distinct from (
     select m.state_sha256 from public.competitor_channel_sections m
      where m.competitor_channel_id = p_channel order by m.observed_at desc, m.id desc limit 1);
  get diagnostics k = row_count;
  return k;
end $$;

-- 7. Fecho da visita. p_ciclo = volta terminada, calculado pelo código (`calcularCiclo`): playlists_left = 0, lista completa e nenhum motivo recuperável (J1 = N1).
create or replace function public.competitor_x3_visit_close(
  p_site uuid, p_channel uuid, p_now timestamptz, p_status text, p_reason text, p_units integer, p_left integer,
  p_lista_vazia boolean, p_secoes_vazias boolean, p_ciclo boolean
) returns void language plpgsql set search_path = '' as $$
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or p_status not in ('ok', 'parcial', 'erro') or p_units is null or p_units < 0 then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  insert into public.competitor_playlist_reads as r
    (competitor_channel_id, site_id, first_visit_at, last_visit_at, last_visit_day, last_status, last_reason, last_units, playlists_left,
     last_complete_at, last_cycle_at, empty_streak, sections_empty_streak)
  values (p_channel, p_site, p_now, p_now, (p_now at time zone 'America/Sao_Paulo')::date, p_status, p_reason, p_units, p_left,
          case when p_status = 'ok' then p_now end,
          case when p_status = 'ok' or coalesce(p_ciclo, false) then p_now end,
          case when coalesce(p_lista_vazia, false) then 1 else 0 end,
          case when coalesce(p_secoes_vazias, false) then 1 else 0 end)
  on conflict (competitor_channel_id) do update
    set last_visit_at = excluded.last_visit_at, last_visit_day = excluded.last_visit_day, last_status = excluded.last_status,
        last_reason = excluded.last_reason, last_units = excluded.last_units, playlists_left = excluded.playlists_left,
        last_complete_at = coalesce(excluded.last_complete_at, r.last_complete_at),
        last_cycle_at = coalesce(excluded.last_cycle_at, r.last_cycle_at),
        -- tri-state (Yannis): nulo preserva, false zera, true soma; first_visit_at nunca é atualizado (J4)
        empty_streak = case when p_lista_vazia is null then r.empty_streak when p_lista_vazia then least(r.empty_streak + 1, 100) else 0 end,
        sections_empty_streak = case when p_secoes_vazias is null then r.sections_empty_streak when p_secoes_vazias then least(r.sections_empty_streak + 1, 100) else 0 end
    -- Yannis M-1: gravação atrasada de uma execução abandonada nunca sobrescreve a visita mais nova
    where r.last_visit_at <= excluded.last_visit_at;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.competitor_x3_guard(uuid, uuid)',
    'public.competitor_x3_playlists_record(uuid, uuid, timestamptz, jsonb, boolean)',
    'public.competitor_x3_items_record(uuid, uuid, uuid, timestamptz, jsonb, boolean, text, text)',
    'public.competitor_x3_sections_record(uuid, uuid, timestamptz, text, jsonb)',
    'public.competitor_x3_visit_close(uuid, uuid, timestamptz, text, text, integer, integer, boolean, boolean, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 8. O registro do export. Guarda: o instalado tem de ser as 22 da MG6 (ou as 27, reaplicação).
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
begin
  select array_agg(r.table_name order by r.table_name) into v_inst from public.obs_archive_registry() r;
  if v_inst is distinct from (select array_agg(x order by x) from unnest(v_22) x)
     and v_inst is distinct from (select array_agg(x order by x) from unnest(v_22 || v_5) x) then
    raise exception 'X3: registro instalado inesperado (%): reconciliar antes de aplicar', array_to_string(v_inst, ', ');
  end if;
end $$;

-- X3:REGISTRO:INICIO
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
    ('competitor_channel_sections', 't.competitor_channel_id = $1', '(t.observed_at at time zone ''UTC'')::date', null, 't.id');
$$;
revoke all on function public.obs_archive_registry() from public, anon, authenticated;
grant execute on function public.obs_archive_registry() to service_role;
-- X3:REGISTRO:FIM
