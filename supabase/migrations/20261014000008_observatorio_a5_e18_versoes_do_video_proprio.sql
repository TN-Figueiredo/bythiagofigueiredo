-- =============================================================================
-- MIGRATION MG12: Observatório A5, etapa E18: versões do vídeo próprio
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md (7.5)
-- Plano: docs/superpowers/plans/2026-10-13-a5-e18-versoes-do-video-proprio-plan.md
-- Aditiva. Roda duas vezes sem erro. Não altera nem apaga dado existente. Não recria função existente.
-- Inerte para o código de main: só cria duas tabelas vazias e três funções novas.
--
-- O que faz:
--   1. yt_own_video_versions: versões de título, thumbnail e descrição, derivadas de yt_own_video_meta_daily.
--   2. yt_own_versions_state: até que dia cada canal já foi derivado.
--   3. RLS nas duas (can_view_private_site se a MG11 já existir; senão can_edit_site). Sem policy de escrita.
--   4. yt_own_versions_apply_day: grava UM canal e UM dia numa transação. Só service_role.
--   5. yt_own_versions_seed_pre: versões reconstruídas do A/B Lab, anteriores ao registro. Só service_role.
--   6. yt_own_versions_prova: a prova diária (item 200). Só leitura. Só service_role.
-- youtube_channel_removal_impact NÃO é recriada: o corpo por catálogo já soma toda tabela presa ao canal
-- por FK "on delete restrict"; as duas daqui entram sozinhas. A migration recusa se o corpo não for esse.
-- =============================================================================
set lock_timeout = '5s';

do $$ begin
  if to_regclass('public.yt_own_video_meta_daily') is null then
    raise exception 'MG12 depende da coleta L1a: public.yt_own_video_meta_daily não existe.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'youtube_channel_removal_impact'
      and p.prosrc like '%pg_catalog.pg_constraint%'
  ) then
    raise exception 'MG12 depende do corpo por catálogo de youtube_channel_removal_impact (MG9 ou MG14). Aplique uma delas antes.';
  end if;
end $$;

-- ── 1. Versões ──────────────────────────────────────────────────────────────
create table if not exists public.yt_own_video_versions (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  field text not null check (field in ('title', 'thumb', 'desc')),
  value_text text,                                -- título ou descrição; nulo na thumbnail
  value_hash text not null check (value_hash ~ '^[0-9a-f]{16,64}$'),
  thumb_dhash text,
  thumb_anchor_dhash text,                        -- dHash da última troca cheia: a âncora da comparação
  thumb_sha256 text,
  thumb_blob_url text,
  thumb_similar boolean not null default false,   -- bytes mudaram, imagem quase igual (retoque)
  first_day_pt date not null,                     -- dia da linha diária em que foi vista pela primeira vez
  last_day_pt date not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,                       -- a troca aconteceu entre window_start e window_end
  window_end timestamptz,
  window_precision text not null check (window_precision in ('first', 'min', '1d', 'lacuna')),
  origin text not null check (origin in ('linha_de_base', 'ab_lab', 'fora_do_sistema', 'nao_se_sabe', 'cms')),  -- 'cms' reservado, sem uso
  ab_event text check (ab_event is null or ab_event in ('rotacao', 'vencedor', 'restauro')),
  ab_test_id uuid,                                -- sem FK: o teste pode ser apagado, a versão fica
  ab_variant_id uuid,
  pre_registro boolean not null default false,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  constraint yovv_dias check (last_day_pt >= first_day_pt),
  constraint yovv_instantes check (last_seen_at >= first_seen_at),
  constraint yovv_janela check (
    (window_precision = 'first') = (window_start is null)
    and (window_start is null) = (window_end is null)
    and (window_end is null or window_end >= window_start)),
  constraint yovv_evento check ((origin = 'ab_lab') = (ab_event is not null)),
  constraint yovv_base check ((window_precision = 'first') = (origin = 'linha_de_base')),
  constraint yovv_min check ((window_precision = 'min') = (origin = 'ab_lab')),
  constraint yovv_thumb check (
    case when field = 'thumb'
      then thumb_dhash is not null and thumb_anchor_dhash is not null and value_text is null
           and value_hash = thumb_dhash and (thumb_similar or thumb_anchor_dhash = thumb_dhash)
           and not (thumb_similar and origin = 'linha_de_base')
      else thumb_dhash is null and thumb_anchor_dhash is null and thumb_sha256 is null
           and thumb_blob_url is null and not thumb_similar
    end),
  constraint yovv_titulo check (field <> 'title' or value_text is not null),
  constraint yovv_pre check (not pre_registro or (not is_current and origin = 'ab_lab' and field = 'title'))
);
create unique index if not exists idx_yovv_one_current
  on public.yt_own_video_versions (youtube_video_id, field) where is_current;
create unique index if not exists idx_yovv_dia          -- o mesmo dia não abre duas versões do mesmo campo
  on public.yt_own_video_versions (youtube_video_id, field, first_day_pt) where not pre_registro;
create unique index if not exists idx_yovv_pre
  on public.yt_own_video_versions (youtube_video_id, field, first_seen_at) where pre_registro;
create index if not exists idx_yovv_canal
  on public.yt_own_video_versions (channel_id, youtube_video_id, field, first_seen_at);
create index if not exists idx_yovv_canal_corrente
  on public.yt_own_video_versions (channel_id) where is_current;
create index if not exists idx_yovv_site on public.yt_own_video_versions (site_id);

-- ── 2. Estado da derivação, por canal ───────────────────────────────────────
create table if not exists public.yt_own_versions_state (
  channel_id uuid primary key references public.youtube_channels(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete cascade,
  tracking_since date not null,                   -- primeiro dia derivado: o "registro desde" do canal
  derived_through date not null,                  -- último dia já derivado
  updated_at timestamptz not null default now(),
  constraint yovs_ordem check (derived_through >= tracking_since)
);

-- ── 3. RLS: leitura por quem tem o direito de ver o dado privado; escrita só por service role ──
alter table public.yt_own_video_versions enable row level security;
alter table public.yt_own_versions_state enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['yt_own_video_versions', 'yt_own_versions_state'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 4. Grava UM canal e UM dia. Recusa dia repetido (reexecução segura) e nunca deixa o dia pela metade ──
create or replace function public.yt_own_versions_apply_day(
  p_channel_id uuid, p_site_id uuid, p_day date, p_touch jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_through date;
  v_touch jsonb := coalesce(p_touch, '[]'::jsonb);
  v_open jsonb := coalesce(p_open, '[]'::jsonb);
  v_touched integer := 0;
  v_opened integer := 0;
  v_closed integer;
  r record;
  v_m record;
begin
  if p_channel_id is null or p_site_id is null or p_day is null then
    raise exception 'argumento_nulo';
  end if;
  if jsonb_typeof(v_touch) <> 'array' or jsonb_typeof(v_open) <> 'array' then
    raise exception 'argumento_invalido';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  if p_day >= (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'dia_nao_fechado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('yt_own_versions:' || p_channel_id::text, 0));
  select s.derived_through into v_through from public.yt_own_versions_state s where s.channel_id = p_channel_id;
  if found and p_day <= v_through then
    return jsonb_build_object('resultado', 'ja_derivado', 'derived_through', v_through);
  end if;

  -- Confirma o que não mudou. Não exige linha diária do dia: a dieta (MG17) confirmará pela cobertura.
  update public.yt_own_video_versions v
     set last_day_pt = p_day, last_seen_at = t.seen_at
    from jsonb_to_recordset(v_touch) as t(id uuid, seen_at timestamptz)
   where v.id = t.id and v.channel_id = p_channel_id and v.site_id = p_site_id
     and v.is_current and not v.pre_registro and v.last_day_pt < p_day and t.seen_at is not null;
  get diagnostics v_touched = row_count;
  if v_touched <> jsonb_array_length(v_touch) then
    raise exception 'touch_recusado';
  end if;

  for r in
    select * from jsonb_to_recordset(v_open) as x(
      youtube_video_id text, video_id uuid, field text, value_text text, value_hash text,
      thumb_dhash text, thumb_anchor_dhash text, thumb_sha256 text, thumb_blob_url text, thumb_similar boolean,
      first_seen_at timestamptz, seen_at timestamptz, window_start timestamptz, window_end timestamptz,
      window_precision text, origin text, ab_event text, ab_test_id uuid, ab_variant_id uuid)
  loop
    -- Abrir versão exige a linha diária do vídeo, deste canal e deste site, neste dia.
    select m.video_id, m.thumbnail_dhash, m.thumbnail_sha256_at_capture, m.thumbnail_blob_url into v_m
      from public.yt_own_video_meta_daily m
     where m.youtube_video_id = r.youtube_video_id and m.day_pt = p_day
       and m.channel_id = p_channel_id and m.site_id = p_site_id;
    if not found then
      raise exception 'sem_linha_do_dia';
    end if;
    -- (emenda 1: S-I6) Chave ausente em p_open chega nula sem erro. A abertura tem de casar com a linha do dia.
    if r.video_id is distinct from v_m.video_id
       or (r.field = 'thumb' and (r.thumb_dhash is distinct from v_m.thumbnail_dhash
             or r.thumb_sha256 is distinct from v_m.thumbnail_sha256_at_capture
             or r.thumb_blob_url is distinct from v_m.thumbnail_blob_url))
       or (r.origin = 'ab_lab' and (r.ab_test_id is null or (r.ab_event = 'rotacao' and r.ab_variant_id is null))) then
      raise exception 'abertura_invalida';
    end if;
    update public.yt_own_video_versions v set is_current = false
     where v.youtube_video_id = r.youtube_video_id and v.field = r.field
       and v.channel_id = p_channel_id and v.is_current;
    get diagnostics v_closed = row_count;
    -- Linha de base só onde não havia corrente; troca só onde havia.
    if (v_closed = 0) is distinct from (r.origin = 'linha_de_base') then
      raise exception 'linha_de_base_incoerente';
    end if;
    insert into public.yt_own_video_versions (
      youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash,
      thumb_dhash, thumb_anchor_dhash, thumb_sha256, thumb_blob_url, thumb_similar,
      first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_start, window_end, window_precision,
      origin, ab_event, ab_test_id, ab_variant_id, pre_registro, is_current
    ) values (
      r.youtube_video_id, p_site_id, r.video_id, p_channel_id, r.field, r.value_text, r.value_hash,
      r.thumb_dhash, r.thumb_anchor_dhash, r.thumb_sha256, r.thumb_blob_url, coalesce(r.thumb_similar, false),
      p_day, p_day, r.first_seen_at, r.seen_at, r.window_start, r.window_end, r.window_precision,
      r.origin, r.ab_event, r.ab_test_id, r.ab_variant_id, false, true
    );
    v_opened := v_opened + 1;
  end loop;

  insert into public.yt_own_versions_state (channel_id, site_id, tracking_since, derived_through)
  values (p_channel_id, p_site_id, p_day, p_day)
  on conflict (channel_id) do update set derived_through = excluded.derived_through, updated_at = now();

  return jsonb_build_object('resultado', 'ok', 'confirmadas', v_touched, 'abertas', v_opened, 'derived_through', p_day);
end;
$$;
revoke all on function public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb) to service_role;

-- ── 5. Semente: títulos de ciclos do A/B Lab anteriores ao início do registro. Nunca versão corrente ──
create or replace function public.yt_own_versions_seed_pre(
  p_channel_id uuid, p_site_id uuid, p_rows jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_since date;
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_ins integer := 0;
  v_n integer;
  r record;
begin
  if p_channel_id is null or p_site_id is null or jsonb_typeof(v_rows) <> 'array' then
    raise exception 'argumento_invalido';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_versions:' || p_channel_id::text, 0));
  select s.tracking_since into v_since from public.yt_own_versions_state s where s.channel_id = p_channel_id;
  if not found then
    raise exception 'sem_estado';
  end if;

  for r in
    select * from jsonb_to_recordset(v_rows) as x(
      youtube_video_id text, video_id uuid, value_text text, value_hash text,
      first_seen_at timestamptz, last_seen_at timestamptz, ab_event text, ab_test_id uuid, ab_variant_id uuid)
  loop
    -- (emenda 1: D-m9) nem o início nem o fim do ciclo podem cair no período registrado.
    if r.first_seen_at is null or r.last_seen_at is null
       or (r.first_seen_at at time zone 'America/Los_Angeles')::date >= v_since
       or (r.last_seen_at at time zone 'America/Los_Angeles')::date >= v_since then
      raise exception 'fora_do_pre_registro';
    end if;
    if not exists (select 1 from public.youtube_videos v
                    where v.youtube_video_id = r.youtube_video_id and v.channel_id = p_channel_id) then
      raise exception 'video_fora_do_canal';
    end if;
    insert into public.yt_own_video_versions (
      youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash,
      first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_start, window_end, window_precision,
      origin, ab_event, ab_test_id, ab_variant_id, pre_registro, is_current
    ) values (
      r.youtube_video_id, p_site_id, r.video_id, p_channel_id, 'title', r.value_text, r.value_hash,
      (r.first_seen_at at time zone 'America/Los_Angeles')::date,
      (r.last_seen_at at time zone 'America/Los_Angeles')::date,
      r.first_seen_at, r.last_seen_at, r.first_seen_at, r.first_seen_at, 'min',
      'ab_lab', r.ab_event, r.ab_test_id, r.ab_variant_id, true, false
    )
    on conflict (youtube_video_id, field, first_seen_at) where pre_registro do nothing;
    get diagnostics v_n = row_count;
    v_ins := v_ins + v_n;
  end loop;

  return jsonb_build_object('resultado', 'ok', 'inseridas', v_ins, 'ja_existiam', jsonb_array_length(v_rows) - v_ins);
end;
$$;
revoke all on function public.yt_own_versions_seed_pre(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_versions_seed_pre(uuid, uuid, jsonb) to service_role;

-- ── 6. Prova diária (item 200). Só leitura ──────────────────────────────────
-- Vídeo público = último privacy_status conhecido igual a 'public' (C0.11), ainda cadastrado em youtube_videos.
-- (emenda 1: D-m1, D-m2, S-m2) Explica a ausência, POR CAMPO, uma tentativa com outcome diferente de 'ok' desde p_ontem.
-- attempt_day é o dia UTC da execução: as execuções que conferem os dias p_ontem - 1 e p_ontem rodam em p_ontem e p_ontem + 1.
--   título: tentativa 'meta' do vídeo, ou tentativa 'meta' do canal do vídeo (a falha da videos.list fica no canal).
--   thumbnail: tentativa 'thumbnail' do vídeo, ou 'meta' do vídeo (linha que não foi gravada não tem imagem).
create or replace function public.yt_own_versions_prova(p_site_id uuid, p_ontem date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with ult as (
    select distinct on (m.youtube_video_id) m.youtube_video_id, m.privacy_status
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site_id and m.privacy_status is not null
     order by m.youtube_video_id, m.day_pt desc
  ), pub as (
    select distinct u.youtube_video_id, v.channel_id
      from ult u
      join public.youtube_videos v on v.youtube_video_id = u.youtube_video_id
      join public.youtube_channels c on c.id = v.channel_id and c.site_id = p_site_id
     where u.privacy_status = 'public'
  ), f as (
    select p.youtube_video_id,
           not exists (select 1 from public.yt_own_video_versions x
                        where x.site_id = p_site_id and x.youtube_video_id = p.youtube_video_id
                          and x.field = 'title' and x.is_current and x.last_day_pt >= p_ontem - 1) as sem_titulo,
           not exists (select 1 from public.yt_own_video_versions x
                        where x.site_id = p_site_id and x.youtube_video_id = p.youtube_video_id
                          and x.field = 'thumb' and x.is_current and x.last_day_pt >= p_ontem - 1) as sem_thumb,
           exists (select 1 from public.yt_own_collection_attempts a
                    where a.site_id = p_site_id and a.kind = 'meta' and a.outcome <> 'ok'
                      and a.attempt_day >= p_ontem
                      and ((a.scope_type = 'video' and a.scope_id = p.youtube_video_id)
                        or (a.scope_type = 'canal' and a.scope_id = p.channel_id::text))) as motivo_titulo,
           exists (select 1 from public.yt_own_collection_attempts a
                    where a.site_id = p_site_id and a.scope_type = 'video' and a.scope_id = p.youtube_video_id
                      and a.kind in ('meta', 'thumbnail') and a.outcome <> 'ok'
                      and a.attempt_day >= p_ontem) as motivo_thumb
      from pub p
  )
  select jsonb_build_object(
    'publicos', (select count(*) from pub),
    'sem_titulo', (select count(*) from f where f.sem_titulo),
    'sem_thumb', (select count(*) from f where f.sem_thumb),
    'sem_explicacao', (select count(*) from f
                        where (f.sem_titulo and not f.motivo_titulo) or (f.sem_thumb and not f.motivo_thumb)),
    'canais_com_linha_sem_estado', (
      select count(*) from public.youtube_channels c
       where c.site_id = p_site_id
         and exists (select 1 from public.yt_own_video_meta_daily m where m.channel_id = c.id)
         and not exists (select 1 from public.yt_own_versions_state s where s.channel_id = c.id)),
    'derivado_ate', (select min(s.derived_through) from public.yt_own_versions_state s where s.site_id = p_site_id),
    'origem_cms', (select count(*) from public.yt_own_video_versions x where x.site_id = p_site_id and x.origin = 'cms')
  );
$$;
revoke all on function public.yt_own_versions_prova(uuid, date) from public, anon, authenticated;
grant execute on function public.yt_own_versions_prova(uuid, date) to service_role;
