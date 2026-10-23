-- =============================================================================
-- MIGRATION: ab_lab_volume_por_video
-- Volume de impressões por vídeo para o roteador da lista do A/B Lab (F1a-tela-1, T3, D-4).
-- Uma linha por vídeo pedido (vídeo sem relatório vem com dias_cobertos = 0, nunca ausente).
-- Dia coberto = relatório de alcance do CANAL do vídeo (channel_reach_basic_a1, normalized_at não nulo, status baixado/vazio),
-- dia = data UTC do start_time (mesma regra de normalizadores-step). Janela: os 14 dias cobertos mais recentes a partir de
-- max(publicado_PT + 1, hoje_PT - 28). Dia coberto sem linha do vídeo = 0 medido. A soma é feita aqui: o PostgREST corta em 1000 linhas.
-- `publico`: último privacy_status conhecido do vídeo = 'public' (nulo = nunca capturado).
-- Molde de ab_lab_formato_atual: security invoker, só service_role, SEM can_view_site (o cliente de serviço não tem auth.uid():
-- a RPC voltaria vazia). A autorização é requireEditUser() + site do contexto, na borda.
-- =============================================================================
set lock_timeout = '5s';

create or replace function public.ab_lab_volume(p_site uuid, p_videos uuid[])
returns table (video_id uuid, soma bigint, dias_cobertos integer, publico boolean)
language sql stable security invoker set search_path = '' as $$
  with v as (
    select y.id, y.youtube_video_id as yt, y.channel_id,
           greatest((y.published_at at time zone 'America/Sao_Paulo')::date + 1,
                    (now() at time zone 'America/Sao_Paulo')::date - 28) as desde
      from public.youtube_videos y
     where y.site_id = p_site and y.id = any(p_videos)
  ), cob as (
    select v.id, d.dia, row_number() over (partition by v.id order by d.dia desc) as rn
      from v
      join lateral (select distinct (r.start_time at time zone 'UTC')::date as dia
                      from public.yt_reporting_reports r
                     where r.site_id = p_site and r.channel_id = v.channel_id
                       and r.report_type_id = 'channel_reach_basic_a1'
                       and r.normalized_at is not null and r.status in ('baixado', 'vazio')) d
        on d.dia >= v.desde
  ), janela as (
    select c.id, c.dia from cob c where c.rn <= 14
  )
  select v.id,
         coalesce(sum(coalesce(rd.thumbnail_impressions, 0)), 0)::bigint,
         count(j.dia)::integer,
         (select m.privacy_status = 'public' from public.yt_own_video_meta_daily m
           where m.site_id = p_site and m.youtube_video_id = v.yt and m.privacy_status is not null
           order by m.day_pt desc limit 1)
    from v
    left join janela j on j.id = v.id
    left join public.yt_own_video_reach_daily rd
           on rd.site_id = p_site and rd.youtube_video_id = v.yt and rd.day_pt = j.dia
   group by v.id, v.yt;
$$;
revoke all on function public.ab_lab_volume(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.ab_lab_volume(uuid, uuid[]) to service_role;

reset lock_timeout;
