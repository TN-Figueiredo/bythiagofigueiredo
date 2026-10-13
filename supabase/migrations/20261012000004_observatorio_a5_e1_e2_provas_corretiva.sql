set lock_timeout = '5s';

-- 1. Prova embutida da captura.
--    "Canal em erro há mais de 3 dias" é a MESMA regra de `canais_em_erro_3d` (abaixo) e de `longErrors`
--    (competitor-sync-batch.ts): sync_status = 'error', canal não ausente, sync_error_since há mais de 3 dias.
--    Canal que nunca sincronizou bem entra pela mesma regra: sync_error_since é gravado no primeiro erro.
--    e1.desde = o instante em que a E1 começou a guardar no site:
--      - a primeira resposta guardada (como antes); ou, se o site não tem NENHUMA,
--      - o rastro mais antigo que só o código novo deixa: a primeira versão de campo, o dia (São Paulo) da primeira
--        faixa de série, ou o dia (Pacífico) da primeira linha de cota. Com rastro e sem resposta guardada, a captura
--        não está gravando: tudo o que foi lido desde então conta (no dia do deploy isso inclui o que o código antigo
--        leu depois da meia-noite; o alarme é verdadeiro do mesmo jeito).
--      - sem resposta guardada e sem rastro nenhum, o código novo ainda não rodou no site: as duas contas dão 0
--        (é o estado do deploy até a primeira sincronização; não é falha).
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
      select coalesce(max(q.units_used), 0) from public.youtube_quota_usage q
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

-- 2. Prova embutida da série.
--    Ficam FORA de todas as contas: vídeo sem contagem de views, estreia agendada, vídeo ausente, vídeo de canal
--    ausente e (novo) vídeo de canal em erro há mais de 3 dias: o dono decidiu que depois do 3º dia o cron volta a
--    verde e o aviso segue por e-mail e por nota (decisões 53 e 56). Quando o canal volta a sincronizar bem, os
--    vídeos voltam às contas, e os dias sem ponto do período em erro aparecem em `diaria_buracos_3d` por até 3 dias
--    (é perda real; não some calada).
--    `diaria_sem_ponto_hoje` e `diaria_buracos_3d` (novo) não contam o vídeo com miss_streak > 0: foi PEDIDO e não
--    veio, e a leitura seguinte (3 horas ou mais depois) decide se ele saiu do ar. Sem isto, um vídeo diário apagado
--    à tarde deixava o cron vermelho das 18:20 às 23:40 ("sem ponto hoje") e da 00:00 às 12:20 do dia seguinte
--    ("buraco"). É a mesma regra que `semanal_devidos_hoje` já tinha.
create or replace function public.competitor_series_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with hoje as (select (p_now at time zone 'America/Sao_Paulo')::date as d),
  vid as (
    select v.id, v.series_tier, v.series_tier_since, v.miss_streak,
           (('x' || substr(encode(sha256(convert_to(v.video_id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 7) as dia_fixo,
           -- a mesma regra de canais_em_erro_3d (competitor_capture_health) e de longErrors (competitor-sync-batch.ts)
           -- coalesce: nunca NULO (um NULO tiraria o vídeo de `fora` E de `not fora`, isto é, de todas as contas, em silêncio)
           coalesce(c.sync_status = 'error' and c.missing_since is null
                    and c.sync_error_since < p_now - interval '3 days', false) as canal_erro_3d,
           (coalesce(v.views_hidden, false) or coalesce(v.live_broadcast_content, 'none') = 'upcoming'
            or v.missing_since is not null or c.missing_since is not null
            or coalesce(c.sync_status = 'error' and c.sync_error_since < p_now - interval '3 days', false)) as fora,
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
    -- dos que estão fora, os que estão fora por serem de canal em erro há mais de 3 dias (chave nova; o leitor de hoje a ignora)
    'fora_canal_em_erro_3d', (select count(*) from vid where canal_erro_3d),
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

-- 3. Quem executa. As duas provas: repetido da MG1/MG2 (create or replace preserva a ACL; fica dito aqui).
revoke all on function public.competitor_capture_health(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_series_health(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.competitor_capture_health(uuid, timestamptz) to service_role;
grant execute on function public.competitor_series_health(uuid, timestamptz) to service_role;

-- 4. Três funções de partição já em produção: `security definer`, DDL dinâmico, executáveis por anon (achado do
--    portão das migrations, aprovado pelo dono na decisão 56). O nome e as datas passam por %I/%L (sem injeção), mas
--    um anônimo podia criar partições. Único chamador legítimo, conferido em produção em 12/10/2026 (só leitura):
--    create_link_clicks_partition, pelo cron mensal da Vercel (dia 1, 02:00 UTC) com a chave de serviço. As outras duas
--    não têm chamador (nenhum job do pg_cron, nenhuma função, nenhum código do site).
revoke all on function public.create_link_clicks_partition(text, text, text) from public, anon, authenticated;
revoke all on function public.create_linktree_events_partition(text, text, text) from public, anon, authenticated;
revoke all on function public.create_monthly_partitions(integer) from public, anon, authenticated;
grant execute on function public.create_link_clicks_partition(text, text, text) to service_role;
grant execute on function public.create_linktree_events_partition(text, text, text) to service_role;
grant execute on function public.create_monthly_partitions(integer) to service_role;

reset lock_timeout;
