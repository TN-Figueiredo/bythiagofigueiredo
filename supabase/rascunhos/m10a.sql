-- M10a (fase de manutenção, emenda de 14/10): o vídeo antigo, o que não depende de ninguém.
-- Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §10.8; 05 §15.1 (M10a) e §17 (pedido 15); 06 §18, itens 135, 138 e 139.
-- Com ZERO vídeo marcado nada disto muda dado nem saída, salvo chaves novas que valem 0:
--   competitor_series_health.arquivados; competitor_channel_removal_impact.videos_leitura_mensal e .videos_no_arquivo;
--   apply_competitor_tier_plan.ignorados_congelados.
-- Ordem dura (02 §10.8, passos 1 e 2): esta migration ANTES do código que lê as colunas.
-- Depende só de ordem da M2 (arquivo posterior e push separado, depois da M2 conferida); não usa objeto dela.
-- Idempotente: add column/create table if not exists, create or replace function, drop trigger if exists.
-- Guardas no TOPO (antes de qualquer escrita): corpo instalado das 4 funções redefinidas = o das migrations (antes) ou o desta (depois),
-- E10 aplicada, índice da E9 presente. Qualquer divergência recusa com M10a:<causa> e nada é escrito.
set lock_timeout = '3s';

-- 0. Guardas (padrão da M2, bloco 11). md5 do prosrc medido no bythiago_int depois da última migration que define cada função.
do $$
declare
  v_src text;
  r record;
begin
  if pg_catalog.to_regprocedure('public.competitor_channel_pause_covers(uuid,timestamptz,interval)') is null then
    raise exception 'M10a: a E10 (competitor_channel_pause_covers) tem de estar aplicada antes da M10a' using errcode = 'P0001';
  end if;
  if not exists (select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'idx_competitor_readings_video'
                    and indexdef like '%(video_id)%') then
    raise exception 'M10a: falta o índice de competitor_readings por vídeo (E9)' using errcode = 'P0001';
  end if;
  for r in
    select * from (values
      ('apply_competitor_tier_plan', 'public.apply_competitor_tier_plan(uuid,uuid,jsonb,date)', '033d6a127e15d03a9252e4384c876a8a', '17e38443c61dea6524e8635de4fd0bda'),
      ('competitor_series_health', 'public.competitor_series_health(uuid,timestamptz)', '6b8bc09657c93975e382c9f710c7357f', '943e486602c5ec4e29b13e2d312f998e'),
      ('competitor_channel_removal_impact', 'public.competitor_channel_removal_impact(uuid,uuid)', '0f3cbc176f87d6305af10ccc7977fcb0', '171c49ae4ae11e10df37098848a8c308'),
      ('pin_competitor_video', 'public.pin_competitor_video(uuid,uuid,uuid,integer)', 'a74262cea77beeced46749e1dad3d127', null),
      ('pin_competitor_video', 'public.pin_competitor_video(uuid,uuid,uuid,integer,boolean)', null, 'bbfa7ba64cc8130faeb8280c38f178c0')
    ) as t(nome, assinatura, md5_antes, md5_depois)
  loop
    select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure(r.assinatura);
    if v_src is null then
      if r.nome = 'pin_competitor_video' then
        continue; -- a pin tem duas assinaturas possíveis; a ausência de ambas é conferida abaixo
      end if;
      raise exception 'M10a:%_ausente', r.nome using errcode = 'P0001'; -- Phil R-1: as outras 3 têm de existir
    end if;
    if pg_catalog.md5(v_src) is distinct from r.md5_antes and pg_catalog.md5(v_src) is distinct from r.md5_depois then
      raise exception 'M10a:%_divergente', r.nome using errcode = 'P0001',
        detail = 'o corpo instalado não é o das migrations nem o da M10a (md5 ' || pg_catalog.md5(v_src) || '): conferir antes de sobrescrever';
    end if;
  end loop;
  if pg_catalog.to_regprocedure('public.pin_competitor_video(uuid,uuid,uuid,integer)') is null
     and pg_catalog.to_regprocedure('public.pin_competitor_video(uuid,uuid,uuid,integer,boolean)') is null then
    raise exception 'M10a:pin_competitor_video_ausente' using errcode = 'P0001';
  end if;
end $$;

-- 1. O toco (02 §10.8, "O toco e os três estados"). Contagem nula fica nula ("não medido"), nunca zero.
alter table public.competitor_videos
  add column if not exists archive_frozen_at timestamptz,
  add column if not exists archive_dropped_at timestamptz,
  add column if not exists archive_view_count bigint,
  add column if not exists archive_like_count bigint,
  add column if not exists archive_comment_count bigint,
  add column if not exists archive_stats_at timestamptz;
comment on column public.competitor_videos.archive_frozen_at is 'M10a: quando o vídeo passou à leitura mensal (estágio 1). Só volta a nulo (descongelar) antes da retirada. Nulo = ativo.';
comment on column public.competitor_videos.archive_dropped_at is 'M10a: quando as linhas do vídeo nas 8 tabelas da classe video_antigo saíram do online (estágio 2). Nulo = ainda online.';
comment on column public.competitor_videos.archive_stats_at is 'M10a: a last_checked_at do instante do congelamento: a data das três contagens "na passagem à leitura mensal".';

create or replace function public.competitor_videos_archive_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.archive_dropped_at is not null then
    if (new.archive_frozen_at, new.archive_dropped_at, new.archive_view_count, new.archive_like_count, new.archive_comment_count, new.archive_stats_at)
       is distinct from
       (old.archive_frozen_at, old.archive_dropped_at, old.archive_view_count, old.archive_like_count, old.archive_comment_count, old.archive_stats_at) then
      raise exception 'ja_no_arquivo' using errcode = 'P0001', detail = old.id::text;
    end if;
    return new;
  end if;
  if new.archive_dropped_at is not null and new.archive_frozen_at is null then
    raise exception 'retirada_sem_congelamento' using errcode = 'P0001', detail = old.id::text;
  end if;
  -- a ordem dos estágios é invariante do banco: congelar e retirar no mesmo UPDATE pularia a leitura mensal e a carência
  if old.archive_frozen_at is null and new.archive_dropped_at is not null then
    raise exception 'retirada_sem_congelamento' using errcode = 'P0001', detail = old.id::text;
  end if;
  if old.archive_frozen_at is not null and new.archive_frozen_at is not null
     and new.archive_frozen_at <> old.archive_frozen_at then
    raise exception 'archive_frozen_imutavel' using errcode = 'P0001', detail = old.id::text;
  end if;
  if new.archive_frozen_at is not distinct from old.archive_frozen_at
     and (new.archive_view_count, new.archive_like_count, new.archive_comment_count, new.archive_stats_at)
         is distinct from (old.archive_view_count, old.archive_like_count, old.archive_comment_count, old.archive_stats_at) then
    raise exception 'contagens_do_arquivo_imutaveis' using errcode = 'P0001', detail = old.id::text;
  end if;
  if old.archive_frozen_at is not null and new.archive_frozen_at is null
     and (new.archive_view_count is not null or new.archive_like_count is not null
          or new.archive_comment_count is not null or new.archive_stats_at is not null) then
    raise exception 'descongelar_sem_limpar' using errcode = 'P0001', detail = old.id::text;
  end if;
  return new;
end $$;
revoke all on function public.competitor_videos_archive_guard() from public, anon, authenticated, service_role;
drop trigger if exists competitor_videos_archive_guard on public.competitor_videos;
create trigger competitor_videos_archive_guard
  before update of archive_frozen_at, archive_dropped_at, archive_view_count, archive_like_count, archive_comment_count, archive_stats_at
  on public.competitor_videos for each row execute function public.competitor_videos_archive_guard();

-- 2. A política (02 §10.8, "A política"). Muda só por migration: nenhuma ação de servidor troca H nem libera a classe.
create table if not exists public.obs_archive_video_policy (
  site_id uuid primary key references public.sites(id) on delete cascade,
  h_meses integer not null default 24 check (h_meses >= 12),
  released boolean not null default false,
  teto_unidade integer not null default 100 check (teto_unidade between 1 and 100),
  teto_auto_minimo integer not null default 25 check (teto_auto_minimo >= 0),
  teto_auto_fracao numeric(4,3) not null default 0.050 check (teto_auto_fracao >= 0 and teto_auto_fracao <= 1),
  updated_at timestamptz not null default now()
);
comment on table public.obs_archive_video_policy is 'M10a: a saída por idade do vídeo (classe video_antigo), uma linha por site. H em meses (D15: 24). released = a classe liberada (só por migration, no release das telas da peça 8). Site sem linha = classe fechada e nada elegível (politica_ausente), nunca 24 por omissão. Toda migration que alterar uma linha grava updated_at = now() no mesmo update.';
insert into public.obs_archive_video_policy (site_id) select s.id from public.sites s on conflict (site_id) do nothing;
alter table public.obs_archive_video_policy enable row level security;
revoke all on table public.obs_archive_video_policy from public, anon, authenticated, service_role;
grant select on table public.obs_archive_video_policy to service_role;

-- 3. A guarda de insert nas 8 tabelas da classe video_antigo (02 §10.8). Segunda linha: o predicado do código é a primeira.
create or replace function public.obs_video_antigo_guarda_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.video_id is null then
    return new;
  end if;
  perform 1 from public.competitor_videos v where v.id = new.video_id and v.archive_frozen_at is not null;
  if found then
    raise exception 'video_congelado' using errcode = 'P0001', detail = new.video_id::text, hint = tg_table_name;
  end if;
  return new;
end $$;
revoke all on function public.obs_video_antigo_guarda_insert() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['competitor_video_versions', 'competitor_field_versions', 'competitor_raw',
                           'competitor_video_tier_spans', 'competitor_video_comment_snaps', 'competitor_hour_fold_log',
                           'competitor_changes', 'competitor_readings']
  loop
    execute format('drop trigger if exists obs_video_antigo_guarda on public.%I', t);
    execute format('create trigger obs_video_antigo_guarda before insert on public.%I for each row execute function public.obs_video_antigo_guarda_insert()', t);
  end loop;
end $$;

-- 4. P36: a retirada e a remoção buscam leituras da forja por vídeo e usam o índice inteiro (video_id) da E9
--    (20261015000001:37), conferido no topo. Não se cria outro: o nome já existe e um parcial exigiria rebuild com trava.

-- 5. Ponto 4 (fechamento da faixa): vídeo congelado nunca troca de faixa (o congelamento só fecha a aberta, na M10b).
--    Cópia literal de 20261012000003_observatorio_a5_e2_serie_faixas.sql:66-111, com DUAS mudanças: o retorno ganha `ignorados_congelados` (os congelados DISTINTOS citados no plano, que não são tocados: a defesa não fica calada; M-2) e o "where" do laço
--    ganha "and v.archive_frozen_at is null". O resto (trava, reabertura da semanal, retorno) é idêntico.
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
       and v.archive_frozen_at is null
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
  if v_reopen then
    update public.competitor_channels set weekly_pass_date = null where id = p_channel_id and weekly_pass_date is not null;
  end if;
  return jsonb_build_object('changed', v_changed, 'ignorados_congelados', (select count(distinct x.video_id) from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as x(video_id uuid, tier text) join public.competitor_videos v on v.id = x.video_id and v.competitor_channel_id = p_channel_id where v.archive_frozen_at is not null));
end $$;
revoke all on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) from public, anon, authenticated;
grant execute on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) to service_role;

-- (a guarda da E10 está no topo, bloco 0.)

-- Ponto 5 (prova da série): cópia de 20261012000004 com três mudanças (CTE vid_todos + congelado, CTE vid sem congelados, chave arquivados).
create or replace function public.competitor_series_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with hoje as (select (p_now at time zone 'America/Sao_Paulo')::date as d),
  vid_todos as (
    select v.id, v.series_tier, v.series_tier_since, v.miss_streak,
           (('x' || substr(encode(sha256(convert_to(v.video_id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 7) as dia_fixo,
           -- a mesma regra de canais_em_erro_3d (competitor_capture_health) e de longErrors (competitor-sync-batch.ts)
           -- coalesce: nunca NULO (um NULO tiraria o vídeo de `fora` E de `not fora`, isto é, de todas as contas, em silêncio)
           coalesce(c.sync_status = 'error' and c.missing_since is null
                    and c.sync_error_since < p_now - interval '3 days', false) as canal_erro_3d,
           -- remendo da E10 na linha única que a E10 gera (cobertura da pausa de canal; sem ele a pausa recusa com E10:pausa_sem_remendo)
           (coalesce(v.views_hidden, false) or coalesce(v.live_broadcast_content, 'none') = 'upcoming'
            or v.missing_since is not null or c.missing_since is not null or public.competitor_channel_pause_covers(c.id, p_now, interval '3 days')
            or coalesce(c.sync_status = 'error' and c.sync_error_since < p_now - interval '3 days', false)) as fora,
           -- o canal já foi lido pelo código da E2 e terminou uma sincronização boa nas últimas 24 h
           (c.last_seen_at is not null and c.last_ok_synced_at > p_now - interval '1 day') as canal_em_dia,
           (v.archive_frozen_at is not null) as congelado
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site_id
  ),
  vid as (select * from vid_todos where not congelado)
  select jsonb_build_object(
    'hoje', (select d from hoje),
    'hora_sp', extract(hour from p_now at time zone 'America/Sao_Paulo')::int,
    'fora_da_prova', (select count(*) from vid where fora),
    -- dos que estão fora, os que estão fora por serem de canal em erro há mais de 3 dias (chave nova; o leitor de hoje a ignora)
    'fora_canal_em_erro_3d', (select count(*) from vid where canal_erro_3d),
    -- M10a: vídeos em leitura mensal ou no arquivo. Fora de todas as contas acima; nunca alarme, nunca sumiço calado.
    'arquivados', (select count(*) from vid_todos where congelado),
    'sem_faixa', (
      select count(*) from vid
       where not fora and (
         (series_tier is null and canal_em_dia)
         or (series_tier is not null and not exists (
           select 1 from public.competitor_video_tier_spans s
            where s.video_id = vid.id and s.to_date is null and s.tier = vid.series_tier)))),
    'diaria_sem_ponto_hoje', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'diaria' and miss_streak = 0
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = hoje.d)),
    'diaria_buracos_3d', (
      select count(*) from vid, hoje, generate_series(1, 3) g
        join lateral (select (hoje.d - g)::date as dia) x on true
       where not fora and miss_streak = 0
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
do $$
begin
  if (select p.prosrc from pg_proc p where p.oid = 'public.competitor_series_health(uuid,timestamptz)'::regprocedure)
       not like '%competitor_channel_pause_covers%' then
    raise exception 'M10a: competitor_series_health saiu sem o remendo da E10';
  end if;
end $$;
revoke all on function public.competitor_series_health(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.competitor_series_health(uuid, timestamptz) to service_role;

-- Ponto 8 (remoção de canal): cópia de 20261013000002 com duas chaves a mais depois de 'pinned'.
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
    'videos_leitura_mensal', (select count(*) from public.competitor_videos v
                              where v.competitor_channel_id = p_channel_id and v.archive_frozen_at is not null and v.archive_dropped_at is null),
    'videos_no_arquivo', (select count(*) from public.competitor_videos v
                          where v.competitor_channel_id = p_channel_id and v.archive_dropped_at is not null),
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

-- 6. Ponto 7 (fixar). Assinatura nova com o 5º argumento com padrão: o código antigo (4 argumentos nomeados) segue
--    funcionando entre esta migration e o deploy. A antiga sai antes, ou a chamada de 4 argumentos ficaria ambígua.
drop function if exists public.pin_competitor_video(uuid, uuid, uuid, integer);
create or replace function public.pin_competitor_video(
  p_site_id uuid, p_video_id uuid, p_user_id uuid, p_limit integer, p_pode_descongelar boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_channel uuid;
  v_name text;
  v_pinned_at timestamptz;
  v_frozen timestamptz;
  v_dropped timestamptz;
  v_count integer;
begin
  if p_limit is null or p_limit < 0 then
    raise exception 'pin_competitor_video: p_limit inválido';
  end if;
  select v.competitor_channel_id into v_channel from public.competitor_videos v where v.id = p_video_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select c.channel_name into v_name from public.competitor_channels c
   where c.id = v_channel and c.site_id = p_site_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select v.pinned_at, v.archive_frozen_at, v.archive_dropped_at into v_pinned_at, v_frozen, v_dropped
    from public.competitor_videos v
   where v.id = p_video_id and v.competitor_channel_id = v_channel for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- no arquivo: não há descongelar (02 §10.8, "Desfazer")
  if v_dropped is not null then
    return jsonb_build_object('status', 'ja_no_arquivo');
  end if;
  if v_pinned_at is not null then
    return jsonb_build_object('status', 'ok', 'already', true);
  end if;
  -- em leitura mensal: fixar descongela, e só quem administra o site (a ação diz quem é, depois do guard)
  if v_frozen is not null and not coalesce(p_pode_descongelar, false) then
    return jsonb_build_object('status', 'precisa_admin');
  end if;
  select count(*) into v_count from public.competitor_videos v
   where v.competitor_channel_id = v_channel and v.pinned_at is not null;
  if v_count >= p_limit then
    return jsonb_build_object('status', 'cap', 'name', v_name, 'pinned', v_count);
  end if;
  if v_frozen is not null then
    -- descongelar devolve o vídeo ao classificador sem faixa: a próxima passada abre um span novo a partir de hoje (o congelamento fechou o antigo). Sem isso, sem_faixa eterno.
    update public.competitor_videos
       set pinned_at = now(), pinned_by = p_user_id, archive_frozen_at = null, series_tier = null, series_tier_since = null,
           archive_view_count = null, archive_like_count = null, archive_comment_count = null, archive_stats_at = null
     where id = p_video_id;
  else
    update public.competitor_videos set pinned_at = now(), pinned_by = p_user_id where id = p_video_id;
  end if;
  return jsonb_build_object('status', 'ok', 'already', false) || case when v_frozen is not null then jsonb_build_object('descongelado', true) else '{}'::jsonb end;
end $$;
revoke all on function public.pin_competitor_video(uuid, uuid, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.pin_competitor_video(uuid, uuid, uuid, integer, boolean) to service_role;
comment on function public.pin_competitor_video(uuid, uuid, uuid, integer, boolean) is 'Fixa um vídeo de concorrente travando a linha do canal. M10a: vídeo em leitura mensal só é fixado (e descongelado) com p_pode_descongelar; vídeo no arquivo recusa ja_no_arquivo. Devolve ok / cap / not_found / precisa_admin / ja_no_arquivo.';

notify pgrst, 'reload schema';
reset lock_timeout;
