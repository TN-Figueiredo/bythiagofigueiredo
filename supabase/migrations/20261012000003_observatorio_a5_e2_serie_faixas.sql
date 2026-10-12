-- =============================================================================
-- MIGRATION MG2: observatorio_a5_e2_serie_faixas
-- =============================================================================
-- Fase A5 do Observatório, etapa E2 (spec v2.3, arquivo 01, seção 4.3). DEPENDE da MG1 (usa views_hidden,
-- missing_since, live_broadcast_content e as tabelas competitor_field_versions e competitor_raw).
-- O que traz: a faixa de série de cada vídeo (diária ou semanal) e a promoção por 28 dias; as primeiras
-- horas (competitor_video_early); a faixa em vigor NO TEMPO (competitor_video_tier_spans), sem a qual um
-- buraco de dias seria lido como "intervalo semanal"; a troca de faixa atômica (apply_competitor_tier_plan);
-- a prova embutida da série (competitor_series_health); e a contagem de remoção com as duas tabelas novas.
--
-- Idempotência e compatibilidade: como a MG1. competitor_video_daily NÃO muda de forma.
-- Emenda do portão de fim de plano (12/10/2026): competitor_channels.weekly_pass_date (a dívida da passada
-- semanal fica no dado, e o canal em dívida é lido primeiro no disparo seguinte), guarda de site na troca de
-- faixa, a condição a mais em diaria_buracos_3d (estreia agendada não é buraco) e três chaves novas na prova:
-- semanal_devidos_hoje, semanal_atrasados_9d e sem_miniatura_9d.
-- Fecho do portão (12/10/2026, noite): o vídeo que ENTRA na faixa semanal reabre a passada do canal
-- (apply_competitor_tier_plan zera weekly_pass_date), e semanal_devidos_hoje não conta vídeo pedido e não devolvido
-- (miss_streak > 0).

set lock_timeout = '5s';

alter table public.competitor_videos
  add column if not exists series_tier text check (series_tier in ('diaria', 'semanal')),
  add column if not exists series_tier_since date,
  add column if not exists daily_until date;

alter table public.competitor_channels
  add column if not exists weekly_pass_date date;
comment on column public.competitor_channels.weekly_pass_date is 'Dia (São Paulo) da última passada semanal COMPLETA do canal: todo vídeo semanal devido naquele dia foi pedido ao YouTube. Diferente de hoje = há passada a fazer; o mais antigo é lido primeiro. Nulo = nunca.';

create table if not exists public.competitor_video_early (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,
  comments bigint,
  primary key (video_id, taken_at)
);
alter table public.competitor_video_early enable row level security;
drop policy if exists "competitor_video_early_select" on public.competitor_video_early;
create policy "competitor_video_early_select" on public.competitor_video_early
  for select using (public.can_view_site(site_id));

create table if not exists public.competitor_video_tier_spans (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  from_date date not null,
  to_date date,
  tier text not null check (tier in ('diaria', 'semanal')),
  site_id uuid not null references public.sites(id) on delete cascade,
  primary key (video_id, from_date),
  check (to_date is null or to_date >= from_date)
);
create unique index if not exists idx_cvts_one_open
  on public.competitor_video_tier_spans (video_id) where to_date is null;
alter table public.competitor_video_tier_spans enable row level security;
drop policy if exists "competitor_video_tier_spans_select" on public.competitor_video_tier_spans;
create policy "competitor_video_tier_spans_select" on public.competitor_video_tier_spans
  for select using (public.can_view_site(site_id));

-- Troca de faixa de vários vídeos de UM canal, numa transação: fecha a faixa anterior no dia de ontem,
-- abre a nova hoje e grava o estado no vídeo. A 2ª troca do mesmo dia troca a faixa da linha aberta de
-- hoje (sem fechar nem abrir linha): o dia vale pela faixa em que terminou.
-- Se algum vídeo ENTRA em semanal, o canal volta à fila da passada semanal de hoje (weekly_pass_date = null).
--   p_changes: [{"video_id": "<uuid>", "tier": "diaria" | "semanal"}]
create or replace function public.apply_competitor_tier_plan(
  p_site_id uuid, p_channel_id uuid, p_changes jsonb, p_today date
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  r record;
  v_changed integer := 0;
  v_reopen boolean := false;
begin
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'apply_competitor_tier_plan: canal % não é do site %', p_channel_id, p_site_id;
  end if;

  for r in
    select x.video_id, x.tier
      from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as x(video_id uuid, tier text)
      join public.competitor_videos v on v.id = x.video_id and v.competitor_channel_id = p_channel_id
     where v.series_tier is distinct from x.tier
     order by x.video_id
  loop
    update public.competitor_video_tier_spans s
       set tier = r.tier
     where s.video_id = r.video_id and s.from_date = p_today and s.to_date is null;
    if not found then
      update public.competitor_video_tier_spans s
         set to_date = p_today - 1
       where s.video_id = r.video_id and s.to_date is null and s.from_date < p_today;
      insert into public.competitor_video_tier_spans (video_id, from_date, to_date, tier, site_id)
      values (r.video_id, p_today, null, r.tier, p_site_id);
    end if;
    update public.competitor_videos
       set series_tier = r.tier, series_tier_since = p_today
     where id = r.video_id;
    v_changed := v_changed + 1;
    if r.tier = 'semanal' then v_reopen := true; end if;
  end loop;
  -- Um vídeo que ENTRA na faixa semanal reabre a passada semanal do canal: o recibo de hoje (weekly_pass_date) foi dado
  -- sem ele. Sem isto, o canal carimbado antes de ganhar faixas (dia do deploy, canal novo, backfill) só o leria 7 dias depois.
  if v_reopen then
    update public.competitor_channels set weekly_pass_date = null where id = p_channel_id and weekly_pass_date is not null;
  end if;
  return jsonb_build_object('changed', v_changed);
end $$;

-- Prova embutida da série (itens de aceite 13, 15, 23 e 222): o cron lê a cada execução. Só leitura.
-- Ficam FORA de todas as contas: vídeo sem contagem de views (views_hidden), estreia agendada, vídeo
-- ausente (missing_since) e vídeo de canal ausente. 'fora_da_prova' diz quantos são.
-- 'diaria_buracos_3d': só é buraco o dia POSTERIOR a um ponto que já existe (uma estreia agendada ganha faixa
--   diária no dia em que é descoberta e só tem ponto quando estreia: os dias de espera não são perda).
-- 'semanal_devidos_hoje': os vídeos semanais que a passada de hoje tem de ler e ainda não leu. É a regra de
--   weeklyDue (competitor-tiers.ts) escrita em SQL: sem ponto hoje E (hoje é o dia fixo do vídeo, OU o último
--   ponto tem 7 ou 8 dias, OU não há ponto nos últimos 8 dias e a faixa tem 7 dias ou mais). O dia fixo é o
--   mesmo de weekSlotOf: os 4 primeiros bytes do sha256 do id do YouTube, módulo 7, contra o dia desde 1970.
--   Fica de fora o vídeo com miss_streak > 0: foi PEDIDO e não veio (a leitura seguinte decide se ele saiu do ar).
-- 'semanal_atrasados': 8º dia sem ponto (lido hoje, o intervalo de 8 dias ainda vale).
-- 'semanal_atrasados_9d': 9 dias ou mais sem ponto: o intervalo já não é mais "semanal" (perda).
-- 'sem_miniatura_9d': vídeo com faixa há 9 dias ou mais e NENHUMA versão de miniatura guardada (a imagem que
--   a origem sobrescreve: toda leitura, diária ou semanal, confere a miniatura).
create or replace function public.competitor_series_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with hoje as (select (p_now at time zone 'America/Sao_Paulo')::date as d),
  vid as (
    select v.id, v.series_tier, v.series_tier_since, v.miss_streak,
           (('x' || substr(encode(sha256(convert_to(v.video_id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 7) as dia_fixo,
           (coalesce(v.views_hidden, false) or coalesce(v.live_broadcast_content, 'none') = 'upcoming'
            or v.missing_since is not null or c.missing_since is not null) as fora,
           -- o canal já foi lido pelo código da E2 e terminou uma sincronização boa nas últimas 24 h
           (c.last_seen_at is not null and c.last_ok_synced_at > p_now - interval '1 day') as canal_em_dia
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site_id
  )
  select jsonb_build_object(
    'hoje', (select d from hoje),
    'hora_sp', extract(hour from p_now at time zone 'America/Sao_Paulo')::int,
    'fora_da_prova', (select count(*) from vid where fora),
    'sem_faixa', (
      select count(*) from vid
       where not fora and (
         (series_tier is null and canal_em_dia)
         or (series_tier is not null and not exists (
           select 1 from public.competitor_video_tier_spans s
            where s.video_id = vid.id and s.to_date is null and s.tier = vid.series_tier)))),
    'diaria_sem_ponto_hoje', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'diaria'
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = hoje.d)),
    'diaria_buracos_3d', (
      select count(*) from vid, hoje, generate_series(1, 3) g
        join lateral (select (hoje.d - g)::date as dia) x on true
       where not fora
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.tier = 'diaria'
                        and s.from_date <= x.dia and (s.to_date is null or s.to_date >= x.dia))
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = x.dia)
         and exists (select 1 from public.competitor_video_daily d0 where d0.video_id = vid.id and d0.snap_date < x.dia)),
    'semanal_atrasados', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal'
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.to_date is null and s.tier = 'semanal' and s.from_date <= hoje.d - 8)
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date > hoje.d - 8)),
    'semanal_atrasados_9d', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal'
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.to_date is null and s.tier = 'semanal' and s.from_date <= hoje.d - 9)
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date > hoje.d - 9)),
    'semanal_devidos_hoje', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal' and miss_streak = 0
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = hoje.d)
         and (
           vid.dia_fixo = ((hoje.d - date '1970-01-01') % 7)
           or (not exists (select 1 from public.competitor_video_daily d
                            where d.video_id = vid.id and d.snap_date > hoje.d - 7)
               and (exists (select 1 from public.competitor_video_daily d
                             where d.video_id = vid.id and d.snap_date between hoje.d - 8 and hoje.d - 7)
                    or vid.series_tier_since <= hoje.d - 7)))),
    'sem_miniatura_9d', (
      select count(*) from vid, hoje
       where not fora
         and exists (select 1 from public.competitor_video_tier_spans s where s.video_id = vid.id and s.from_date <= hoje.d - 9)
         and not exists (select 1 from public.competitor_video_versions x where x.video_id = vid.id and x.field = 'thumb')),
    'diaria_total', (select count(*) from vid where not fora and series_tier = 'diaria'),
    'semanal_total', (select count(*) from vid where not fora and series_tier = 'semanal')
  );
$$;

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
    'raw', (select count(*) from public.competitor_raw r where r.competitor_channel_id = p_channel_id),
    'early', (select count(*) from public.competitor_video_early e
              join public.competitor_videos v on v.id = e.video_id where v.competitor_channel_id = p_channel_id),
    'tier_spans', (select count(*) from public.competitor_video_tier_spans s
                   join public.competitor_videos v on v.id = s.video_id where v.competitor_channel_id = p_channel_id)
  );
end $$;

revoke all on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) from public, anon, authenticated;
revoke all on function public.competitor_series_health(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) to service_role;
grant execute on function public.competitor_series_health(uuid, timestamptz) to service_role;
grant execute on function public.competitor_channel_removal_impact(uuid, uuid) to service_role;

reset lock_timeout;
