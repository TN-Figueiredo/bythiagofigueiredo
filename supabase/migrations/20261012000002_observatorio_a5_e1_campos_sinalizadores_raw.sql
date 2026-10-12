-- =============================================================================
-- MIGRATION MG1: observatorio_a5_e1_campos_sinalizadores_raw
-- =============================================================================
-- Fase A5 do Observatório, etapa E1 (spec v2.3, arquivo 01, seção 4.1; tabela da E9, seção 4.5).
-- O que traz: colunas de estado e sinalizadores em competitor_videos e competitor_channels; histórico de
-- campo (competitor_field_versions); resposta crua só quando muda (competitor_raw); o registro do que foi
-- apagado (competitor_removed_items, usado pela E9); a soma atômica da cota (youtube_quota_add); a marcação
-- de ausência em duas leituras (competitor_mark_missing, competitor_channel_mark_missing); a prova embutida
-- da captura (competitor_capture_health); e competitor_channel_removal_impact contando as tabelas novas.
--
-- Idempotência: add column if not exists, create table/index if not exists, create or replace function,
-- drop policy if exists antes de create policy, drop default (não falha sem default). Reexecutar é seguro.
-- Compatibilidade com o código em produção ANTES do deploy da E1: só acrescenta. Nenhuma coluna existente
-- muda de tipo nem ganha NOT NULL; o único escritor de competitor_videos (competitor-sync.ts) já manda os
-- três contadores no insert, então tirar o default 0 não muda o que ele grava; youtube_quota_usage tem 0
-- linhas e nenhum escritor; competitor_channel_removal_impact só ganha chaves (o leitor ignora as extras).
-- Segurança: funções security invoker, search_path vazio, nomes qualificados; execute só para service_role.
-- Emenda do portão de fim de plano (12/10/2026): três índices (cascata e histórico por vídeo e por canal), guarda
-- de site nas duas funções de plano, a 2ª falta só conta 3 horas depois da 1ª, a prova usa last_checked_at e o
-- começo da E1 no site, e a chave canais_em_erro_3d.

-- Falha rápido se houver sessão presa segurando competitor_videos (o alter table pede trava exclusiva por
-- milissegundos); reexecutar é seguro. Devolvido ao padrão na última linha.
set lock_timeout = '5s';

-- 1. Estado atual do vídeo (nulo = a API não devolveu / ainda não lido pelo código novo)
alter table public.competitor_videos
  add column if not exists discovered_at timestamptz,
  add column if not exists default_language text,
  add column if not exists default_audio_language text,
  add column if not exists live_broadcast_content text,
  add column if not exists live_scheduled_start_at timestamptz,
  add column if not exists live_actual_start_at timestamptz,
  add column if not exists live_actual_end_at timestamptz,
  add column if not exists was_live boolean,
  add column if not exists comments_disabled boolean,
  add column if not exists likes_hidden boolean,
  add column if not exists views_hidden boolean,
  add column if not exists miss_streak smallint not null default 0,
  add column if not exists miss_first_at timestamptz,
  add column if not exists missing_since date,
  add column if not exists last_seen_at timestamptz,
  add column if not exists removal_decision text check (removal_decision in ('manter')),
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;
alter table public.competitor_videos alter column view_count drop default;
alter table public.competitor_videos alter column like_count drop default;
alter table public.competitor_videos alter column comment_count drop default;

comment on column public.competitor_videos.discovered_at is 'Instante da 1ª leitura do vídeo pelo Observatório. Nulo nas linhas anteriores à MG1: nunca preenchido por palpite.';
comment on column public.competitor_videos.miss_streak is 'Leituras SEGUIDAS em que o vídeo foi pedido a videos.list e não veio. Zera quando ele vem. Teto 32000.';
comment on column public.competitor_videos.miss_first_at is 'Instante da 1ª leitura sem o vídeo da sequência atual (miss_streak >= 1). Nulo quando o vídeo veio. É de onde sai a data de missing_since.';
comment on column public.competitor_videos.missing_since is 'Data (São Paulo) da 1ª das duas leituras seguidas sem o vídeo. Nulo = veio, ou faltou uma vez só.';
comment on column public.competitor_videos.last_seen_at is 'Última leitura em que o vídeo VEIO. Só o código da E1 em diante escreve.';
comment on column public.competitor_videos.views_hidden is 'A última resposta veio sem viewCount (estatística oculta ou estreia agendada). Vídeo assim fica fora das provas de série.';

-- 2. Estado atual do canal
alter table public.competitor_channels
  add column if not exists custom_url text,
  add column if not exists description text,
  add column if not exists published_at timestamptz,
  add column if not exists country text,
  add column if not exists subscribers_hidden boolean,
  add column if not exists miss_streak smallint not null default 0,
  add column if not exists miss_first_at timestamptz,
  add column if not exists missing_since date,
  add column if not exists last_seen_at timestamptz,
  add column if not exists removal_decision text check (removal_decision in ('manter')),
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;
alter table public.competitor_channel_snapshots
  add column if not exists subscribers_hidden boolean;

-- 3. Histórico de campo: uma linha por valor, com início, fim e precisão
create table if not exists public.competitor_field_versions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,
  field text not null,
  value jsonb,
  value_hash text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,
  precision text not null check (precision in ('6h', '1d', '7d', 'gap', 'first')),
  is_current boolean not null default true
);
create unique index if not exists idx_cfv_one_current_video
  on public.competitor_field_versions (video_id, field) where is_current and video_id is not null;
create unique index if not exists idx_cfv_one_current_channel
  on public.competitor_field_versions (competitor_channel_id, field) where is_current and video_id is null;
create index if not exists idx_cfv_channel_seen
  on public.competitor_field_versions (competitor_channel_id, first_seen_at);
-- histórico de UM vídeo (leitor da E5) e a cascata de apagar vídeo (E9): sem este índice, uma varredura por vídeo
create index if not exists idx_cfv_video_seen
  on public.competitor_field_versions (video_id, first_seen_at) where video_id is not null;
alter table public.competitor_field_versions enable row level security;
drop policy if exists "competitor_field_versions_select" on public.competitor_field_versions;
create policy "competitor_field_versions_select" on public.competitor_field_versions
  for select using (public.can_view_site(site_id));

-- 4. Resposta das partes pedidas, só quando muda
create table if not exists public.competitor_raw (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,
  raw_sha256 text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  is_current boolean not null default true,
  raw jsonb not null
);
create unique index if not exists idx_craw_one_current_video
  on public.competitor_raw (video_id) where is_current and video_id is not null;
create unique index if not exists idx_craw_one_current_channel
  on public.competitor_raw (competitor_channel_id) where is_current and video_id is null;
-- as respostas fechadas não estão nos índices parciais acima: a cascata de apagar canal ou vídeo precisa destes dois
create index if not exists idx_craw_channel on public.competitor_raw (competitor_channel_id);
create index if not exists idx_craw_video on public.competitor_raw (video_id) where video_id is not null;
alter table public.competitor_raw enable row level security;
drop policy if exists "competitor_raw_select" on public.competitor_raw;
create policy "competitor_raw_select" on public.competitor_raw
  for select using (public.can_edit_site(site_id));

-- 5. O que sobra depois de "apagar" (E9): uma linha sem conteúdo
create table if not exists public.competitor_removed_items (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('video', 'canal', 'comentario')),
  youtube_id text not null,
  competitor_channel_id uuid,
  missing_since date,
  decided_at timestamptz not null default now(),
  decided_by uuid not null,
  rows_deleted jsonb not null,
  blobs_pending text[] not null default '{}',
  archive_pending boolean not null default false,
  purge_count smallint not null default 1,
  returned_seen_at timestamptz,
  return_decision text check (return_decision in ('voltar', 'ignorar')),
  return_decided_at timestamptz,
  unique (site_id, kind, youtube_id)
);
alter table public.competitor_removed_items enable row level security;
drop policy if exists "competitor_removed_items_select" on public.competitor_removed_items;
create policy "competitor_removed_items_select" on public.competitor_removed_items
  for select using (public.can_edit_site(site_id));

-- 6. Escrita atômica do histórico de campo de UM canal (o canal e os vídeos dele), várias linhas por chamada.
--    p_close: [{"id": 123, "last_seen_at": "<última leitura boa do vídeo ou do canal>"}]
--    p_open:  [{"video_id": "<uuid>" | null, "field": "...", "value": <json>, "value_hash": "...",
--               "first_seen_at": "...", "window_start": "..." | null, "precision": "6h|1d|7d|gap|first"}]
create or replace function public.apply_competitor_field_plan(
  p_site_id uuid, p_channel_id uuid, p_close jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_closed integer := 0;
  v_opened integer := 0;
  v_asked integer := jsonb_array_length(coalesce(p_open, '[]'::jsonb));
begin
  -- o canal tem de ser do site informado: as linhas levam p_site_id, e a RLS destas tabelas é por site_id
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception '%: canal % não é do site %', 'apply_competitor_field_plan', p_channel_id, p_site_id;
  end if;

  update public.competitor_field_versions f
     set is_current = false,
         last_seen_at = greatest(f.last_seen_at, coalesce(c.seen, f.last_seen_at))
    from (select (x ->> 'id')::bigint as id, (x ->> 'last_seen_at')::timestamptz as seen
            from jsonb_array_elements(coalesce(p_close, '[]'::jsonb)) x) c
   where f.id = c.id and f.competitor_channel_id = p_channel_id and f.site_id = p_site_id and f.is_current;
  get diagnostics v_closed = row_count;

  insert into public.competitor_field_versions
    (site_id, competitor_channel_id, video_id, field, value, value_hash, first_seen_at, last_seen_at, window_start, precision, is_current)
  select p_site_id, p_channel_id, o.video_id, o.field, o.value, o.value_hash, o.first_seen_at, o.first_seen_at, o.window_start, o.precision, true
    from jsonb_to_recordset(coalesce(p_open, '[]'::jsonb)) as o(
      video_id uuid, field text, value jsonb, value_hash text, first_seen_at timestamptz, window_start timestamptz, precision text)
   where o.video_id is null
      or exists (select 1 from public.competitor_videos v where v.id = o.video_id and v.competitor_channel_id = p_channel_id);
  get diagnostics v_opened = row_count;

  if v_opened <> v_asked then
    raise exception 'apply_competitor_field_plan: % de % versões abertas (vídeo de outro canal?)', v_opened, v_asked;
  end if;
  return jsonb_build_object('closed', v_closed, 'opened', v_opened);
end $$;

-- 7. O mesmo molde para o raw.
--    p_close: [{"id": 123, "last_seen_at": "..."}]
--    p_open:  [{"video_id": "<uuid>" | null, "raw_sha256": "...", "first_seen_at": "...", "raw": {...}}]
create or replace function public.apply_competitor_raw_plan(
  p_site_id uuid, p_channel_id uuid, p_close jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_closed integer := 0;
  v_opened integer := 0;
  v_asked integer := jsonb_array_length(coalesce(p_open, '[]'::jsonb));
begin
  -- o canal tem de ser do site informado: as linhas levam p_site_id, e a RLS destas tabelas é por site_id
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception '%: canal % não é do site %', 'apply_competitor_raw_plan', p_channel_id, p_site_id;
  end if;

  update public.competitor_raw r
     set is_current = false,
         last_seen_at = greatest(r.last_seen_at, coalesce(c.seen, r.last_seen_at))
    from (select (x ->> 'id')::bigint as id, (x ->> 'last_seen_at')::timestamptz as seen
            from jsonb_array_elements(coalesce(p_close, '[]'::jsonb)) x) c
   where r.id = c.id and r.competitor_channel_id = p_channel_id and r.site_id = p_site_id and r.is_current;
  get diagnostics v_closed = row_count;

  insert into public.competitor_raw
    (site_id, competitor_channel_id, video_id, raw_sha256, first_seen_at, last_seen_at, is_current, raw)
  select p_site_id, p_channel_id, o.video_id, o.raw_sha256, o.first_seen_at, o.first_seen_at, true, o.raw
    from jsonb_to_recordset(coalesce(p_open, '[]'::jsonb)) as o(
      video_id uuid, raw_sha256 text, first_seen_at timestamptz, raw jsonb)
   where o.video_id is null
      or exists (select 1 from public.competitor_videos v where v.id = o.video_id and v.competitor_channel_id = p_channel_id);
  get diagnostics v_opened = row_count;

  if v_opened <> v_asked then
    raise exception 'apply_competitor_raw_plan: % de % linhas abertas (vídeo de outro canal?)', v_opened, v_asked;
  end if;
  return jsonb_build_object('closed', v_closed, 'opened', v_opened);
end $$;

-- 8. Ausência: soma 1 na sequência de cada vídeo pedido e não devolvido; na 2ª leitura seguida grava
--    missing_since com a data (São Paulo) da PRIMEIRA. Uma instrução só: duas execuções não se atropelam.
--    Devolve o estado de cada vídeo depois da marca (o chamador abre a versão availability = 'sumiu').
--    A 2ª falta só conta 3 HORAS depois da 1ª: o "sincronizar agora" logo depois do cron, ou uma nova tentativa
--    minutos depois, não são uma segunda leitura independente (as faixas do cron distam 6 horas).
create or replace function public.competitor_mark_missing(
  p_channel_id uuid, p_video_ids uuid[], p_now timestamptz
) returns jsonb
language sql security invoker set search_path = '' as $$
  with u as (
    update public.competitor_videos v
       set miss_streak = case when v.miss_first_at is not null and p_now - v.miss_first_at < interval '3 hours'
                              then v.miss_streak else least(v.miss_streak + 1, 32000) end,
           miss_first_at = coalesce(v.miss_first_at, p_now),
           missing_since = case
             when v.missing_since is not null then v.missing_since
             when v.miss_first_at is not null and p_now - v.miss_first_at >= interval '3 hours'
               then (v.miss_first_at at time zone 'America/Sao_Paulo')::date
             else null end
     where v.id = any(coalesce(p_video_ids, '{}'::uuid[])) and v.competitor_channel_id = p_channel_id
    returning v.id, v.miss_streak, v.miss_first_at, v.missing_since, v.last_seen_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'miss_streak', u.miss_streak, 'miss_first_at', u.miss_first_at,
    'missing_since', u.missing_since, 'last_seen_at', u.last_seen_at)), '[]'::jsonb)
  from u;
$$;

create or replace function public.competitor_channel_mark_missing(
  p_channel_id uuid, p_now timestamptz
) returns jsonb
language sql security invoker set search_path = '' as $$
  with u as (
    update public.competitor_channels c
       set miss_streak = case when c.miss_first_at is not null and p_now - c.miss_first_at < interval '3 hours'
                              then c.miss_streak else least(c.miss_streak + 1, 32000) end,
           miss_first_at = coalesce(c.miss_first_at, p_now),
           missing_since = case
             when c.missing_since is not null then c.missing_since
             when c.miss_first_at is not null and p_now - c.miss_first_at >= interval '3 hours'
               then (c.miss_first_at at time zone 'America/Sao_Paulo')::date
             else null end
     where c.id = p_channel_id
    returning c.id, c.miss_streak, c.miss_first_at, c.missing_since, c.last_seen_at
  )
  select coalesce((select jsonb_build_object(
    'id', u.id, 'miss_streak', u.miss_streak, 'miss_first_at', u.miss_first_at,
    'missing_since', u.missing_since, 'last_seen_at', u.last_seen_at) from u), 'null'::jsonb);
$$;

-- 9. Cota: soma atômica na linha do dia (o dia é o do Pacífico, calculado por quem chama).
--    p_add: chaves somadas ({"competitors": 12}); p_max: chaves que guardam o maior valor do dia.
alter table public.youtube_quota_usage alter column operations set default '{}'::jsonb;

create or replace function public.jsonb_num_merge(p_base jsonb, p_add jsonb, p_max jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k.key,
    case when coalesce(p_max, '{}'::jsonb) ? k.key
      then greatest(coalesce((b.o ->> k.key)::numeric, 0), (p_max ->> k.key)::numeric)
      else coalesce((b.o ->> k.key)::numeric, 0) + coalesce((coalesce(p_add, '{}'::jsonb) ->> k.key)::numeric, 0)
    end), '{}'::jsonb)
  from (select case when jsonb_typeof(p_base) = 'object' then p_base else '{}'::jsonb end as o) b,
       lateral (
         select jsonb_object_keys(b.o) as key
         union select jsonb_object_keys(coalesce(p_add, '{}'::jsonb))
         union select jsonb_object_keys(coalesce(p_max, '{}'::jsonb))
       ) k;
$$;

create or replace function public.youtube_quota_add(
  p_site_id uuid, p_day date, p_units integer, p_add jsonb default '{}'::jsonb, p_max jsonb default '{}'::jsonb
) returns integer
language sql security invoker set search_path = '' as $$
  insert into public.youtube_quota_usage as q (site_id, date, units_used, operations, updated_at)
  values (p_site_id, p_day, greatest(coalesce(p_units, 0), 0), public.jsonb_num_merge('{}'::jsonb, p_add, p_max), now())
  on conflict (site_id, date) do update
    set units_used = q.units_used + excluded.units_used,
        operations = public.jsonb_num_merge(q.operations, p_add, p_max),
        updated_at = now()
  returning units_used;
$$;

-- 10. Prova embutida da captura (itens de aceite 1, 2, 10 e 12): o cron lê a cada execução. Só leitura.
--     'videos_vistos_sem_raw' usa last_checked_at (carimbado em TODA leitura do vídeo, com ou sem captura), como o
--     item 1 do spec; last_seen_at só é carimbado quando a captura dá certo e deixaria a prova cega justamente na
--     falha. 'canais_vistos_sem_raw' usa last_ok_synced_at pelo mesmo motivo. As duas só contam o que foi lido
--     DEPOIS da primeira resposta guardada do site (e1.desde): o que o código anterior à E1 leu no dia do deploy
--     não tem resposta guardada e não é falha. Sem nenhuma resposta guardada no site as duas dão 0 (a captura
--     falhando para tudo deixa todo canal em erro, que é outro alarme).
--     'canais_em_erro_12h' não conta canal ausente (missing_since): esse está na fila da E9, não é falha de coleta.
--     'canais_em_erro_3d' é o fim do vermelho: quem lê fica vermelho enquanto 12h > 3d e depois vira nota.
create or replace function public.competitor_capture_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with e1 as (select min(r.first_seen_at) as desde from public.competitor_raw r where r.site_id = p_site_id)
  select jsonb_build_object(
    'videos_vistos_sem_raw', (
      select count(*) from public.competitor_videos v
        join public.competitor_channels c on c.id = v.competitor_channel_id
        cross join e1
       where c.site_id = p_site_id and e1.desde is not null
         and v.last_checked_at > greatest(p_now - interval '1 day', e1.desde)
         and not exists (select 1 from public.competitor_raw r where r.video_id = v.id and r.is_current)),
    'canais_vistos_sem_raw', (
      select count(*) from public.competitor_channels c cross join e1
       where c.site_id = p_site_id and e1.desde is not null
         and c.last_ok_synced_at > greatest(p_now - interval '1 day', e1.desde)
         and not exists (select 1 from public.competitor_raw r
                          where r.competitor_channel_id = c.id and r.video_id is null and r.is_current)),
    'canais_vistos_dia_pacifico', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id
         and c.last_seen_at >= ((p_now at time zone 'America/Los_Angeles')::date)::timestamp at time zone 'America/Los_Angeles'),
    'cota_dia_pacifico', (
      select coalesce(max(q.units_used), 0) from public.youtube_quota_usage q
       where q.site_id = p_site_id and q.date = (p_now at time zone 'America/Los_Angeles')::date),
    'videos_ausentes', (
      select count(*) from public.competitor_videos v
        join public.competitor_channels c on c.id = v.competitor_channel_id
       where c.site_id = p_site_id and v.missing_since is not null),
    'canais_ausentes', (
      select count(*) from public.competitor_channels c where c.site_id = p_site_id and c.missing_since is not null),
    'canais_em_erro_12h', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id and c.sync_status = 'error' and c.missing_since is null
         and c.sync_error_since < p_now - interval '12 hours'),
    'canais_em_erro_3d', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id and c.sync_status = 'error' and c.missing_since is null
         and c.sync_error_since < p_now - interval '3 days')
  );
$$;

-- 11. O que a remoção de um canal apagaria: as mesmas chaves de antes, mais as duas tabelas novas.
create or replace function public.competitor_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
begin
  select c.channel_name into v_name from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'videos', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id),
    'pinned', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id and v.pinned_at is not null),
    'versions', (select count(*) from public.competitor_video_versions x
                 join public.competitor_videos v on v.id = x.video_id where v.competitor_channel_id = p_channel_id),
    'daily_days', (select count(distinct d.snap_date) from public.competitor_video_daily d
                   join public.competitor_videos v on v.id = d.video_id where v.competitor_channel_id = p_channel_id),
    'bookmarks', (select count(*) from public.competitor_changes g
                  join public.competitor_videos v on v.id = g.video_id where v.competitor_channel_id = p_channel_id and g.bookmarked is true),
    'field_versions', (select count(*) from public.competitor_field_versions f where f.competitor_channel_id = p_channel_id),
    'raw', (select count(*) from public.competitor_raw r where r.competitor_channel_id = p_channel_id)
  );
end $$;

-- 12. Quem executa
revoke all on function public.apply_competitor_field_plan(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.apply_competitor_raw_plan(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_mark_missing(uuid, uuid[], timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_mark_missing(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.youtube_quota_add(uuid, date, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.jsonb_num_merge(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_capture_health(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_competitor_field_plan(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.apply_competitor_raw_plan(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.competitor_mark_missing(uuid, uuid[], timestamptz) to service_role;
grant execute on function public.competitor_channel_mark_missing(uuid, timestamptz) to service_role;
grant execute on function public.youtube_quota_add(uuid, date, integer, jsonb, jsonb) to service_role;
grant execute on function public.jsonb_num_merge(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.competitor_capture_health(uuid, timestamptz) to service_role;
grant execute on function public.competitor_channel_removal_impact(uuid, uuid) to service_role;

reset lock_timeout;
