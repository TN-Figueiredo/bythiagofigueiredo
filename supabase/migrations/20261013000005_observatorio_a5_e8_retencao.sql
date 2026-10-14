-- =============================================================================
-- MIGRATION: Observatório A5, E8 (curva de retenção do vídeo próprio) (MG5 do spec)
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.2
-- Aditiva. Roda duas vezes sem erro. Depende de <MG14> (yt_own_video_coverage e o check de kind):
-- sem ela, a função do item 2 não é criada e a migration para com erro, sem deixar nada pela metade.
--
-- O que faz:
--   1. yt_own_video_retention: uma linha por vídeo, janela, segmento e fim da janela (o histórico da curva).
--   2. yt_own_retention_facts: os fatos de cada vídeo de um canal que o passo "retenção" usa para decidir o que ler.
-- Convive com o código que está em main: ele não lê nem grava nada disto.
-- youtube_channel_removal_impact NÃO é recriada: desde a MG14 ela soma toda tabela presa ao canal por FK "restrict".
-- =============================================================================
set lock_timeout = '5s';

-- ── 1. A curva ──────────────────────────────────────────────────────────────
create table if not exists public.yt_own_video_retention (
  youtube_video_id text not null,           -- id de 11 caracteres (NÃO o uuid), como nas outras yt_own_*
  window_kind text not null check (window_kind in ('vida', 'primeiros_7_dias', 'primeiros_30_dias')),
  segment text not null default 'organico' check (segment in ('organico')),   -- audienceType==ORGANIC
  window_end date not null,                 -- último dia (dia do YouTube) que a leitura cobre
  window_start date not null,               -- o dia da publicação
  requested_end date not null,              -- o fim PEDIDO à API (window_end <= requested_end)
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  points jsonb not null,                    -- lista ordenada por t: {t, ratio, relative, segment_impressions}
                                            --   t = fração do vídeo (0,01 a 1,00); ratio = fração da audiência (PODE passar de 1)
                                            --   relative = relativeRetentionPerformance (0 a 1); campo que não veio fica nulo, nunca 0
  point_count integer not null check (point_count > 0),   -- pontos que VIERAM (pode ser menos de 100)
  metrics_returned text[] not null,         -- as métricas que a API devolveu nesta leitura
  views_at_read bigint,                     -- views do diário na leitura (vida: a vida inteira; janelas: as da janela); nulo = não se sabia
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,             -- catálogo no código (METRIC_VERSIONS), sem check aqui
  primary key (youtube_video_id, window_kind, segment, window_end),
  check (window_end >= window_start),
  check (requested_end >= window_end),
  check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) = point_count),
  check (cardinality(metrics_returned) > 0),
  check (metric_version <> '')
);
create index if not exists idx_yt_own_video_retention_channel
  on public.yt_own_video_retention (channel_id, window_end);

alter table public.yt_own_video_retention enable row level security;
do $$
declare v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                          then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
begin
  execute 'drop policy if exists "yt_own_video_retention_select" on public.yt_own_video_retention';
  execute format('create policy "yt_own_video_retention_select" on public.yt_own_video_retention for select using (%s)', v_fn);
end $$;
-- Nenhuma policy de escrita: insert, update e delete só por service role.

-- ── 2. Fatos por vídeo, para o passo decidir ────────────────────────────────
-- Devolve UMA lista jsonb (não um conjunto de linhas): o limite de 1.000 linhas do PostgREST não corta nada.
-- A função só entrega fatos; a regra (quem vence, quem espera) é código, testado sem banco.
--   views_total: soma de views do diário; NULO quando o vídeo nunca teve diário (nem linha, nem cobertura). Nunca 0 por ausência.
--   fonte_ate: último dia que a Analytics API devolveu no diário deste vídeo: o maior entre a cobertura 'base' e a
--              última linha gravada (vale antes e depois de a coleta nova do diário entrar); nulo = nunca.
--   *_tent_*: a última tentativa (qualquer resultado); *_resposta_dia: a última com resposta da API ('ok' ou 'sem_dado_na_janela').
--   primeira_tent_dia: a tentativa de retenção mais antiga do vídeo (qualquer janela, qualquer resultado); nulo = nunca.
--   leva_ancora_dia: o dia (UTC) da PRIMEIRA execução do passo "retenção" neste canal (a tentativa de escopo 'canal',
--              kind 'retencao_vida', mais antiga; o passo grava uma por execução, com qualquer resultado). Igual em todo
--              item do canal; nulo = o passo nunca rodou. É a âncora de "a primeira leva já acabou".
--   diario_tent_dia / diario_tent_resultado: a última tentativa do DIÁRIO deste vídeo (qualquer resultado).
--   diario_falhas_4d: em quantos dos 4 últimos dias UTC (p_hoje_utc e os 3 anteriores) a tentativa do diário deste vídeo
--              terminou com O YOUTUBE NÃO DEVOLVENDO O VÍDEO: 'sem_dado_na_janela', ou 'erro_http' com http_status 403, 404 ou 410
--              que não seja de cota (error sem 'quotaExceeded' nem 'LimitExceeded'). Falha NOSSA não conta: 'erro_de_banco',
--              'forma_inesperada', 'excecao', erro sem status, 500, 429 e 403 de cota. 4 = quatro dias seguidos em que o
--              YouTube não devolveu o vídeo. (emenda 2 do portão: N1)
-- p_hoje_utc: o dia UTC de quem chama (o código passa o seu relógio; nulo = current_date). Parâmetro para o teste
--              não depender do relógio do banco.
create or replace function public.yt_own_retention_facts(p_channel_id uuid, p_hoje_utc date default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(f) order by f.youtube_video_id), '[]'::jsonb)
  from (
    select v.youtube_video_id,
           v.id as video_id,
           v.site_id,
           v.duration_seconds,
           (v.published_at at time zone 'America/Los_Angeles')::date as publicado_dia_pt,
           fonte.ate as fonte_ate,
           case when fonte.ate is null then null else coalesce(d.views_total, 0) end as views_total,
           d.ultimo_dia_com_view,
           case when fonte.ate >= pub.dia + 6  then coalesce(d.views_7d, 0)  end as views_7d,
           case when fonte.ate >= pub.dia + 29 then coalesce(d.views_30d, 0) end as views_30d,
           r.vida_window_end, r.vida_collected_at, r.vida_views_at_read,
           coalesce(r.tem_7d, false) as tem_7d,
           coalesce(r.tem_30d, false) as tem_30d,
           a.primeira_tent_dia,
           leva.ancora_dia as leva_ancora_dia,
           dia.tent_dia as diario_tent_dia, dia.tent_resultado as diario_tent_resultado,
           coalesce(dia.falhas_4d, 0) as diario_falhas_4d,
           a.vida_tent_dia, a.vida_tent_resultado, a.vida_resposta_dia,
           a.d7_tent_dia, a.d7_tent_resultado, a.d7_resposta_dia,
           a.d30_tent_dia, a.d30_tent_resultado, a.d30_resposta_dia
      from public.youtube_videos v
      cross join lateral (select (v.published_at at time zone 'America/Los_Angeles')::date as dia) pub
      left join lateral (
        select max(c.covered_to) as coberto_ate
          from public.yt_own_video_coverage c
         where c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base'
      ) cov on true
      left join lateral (
        select max(x.day_pt) filter (where x.views is not null) as ultimo_dia_gravado,
               sum(x.views) as views_total,
               max(x.day_pt) filter (where x.views > 0) as ultimo_dia_com_view,
               sum(x.views) filter (where x.day_pt between pub.dia and pub.dia + 6) as views_7d,
               sum(x.views) filter (where x.day_pt between pub.dia and pub.dia + 29) as views_30d
          from public.yt_own_video_daily x
         where x.youtube_video_id = v.youtube_video_id
      ) d on true
      cross join lateral (
        select nullif(greatest(coalesce(cov.coberto_ate, '-infinity'::date), coalesce(d.ultimo_dia_gravado, '-infinity'::date)), '-infinity'::date) as ate
      ) fonte
      left join lateral (
        select max(t.window_end) filter (where t.window_kind = 'vida') as vida_window_end,
               (array_agg(t.collected_at order by t.window_end desc) filter (where t.window_kind = 'vida'))[1] as vida_collected_at,
               (array_agg(t.views_at_read order by t.window_end desc) filter (where t.window_kind = 'vida'))[1] as vida_views_at_read,
               bool_or(t.window_kind = 'primeiros_7_dias') as tem_7d,
               bool_or(t.window_kind = 'primeiros_30_dias') as tem_30d
          from public.yt_own_video_retention t
         where t.youtube_video_id = v.youtube_video_id and t.segment = 'organico'
      ) r on true
      left join lateral (
        select min(t.attempt_day) as primeira_tent_dia,
               max(t.attempt_day) filter (where t.kind = 'retencao_vida') as vida_tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc) filter (where t.kind = 'retencao_vida'))[1] as vida_tent_resultado,
               max(t.attempt_day) filter (where t.kind = 'retencao_vida' and t.outcome in ('ok', 'sem_dado_na_janela')) as vida_resposta_dia,
               max(t.attempt_day) filter (where t.kind = 'retencao_7d') as d7_tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc) filter (where t.kind = 'retencao_7d'))[1] as d7_tent_resultado,
               max(t.attempt_day) filter (where t.kind = 'retencao_7d' and t.outcome in ('ok', 'sem_dado_na_janela')) as d7_resposta_dia,
               max(t.attempt_day) filter (where t.kind = 'retencao_30d') as d30_tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc) filter (where t.kind = 'retencao_30d'))[1] as d30_tent_resultado,
               max(t.attempt_day) filter (where t.kind = 'retencao_30d' and t.outcome in ('ok', 'sem_dado_na_janela')) as d30_resposta_dia
          from public.yt_own_collection_attempts t
         where t.scope_type = 'video' and t.scope_id = v.youtube_video_id
           and t.kind in ('retencao_vida', 'retencao_7d', 'retencao_30d')
      ) a on true
      left join lateral (
        select max(t.attempt_day) as tent_dia,
               (array_agg(t.outcome order by t.attempt_day desc))[1] as tent_resultado,
               count(*) filter (where (t.outcome = 'sem_dado_na_janela'
                                       or (t.outcome = 'erro_http' and t.http_status in (403, 404, 410)
                                           and coalesce(t.error, '') !~ '(quota|Limit)Exceeded'))
                                  and t.attempt_day between coalesce(p_hoje_utc, current_date) - 3
                                                        and coalesce(p_hoje_utc, current_date)) as falhas_4d
          from public.yt_own_collection_attempts t
         where t.scope_type = 'video' and t.scope_id = v.youtube_video_id and t.kind = 'diario'
      ) dia on true
      cross join (
        select min(t.attempt_day) as ancora_dia
          from public.yt_own_collection_attempts t
         where t.scope_type = 'canal' and t.scope_id = p_channel_id::text and t.kind = 'retencao_vida'
      ) leva
     where v.channel_id = p_channel_id and v.published_at is not null
  ) f
$$;

revoke all on function public.yt_own_retention_facts(uuid, date) from public, anon, authenticated;
grant execute on function public.yt_own_retention_facts(uuid, date) to service_role;
