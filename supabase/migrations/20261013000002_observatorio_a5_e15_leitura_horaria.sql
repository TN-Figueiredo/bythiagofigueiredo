-- Observatório A5, E15 parte 1 (MG9): leitura horária dos contadores públicos.
-- Sete tabelas novas (três dos concorrentes, quatro do canal do dono), a prova da leitura horária e três funções
-- recriadas: as duas de "o que a remoção apagaria" e a prova da captura (uma linha). Só acrescenta; as recriadas mantêm
-- a assinatura e todas as chaves que já devolviam. O canal do dono NÃO entra em competitor_* (spec 4.7.1, v2.3).
-- Depende da MG2 (competitor_video_early), da MG2b (20261012000004: o texto de competitor_capture_health) e da L1b
-- (yt_own_video_meta_daily.privacy_status e captured_at).
set lock_timeout = '5s';

-- 1. Leituras cruas dos concorrentes (guardadas; nada nesta fase as apaga)
create table if not exists public.competitor_video_hourly (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  hour_slot timestamptz not null,           -- a hora cheia de taken_at: duas execuções na mesma hora não duplicam
  taken_at timestamptz not null,            -- instante real da leitura
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,                             -- nulo = oculto ou não veio
  comments bigint,                          -- nulo = desligado ou não veio
  primary key (video_id, hour_slot),
  check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC')
);
create index if not exists idx_cvh_slot on public.competitor_video_hourly (hour_slot);

-- 2. Mapa de horas: 4 linhas por canal e mês (formato × fase). Fica vazio até a soma (parte 2).
create table if not exists public.competitor_channel_hour_map (
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  month date not null,                      -- 1º dia do mês, data de São Paulo
  format text not null check (format in ('longo', 'short')),
  phase text not null check (phase in ('lancamento', 'depois')),   -- idade até 72 h | do dia 4 ao 14
  site_id uuid not null references public.sites(id) on delete cascade,
  -- vetores de 168 posições; posição = (dia da semana, 0 = domingo) × 24 + hora de São Paulo, + 1
  views_sum bigint[] not null,              -- soma das diferenças POSITIVAS de intervalos limpos
  likes_sum integer[] not null,
  comments_sum integer[] not null,
  views_share real[] not null,              -- soma das fatias (diferença da hora ÷ diferença do dia do mesmo vídeo)
  likes_share real[] not null,
  comments_share real[] not null,
  n_intervals integer[] not null,           -- intervalos limpos de 1 hora que caíram na casa (0 = não medido naquela hora)
  video_days_views integer not null default 0,     -- dias de vídeo completos que entraram na fatia, por contador
  video_days_likes integer not null default 0,
  video_days_comments integer not null default 0,
  videos integer not null default 0,               -- vídeos distintos que contribuíram no mês
  long_intervals integer not null default 0,       -- intervalos que não são limpos (buraco): ficam FORA das casas
  long_views bigint not null default 0,
  long_likes bigint not null default 0,
  long_comments bigint not null default 0,
  neg_views_n integer not null default 0,          -- leituras em que o contador DIMINUIU, e de quanto (soma negativa)
  neg_views_sum bigint not null default 0,
  neg_likes_n integer not null default 0,
  neg_likes_sum bigint not null default 0,
  neg_comments_n integer not null default 0,
  neg_comments_sum bigint not null default 0,
  updated_at timestamptz not null default now(),
  rule_version smallint not null default 1,        -- versão da regra com que a linha foi somada; um mês tem uma versão só,
  primary key (competitor_channel_id, month, format, phase),
  check (cardinality(views_sum) = 168 and cardinality(likes_sum) = 168 and cardinality(comments_sum) = 168
     and cardinality(views_share) = 168 and cardinality(likes_share) = 168 and cardinality(comments_share) = 168
     and cardinality(n_intervals) = 168)
);

-- 3. Registro do que já foi somado (é o que torna a soma idempotente). Fica vazio até a soma (parte 2).
create table if not exists public.competitor_hour_fold_log (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  day date not null,                        -- dia de São Paulo já somado no mapa
  site_id uuid not null references public.sites(id) on delete cascade,
  intervals_clean smallint not null,
  intervals_long smallint not null,
  folded_at timestamptz not null default now(),
  primary key (video_id, day)
);

alter table public.competitor_video_hourly enable row level security;
alter table public.competitor_channel_hour_map enable row level security;
alter table public.competitor_hour_fold_log enable row level security;
drop policy if exists "competitor_video_hourly_select" on public.competitor_video_hourly;
create policy "competitor_video_hourly_select" on public.competitor_video_hourly for select using (public.can_view_site(site_id));
drop policy if exists "competitor_channel_hour_map_select" on public.competitor_channel_hour_map;
create policy "competitor_channel_hour_map_select" on public.competitor_channel_hour_map for select using (public.can_view_site(site_id));
drop policy if exists "competitor_hour_fold_log_select" on public.competitor_hour_fold_log;
create policy "competitor_hour_fold_log_select" on public.competitor_hour_fold_log for select using (public.can_view_site(site_id));

-- 4. O canal do dono: quatro tabelas com a mesma forma, chaveadas pelo id de 11 caracteres do YouTube.
--    Só contadores PÚBLICOS de vídeos PÚBLICOS: leitura por can_view_site, fora da lista de tabelas privadas.
create table if not exists public.yt_own_public_video_hourly (
  youtube_video_id text not null,
  hour_slot timestamptz not null,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint not null,
  likes bigint,
  comments bigint,
  primary key (youtube_video_id, hour_slot),
  check (hour_slot = date_trunc('hour', taken_at at time zone 'UTC') at time zone 'UTC')
);
create index if not exists idx_yopvh_slot on public.yt_own_public_video_hourly (hour_slot);
create index if not exists idx_yopvh_channel on public.yt_own_public_video_hourly (channel_id);

create table if not exists public.yt_own_public_video_early (
  youtube_video_id text not null,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint not null,
  likes bigint,
  comments bigint,
  primary key (youtube_video_id, taken_at)
);
create index if not exists idx_yopve_channel on public.yt_own_public_video_early (channel_id);

create table if not exists public.yt_own_public_hour_map (
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  month date not null,
  format text not null check (format in ('longo', 'short')),
  phase text not null check (phase in ('lancamento', 'depois')),
  site_id uuid not null references public.sites(id) on delete cascade,
  -- vetores de 168 posições; posição = (dia da semana, 0 = domingo) × 24 + hora de São Paulo, + 1
  views_sum bigint[] not null,              -- soma das diferenças POSITIVAS de intervalos limpos
  likes_sum integer[] not null,
  comments_sum integer[] not null,
  views_share real[] not null,              -- soma das fatias (diferença da hora ÷ diferença do dia do mesmo vídeo)
  likes_share real[] not null,
  comments_share real[] not null,
  n_intervals integer[] not null,           -- intervalos limpos de 1 hora que caíram na casa (0 = não medido naquela hora)
  video_days_views integer not null default 0,     -- dias de vídeo completos que entraram na fatia, por contador
  video_days_likes integer not null default 0,
  video_days_comments integer not null default 0,
  videos integer not null default 0,               -- vídeos distintos que contribuíram no mês
  long_intervals integer not null default 0,       -- intervalos que não são limpos (buraco): ficam FORA das casas
  long_views bigint not null default 0,
  long_likes bigint not null default 0,
  long_comments bigint not null default 0,
  neg_views_n integer not null default 0,          -- leituras em que o contador DIMINUIU, e de quanto (soma negativa)
  neg_views_sum bigint not null default 0,
  neg_likes_n integer not null default 0,
  neg_likes_sum bigint not null default 0,
  neg_comments_n integer not null default 0,
  neg_comments_sum bigint not null default 0,
  updated_at timestamptz not null default now(),
  rule_version smallint not null default 1,        -- versão da regra com que a linha foi somada; um mês tem uma versão só,
  primary key (channel_id, month, format, phase),
  check (cardinality(views_sum) = 168 and cardinality(likes_sum) = 168 and cardinality(comments_sum) = 168
     and cardinality(views_share) = 168 and cardinality(likes_share) = 168 and cardinality(comments_share) = 168
     and cardinality(n_intervals) = 168)
);

create table if not exists public.yt_own_public_hour_fold_log (
  youtube_video_id text not null,
  day date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  intervals_clean smallint not null,
  intervals_long smallint not null,
  folded_at timestamptz not null default now(),
  primary key (youtube_video_id, day)
);
create index if not exists idx_yophfl_channel on public.yt_own_public_hour_fold_log (channel_id);

alter table public.yt_own_public_video_hourly enable row level security;
alter table public.yt_own_public_video_early enable row level security;
alter table public.yt_own_public_hour_map enable row level security;
alter table public.yt_own_public_hour_fold_log enable row level security;
drop policy if exists "yt_own_public_video_hourly_select" on public.yt_own_public_video_hourly;
create policy "yt_own_public_video_hourly_select" on public.yt_own_public_video_hourly for select using (public.can_view_site(site_id));
drop policy if exists "yt_own_public_video_early_select" on public.yt_own_public_video_early;
create policy "yt_own_public_video_early_select" on public.yt_own_public_video_early for select using (public.can_view_site(site_id));
drop policy if exists "yt_own_public_hour_map_select" on public.yt_own_public_hour_map;
create policy "yt_own_public_hour_map_select" on public.yt_own_public_hour_map for select using (public.can_view_site(site_id));
drop policy if exists "yt_own_public_hour_fold_log_select" on public.yt_own_public_hour_fold_log;
create policy "yt_own_public_hour_fold_log_select" on public.yt_own_public_hour_fold_log for select using (public.can_view_site(site_id));
-- Nenhuma policy de escrita em nenhuma das sete: só service role.

-- 5. A prova da leitura horária (item 128 e a gêmea do canal do dono). Lida pelo fecho de CADA disparo, por site.
--    (emenda do portão: R5) recebe o site; STRICT: com qualquer parâmetro nulo devolve NULO, que o leitor trata como
--    "não foi possível ler a prova" (vermelho), nunca como "nada a cobrar".
--    A lista de vídeos cobrados repete a regra do código (RULES.hourly.ageDays e RULES.hourly.videosMax vêm por parâmetro;
--    a ordem do teto é published_at desc, id), e deixa de fora o que não pode ter 22 leituras em 24 horas sem que seja
--    falha da coleta: vídeo conhecido há menos de 25 horas, vídeo que faltou em alguma leitura do sync (miss_streak), sem
--    contagem, estreia, ao vivo e ao vivo que acabou há menos de 25 horas.
--    (emenda do portão: D-I5) UMA janela para todas as contas: hour_slot em (p_now − 24 h, p_now].
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

-- 6. O que a remoção de um canal de concorrente apagaria: as mesmas chaves de antes e mais três.
create or replace function public.competitor_channel_removal_impact(p_site_id uuid, p_channel_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    'raw', (select count(*) from public.competitor_raw r where r.competitor_channel_id = p_channel_id),
    'early', (select count(*) from public.competitor_video_early e
              join public.competitor_videos v on v.id = e.video_id where v.competitor_channel_id = p_channel_id),
    'tier_spans', (select count(*) from public.competitor_video_tier_spans s
                   join public.competitor_videos v on v.id = s.video_id where v.competitor_channel_id = p_channel_id),
    'hourly', (select count(*) from public.competitor_video_hourly h
               join public.competitor_videos v on v.id = h.video_id where v.competitor_channel_id = p_channel_id),
    'hour_map', (select count(*) from public.competitor_channel_hour_map m where m.competitor_channel_id = p_channel_id),
    'hour_fold_log', (select count(*) from public.competitor_hour_fold_log f
                      join public.competitor_videos v on v.id = f.video_id where v.competitor_channel_id = p_channel_id)
  );
end $$;
revoke all on function public.competitor_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.competitor_channel_removal_impact(uuid, uuid) to service_role;

-- 7. O que a remoção de um canal próprio apagaria. (emenda do portão: S-I5, R1) UM corpo só para todas as migrations
--    da A5 que precisam que a função conheça tabelas novas: o POR CATÁLOGO, texto idêntico ao da MG14 (plano das ordens 8
--    e 10, que é o dono do texto). serie_coletada soma toda tabela de public com FK "on delete restrict" para
--    youtube_channels: as quatro yt_own_public_* entram sozinhas, e nenhuma ordem de aplicação apaga tabela de outra etapa.
--    NÃO EDITAR este bloco aqui: se o texto da MG14 mudar, copiar de novo (o fecho confere a igualdade byte a byte).
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
  v_serie bigint := 0;
  v_n bigint;
  v_t record;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- linhas da coleta que apontam para o canal (o bruto vai junto com o relatório, por cascata)
  for v_t in
    select k.conrelid::regclass::text as tabela, a.attname::text as coluna
      from pg_catalog.pg_constraint k
      join pg_catalog.pg_class r on r.oid = k.conrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass
       and k.confdeltype = 'r' and n.nspname = 'public' and cardinality(k.conkey) = 1
     order by 1
  loop
    execute format('select count(*) from %s t where t.%I = $1', v_t.tabela, v_t.coluna) into v_n using p_channel_id;
    v_serie := v_serie + v_n;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'slug', v_slug,
    'videos', (select count(*) from public.youtube_videos v where v.channel_id = p_channel_id),
    'comments', (select count(*) from public.youtube_curated_comments cc
                 join public.youtube_videos v on v.id = cc.video_id where v.channel_id = p_channel_id),
    'sync_logs', (select count(*) from public.youtube_sync_log l where l.channel_id = p_channel_id),
    'ab_tests', (select count(*) from public.ab_tests t
                 join public.youtube_videos v on v.id = t.youtube_video_id
                 where v.channel_id = p_channel_id and t.status not in ('active', 'paused', 'queued', 'draft')),
    'ab_drafts', (select count(*) from public.ab_tests t
                  join public.youtube_videos v on v.id = t.youtube_video_id
                  where v.channel_id = p_channel_id and t.status = 'draft'),
    'analyses', (select count(*) from public.youtube_intelligence i
                 where i.channel_id = p_channel_id
                    or i.video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'tasks', (select count(*) from public.youtube_intelligence_tasks k where k.channel_id = p_channel_id),
    'notes', (select count(*) from public.youtube_notes n where n.channel_id = p_channel_id),
    'notifications', (select count(*) from public.yt_notifications nt
                      where nt.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)
                         or nt.ab_test_id in (select t.id from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
                                              where v.channel_id = p_channel_id)
                         or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc
                                                         join public.youtube_videos v on v.id = oc.youtube_video_id
                                                         where v.channel_id = p_channel_id)),
    'connections', (select count(*) from public.social_connections sc
                    where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null),
    'pipeline_links', (select count(*) from public.content_pipeline p
                       where p.youtube_channel_id = p_channel_id
                          or p.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'serie_coletada', v_serie,
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;

-- 8. (emenda do portão: S-I2) A prova da captura (MG2b, 20261012000004), recriada com UMA linha diferente: cota_dia_pacifico
--    passa a ser a cota da sincronização dos canais, não o total do dia. Mesma assinatura, mesmas chaves, mesmas permissões.
create or replace function public.competitor_capture_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with e1 as (
    select coalesce(
      (select min(r.first_seen_at) from public.competitor_raw r where r.site_id = p_site_id),
      (select min(z.t) from (
         select min(f.first_seen_at) as t from public.competitor_field_versions f where f.site_id = p_site_id
         union all
         select (min(s.from_date))::timestamp at time zone 'America/Sao_Paulo'
           from public.competitor_video_tier_spans s where s.site_id = p_site_id
         union all
         select (min(q.date))::timestamp at time zone 'America/Los_Angeles'
           from public.youtube_quota_usage q where q.site_id = p_site_id
       ) z)
    ) as desde
  ),
  ch as (
    select c.id, c.last_ok_synced_at, c.last_seen_at, c.missing_since, c.sync_status, c.sync_error_since,
           -- coalesce: canal em erro sem sync_error_since (não deveria existir) daria NULO e sairia das contas em silêncio
           coalesce(c.sync_status = 'error' and c.missing_since is null
                    and c.sync_error_since < p_now - interval '3 days', false) as erro_3d
      from public.competitor_channels c
     where c.site_id = p_site_id
  )
  select jsonb_build_object(
    'videos_vistos_sem_raw', (
      select count(*) from public.competitor_videos v
        join ch on ch.id = v.competitor_channel_id
        cross join e1
       where e1.desde is not null and not ch.erro_3d
         and v.last_checked_at > greatest(p_now - interval '1 day', e1.desde)
         and not exists (select 1 from public.competitor_raw r where r.video_id = v.id and r.is_current)),
    'canais_vistos_sem_raw', (
      select count(*) from ch cross join e1
       where e1.desde is not null and not ch.erro_3d
         and ch.last_ok_synced_at > greatest(p_now - interval '1 day', e1.desde)
         and not exists (select 1 from public.competitor_raw r
                          where r.competitor_channel_id = ch.id and r.video_id is null and r.is_current)),
    'canais_vistos_dia_pacifico', (
      select count(*) from ch
       where ch.last_seen_at >= ((p_now at time zone 'America/Los_Angeles')::date)::timestamp at time zone 'America/Los_Angeles'),
    'cota_dia_pacifico', (
      -- (MG9; emenda do portão: S-I2) só a parcela da SINCRONIZAÇÃO (modo 'competitors'): a leitura horária soma na mesma
      -- linha do dia, e com units_used o alarme "cota do dia não registrada" nunca mais dispararia
      select coalesce(max(case when jsonb_typeof(q.operations -> 'competitors') = 'number'
                               then (q.operations ->> 'competitors')::numeric else 0 end), 0)
        from public.youtube_quota_usage q
       where q.site_id = p_site_id and q.date = (p_now at time zone 'America/Los_Angeles')::date),
    'videos_ausentes', (
      select count(*) from public.competitor_videos v
        join ch on ch.id = v.competitor_channel_id
       where v.missing_since is not null),
    'canais_ausentes', (select count(*) from ch where ch.missing_since is not null),
    'canais_em_erro_12h', (
      select count(*) from ch
       where ch.sync_status = 'error' and ch.missing_since is null
         and ch.sync_error_since < p_now - interval '12 hours'),
    'canais_em_erro_3d', (select count(*) from ch where ch.erro_3d),
    -- todos os canais do site (ausentes inclusive): quem lê pode dizer "N de M em erro" e não tratar como
    -- "problema do canal" o que é de todos (chave nova; o leitor de hoje a ignora)
    'canais_total', (select count(*) from ch)
  );
$$;
revoke all on function public.competitor_capture_health(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.competitor_capture_health(uuid, timestamptz) to service_role;

reset lock_timeout;
