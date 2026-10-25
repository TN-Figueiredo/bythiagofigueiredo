-- A5 E14 (emenda 24/10, dono): o vermelho de `retratos_comentarios` acende so com perda NOVA (janela fechada nas ultimas 48 h).
-- A contagem de 7 dias segue na prova (frase e tela). So acrescenta duas chaves; codigo velho as ignora (volta = reverter o codigo).
-- Corpo = pg_get_functiondef da funcao instalada (inclui o remendo da pausa, 20261021000002). Idempotente.
-- Conferencia: select public.competitor_comment_health(null, now(), '[{"mark":1,"from_h":24,"until_h":72},{"mark":7,"from_h":168,"until_h":240},{"mark":30,"from_h":720,"until_h":888}]'::jsonb, 28, '30 hours', null) ? 'retratos_perdidos_novos';
-- md5(prosrc) antes: 2abceb69c00820f7596b6c88d4478b1f
-- md5(prosrc) depois: 25eeaa23497f27a74730bbba344aa687

-- Guarda (Phil I2 / Yannis Y3): so recria se o corpo instalado e o conhecido (antes) ou o desta propria migration (reaplicacao).
-- Se outra migration/trilha mexeu na funcao, recusa em vez de sobrescrever em silencio.
do $guarda$
declare
  n integer;
  h text;
begin
  select count(*), min(md5(p.prosrc)) into n, h
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'competitor_comment_health';
  if n <> 1 then
    raise exception 'retratos_perda_nova: esperava 1 funcao public.competitor_comment_health, achei %', n;
  end if;
  if h not in ('2abceb69c00820f7596b6c88d4478b1f', '25eeaa23497f27a74730bbba344aa687') then
    raise exception 'retratos_perda_nova: corpo instalado de competitor_comment_health tem md5 % (esperado 2abceb69... ou 25eeaa23...); outra migration mexeu nela. Reescreva a partir do corpo instalado antes de aplicar.', h;
  end if;
end
$guarda$;

CREATE OR REPLACE FUNCTION public.competitor_comment_health(p_site_id uuid, p_now timestamp with time zone, p_marks jsonb, p_identity_days integer, p_grace interval, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with m as (
    select (x->>'mark')::smallint as mark, (x->>'from_h')::integer as from_h, (x->>'until_h')::integer as until_h
      from jsonb_array_elements(case when jsonb_typeof(p_marks) = 'array' then p_marks else '[]'::jsonb end) x
  ), base as (
    select v.id as video_id, c.site_id, v.discovered_at,
           greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where (p_site_id is null or c.site_id = p_site_id)
       and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval '7 days') and v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
  ), janela as (
    select b.video_id, b.discovered_at, b.t0, m.mark, m.from_h, m.until_h, s.status, s.error_reason
      from base b
      join m on b.t0 <= p_now - make_interval(hours => m.from_h) and b.t0 > p_now - make_interval(hours => m.until_h)
      left join public.competitor_video_comment_snaps s on s.video_id = b.video_id and s.mark = m.mark
     where p_since is null or b.t0 + make_interval(hours => m.from_h) >= p_since
  ), inicio as (
    select min(s.taken_at) as desde, max(s.taken_at) as ate, count(*) as n, count(*) filter (where s.status = 'ok') as n_ok
      from public.competitor_video_comment_snaps s
     where p_site_id is null or s.site_id = p_site_id
  ), perdidos as (
    -- janela que FECHOU nos últimos 7 dias sem retrato final. Conta do corte (p_since) quando há; sem corte, da primeira coleta.
    select coalesce(s.error_reason, 'sem_retrato') as motivo,
           b.t0 + make_interval(hours => m.until_h) as fechou
      from base b
      join m on b.t0 + make_interval(hours => m.until_h) <= p_now
            and b.t0 + make_interval(hours => m.until_h) > p_now - interval '7 days'
      left join public.competitor_video_comment_snaps s on s.video_id = b.video_id and s.mark = m.mark
      cross join inicio i
     where (s.video_id is null or s.status = 'erro')
       and coalesce(p_since, i.desde) is not null
       and b.t0 + make_interval(hours => m.from_h) >= coalesce(p_since, i.desde)
       and coalesce(b.discovered_at, b.t0) <= b.t0 + make_interval(hours => m.until_h) - p_grace
  )
  select case when p_now is null or p_identity_days is null or p_grace is null
                or jsonb_typeof(p_marks) is distinct from 'array' or jsonb_array_length(p_marks) = 0
  then null else jsonb_build_object(
    'identidade_vencida', (
      -- o mais antigo entre o relógio de quem gravou (first_seen_at) e o do banco (created_at): relógio adiantado não esconde
      select count(*) from public.competitor_video_comment_authors a
        join public.competitor_video_comments c on c.id = a.comment_id
       where (p_site_id is null or a.site_id = p_site_id)
         and least(c.first_seen_at, a.created_at) < p_now - make_interval(days => p_identity_days + 1)),
    'identidade_prazo_errado', (
      select count(*) from public.competitor_video_comment_authors a
        join public.competitor_video_comments c on c.id = a.comment_id
       where (p_site_id is null or a.site_id = p_site_id)
         and (a.expires_at is distinct from c.first_seen_at + make_interval(days => p_identity_days)
              or a.expires_at > a.created_at + make_interval(days => p_identity_days) + interval '10 minutes')),
    'identidade_de_criador', (
      select count(*) from public.competitor_video_comment_authors a
        join public.competitor_video_comments c on c.id = a.comment_id
       where (p_site_id is null or a.site_id = p_site_id) and c.is_creator),
    'respostas_de_terceiros', (
      -- F2 (17/10): conta o que está FORA da regra (7f), não as respostas de espectador em si
      (select count(*) from public.competitor_video_comments t
        where (p_site_id is null or t.site_id = p_site_id) and t.parent_id is not null and not t.is_creator
          and (t.speaker_no is null or t.missing_since is not null
               or not exists (select 1 from public.competitor_video_comments k
                               where k.parent_id = t.parent_id and k.is_creator and k.missing_since is null)))
      + (select coalesce(sum(x.n - 20), 0)::bigint
           from (select t.video_id, count(*) as n from public.competitor_video_comments t
                  where (p_site_id is null or t.site_id = p_site_id) and t.parent_id is not null and not t.is_creator
                  group by t.video_id having count(*) > 20) x)
      + (select count(*) from public.competitor_video_comment_authors a
           join public.competitor_video_comments c on c.id = a.comment_id
          where (p_site_id is null or a.site_id = p_site_id) and c.parent_id is not null and not c.is_creator)),
    'retratos_atrasados', (
      select count(*) from janela j
       where j.status is null
         and j.t0 <= p_now - make_interval(hours => j.from_h) - p_grace
         and coalesce(j.discovered_at, j.t0) <= p_now - p_grace),
    'retratos_em_erro', (select count(*) from janela j where j.status = 'erro'),
    'erros_por_motivo', (
      select coalesce(jsonb_object_agg(x.error_reason, x.n), '{}'::jsonb)
        from (select j.error_reason, count(*) as n from janela j where j.status = 'erro' group by 1) x),
    'retratos_na_janela', (select count(*) from janela),
    'retratos_perdidos_7d', (select count(*) from perdidos),
    'retratos_perdidos_novos', (select count(*) from perdidos p where p.fechou > p_now - interval '48 hours'),
    'perdidos_novos_por_motivo', (
      select coalesce(jsonb_object_agg(x.motivo, x.n), '{}'::jsonb)
        from (select p.motivo, count(*) as n from perdidos p where p.fechou > p_now - interval '48 hours' group by 1) x),
    'perdidos_por_motivo', (
      select coalesce(jsonb_object_agg(x.motivo, x.n), '{}'::jsonb)
        from (select p.motivo, count(*) as n from perdidos p group by 1) x),
    'retratos_total', (select n from inicio),
    'retratos_ok', (select n_ok from inicio),
    'primeira_coleta', (select desde from inicio),
    'ultima_coleta', (select ate from inicio),
    'comentarios_total', (
      select count(*) from public.competitor_video_comments c where p_site_id is null or c.site_id = p_site_id),
    'identidades_total', (
      select count(*) from public.competitor_video_comment_authors a where p_site_id is null or a.site_id = p_site_id),
    'comentarios_ausentes_sem_decisao', (
      select count(*) from public.competitor_video_comments c
       where (p_site_id is null or c.site_id = p_site_id) and c.missing_since is not null and c.removal_decision is null))
  end;
$function$;
