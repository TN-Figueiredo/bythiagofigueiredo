-- A5 · F2-coleta (emenda 17/10 ao spec 02 §4.6.3 item 7, decisão do dono 17/10): respostas de espectadores em fio com
-- resposta do criador, até 20 por vídeo, numeradas por fio (speaker_no), sem identidade. Recria apply_competitor_comment_snap
-- e competitor_comment_health com a MESMA assinatura. Idempotente: add column if not exists, drop constraint if exists,
-- create or replace function. Caminho de volta: ver o plano (Tarefa 2, "Volta").
do $$ begin
  if to_regprocedure('public.apply_competitor_comment_snap(uuid,smallint,jsonb,jsonb,text[])') is null
     or to_regprocedure('public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)') is null then
    raise exception 'F2-coleta depende da MG8 (20261013000003)';
  end if;
end $$;

alter table public.competitor_video_comments add column if not exists speaker_no smallint;
alter table public.competitor_video_comments drop constraint if exists competitor_video_comments_reply_check;
alter table public.competitor_video_comments add constraint competitor_video_comments_reply_check
  check (parent_id is null or is_creator or speaker_no is not null);
alter table public.competitor_video_comments drop constraint if exists competitor_video_comments_speaker_check;
alter table public.competitor_video_comments add constraint competitor_video_comments_speaker_check
  check (speaker_no is null or (parent_id is not null and not is_creator and speaker_no >= 1));
comment on column public.competitor_video_comments.parent_id is 'Nulo = topo. Preenchido = resposta: do criador (is_creator) ou, desde a F2-coleta (17/10), de espectador em fio com resposta do criador presente, com speaker_no e SEM identidade.';
comment on column public.competitor_video_comments.speaker_no is 'F2-coleta: "Espectador N" dentro do fio, numerado na coleta e congelado. 1 = autor do topo quando não é o criador. Nunca há chave, nome nem id de canal guardado.';

-- 1. apply_competitor_comment_snap (mesma assinatura)
-- p_snap: { taken_at, from_h, until_h (a tolerância do marco: OBRIGATÓRIOS), status, error_reason, pool_size, pool_complete,
--           video_comment_count, selected_count, featured_lookup_n, featured_unknown_n, rule_version, rule_params, units_used,
--           pool_stats (objeto só de números e sim/não, ou ausente), identity_days (padrão 28), creator_replies_max (padrão 3, até 5),
--           third_party_replies_max (padrão 0, até 20: F2, respostas de espectador) }
--           A idade do vídeo NÃO vem de quem chama: o banco calcula de taken_at e recusa o retrato fora da tolerância.
-- p_comments: lista de { youtube_comment_id, parent_youtube_id (nulo = topo), via ('lote' | 'id'), body, body_truncated,
--           published_at, edited_at, is_creator, creator_replied, featured_reason, featured_channel_id,
--           featured_size_band, featured_ratio_band, author { display_name, channel_id, avatar_url } | null,
--           likes, reply_count, relevance_rank, slot, speaker_no (F2: só em resposta de espectador; nunca author nelas) }
-- p_missing: ids de comentário guardado que foram pedidos por id e NÃO vieram (só quando a chamada deu certo).
-- Devolve { status: 'gravado' | 'ja_existe' | 'video_ausente' | 'fora_da_tolerancia', ...contagens }.
-- Id repetido em p_comments: fica um (o do lote ganha do achado por id; depois o primeiro) e o resto conta em nao_gravados.
create or replace function public.apply_competitor_comment_snap(
  p_video uuid, p_mark smallint, p_snap jsonb, p_comments jsonb, p_missing text[] default '{}'
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_site uuid;
  v_channel uuid;
  v_prev text;
  v_t0 timestamptz;
  v_age numeric;
  v_from integer := (p_snap->>'from_h')::integer;
  v_until integer := (p_snap->>'until_h')::integer;
  v_stats jsonb := p_snap->'pool_stats';
  v_taken timestamptz := (p_snap->>'taken_at')::timestamptz;
  v_status text := p_snap->>'status';
  v_days integer := coalesce((p_snap->>'identity_days')::integer, 28);
  v_replies_max integer := coalesce((p_snap->>'creator_replies_max')::integer, 3);
  v_third_max integer := coalesce((p_snap->>'third_party_replies_max')::integer, 0); -- F2: 0 = código antigo nunca grava terceiro
  v_comments jsonb := coalesce(p_comments, '[]'::jsonb);
  v_recebidos integer := 0;
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_identidades integer := 0;
  v_leituras integer := 0;
  v_por_id integer := 0;
  v_resp_novas integer := 0;
  v_resp_atualizadas integer := 0;
  v_ausentes integer := 0;
  v_marcados integer := 0;
  v_ignorados integer := 0;
  v_terc_novos integer := 0; -- F2
  v_terc_atualizados integer := 0;
  v_terc_apagados integer := 0;
  v_terc_fora integer := 0;
  v_terc_sem_fio integer := 0;
  n1 integer; n2 integer; n3 integer; n4 integer;
begin
  if v_taken is null or v_status is null then
    raise exception 'retrato sem taken_at ou sem status' using errcode = '22023';
  end if;
  if p_mark not in (1, 7, 30) then
    raise exception 'marco fora de 1, 7 e 30' using errcode = '22023';
  end if;
  if jsonb_typeof(v_comments) <> 'array' then
    raise exception 'p_comments nao e lista' using errcode = '22023';
  end if;
  if v_status <> 'ok' and (jsonb_array_length(v_comments) > 0 or coalesce(array_length(p_missing, 1), 0) > 0) then
    raise exception 'retrato que nao e ok nao leva comentario nem ausencia' using errcode = '22023';
  end if;
  -- F2: limites das respostas guardadas
  if v_replies_max < 1 or v_replies_max > 5 then
    raise exception 'creator_replies_max fora de 1 a 5' using errcode = '22023';
  end if;
  if v_third_max < 0 or v_third_max > 20 then
    raise exception 'third_party_replies_max fora de 0 a 20' using errcode = '22023';
  end if;
  if v_days < 1 or v_days > 28 then
    raise exception 'prazo de identidade fora de 1 a 28 dias' using errcode = '22023';
  end if;
  -- o prazo da identidade conta de taken_at: um relógio adiantado em quem chama esticaria os 28 dias
  if v_taken > now() + interval '10 minutes' then
    raise exception 'taken_at no futuro' using errcode = '22023';
  end if;
  if v_from is null or v_until is null or v_from < 0 or v_until <= v_from then
    raise exception 'retrato sem a tolerancia do marco (from_h, until_h)' using errcode = '22023';
  end if;
  if v_stats is not null and jsonb_typeof(v_stats) = 'null' then
    v_stats := null;
  end if;
  if v_stats is not null and (jsonb_typeof(v_stats) <> 'object'
      or exists (select 1 from jsonb_each(v_stats) e where jsonb_typeof(e.value) not in ('number', 'boolean', 'null'))) then
    raise exception 'pool_stats so leva numero e sim/nao' using errcode = '22023';
  end if;

  select c.site_id, v.competitor_channel_id, greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at))
    into v_site, v_channel, v_t0
    from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id
   where v.id = p_video;
  if not found then
    return jsonb_build_object('status', 'video_ausente');
  end if;

  -- dois disparos com o mesmo (vídeo, marco): o segundo espera o primeiro e encontra o retrato pronto
  perform pg_advisory_xact_lock(hashtextextended('cvcs:' || p_video::text || ':' || p_mark::text, 0));
  select s.status into v_prev from public.competitor_video_comment_snaps s where s.video_id = p_video and s.mark = p_mark;
  if v_prev in ('ok', 'sem_comentarios', 'desligados') then
    return jsonb_build_object('status', 'ja_existe', 'anterior', v_prev);
  end if;

  -- o rótulo do marco é garantido aqui, não só em quem chama: retrato fora da tolerância não é gravado (e seria final)
  v_age := round((extract(epoch from (v_taken - v_t0)) / 3600.0)::numeric, 2);
  if v_age is null or v_age < v_from or v_age >= v_until then
    return jsonb_build_object('status', 'fora_da_tolerancia', 'idade_h', v_age);
  end if;

  insert into public.competitor_video_comment_snaps as s (
    video_id, mark, site_id, competitor_channel_id, taken_at, video_age_hours, status, error_reason, pool_size, pool_complete,
    video_comment_count, selected_count, featured_lookup_n, featured_unknown_n, rule_version, rule_params, units_used, pool_stats)
  values (
    p_video, p_mark, v_site, v_channel, v_taken, v_age, v_status, p_snap->>'error_reason',
    (p_snap->>'pool_size')::smallint, (p_snap->>'pool_complete')::boolean, (p_snap->>'video_comment_count')::bigint,
    (p_snap->>'selected_count')::smallint, (p_snap->>'featured_lookup_n')::smallint, (p_snap->>'featured_unknown_n')::smallint,
    (p_snap->>'rule_version')::smallint, coalesce(p_snap->'rule_params', '{}'::jsonb), coalesce((p_snap->>'units_used')::smallint, 0), v_stats)
  on conflict (video_id, mark) do update set
    taken_at = excluded.taken_at, video_age_hours = excluded.video_age_hours, status = excluded.status,
    error_reason = excluded.error_reason, pool_size = excluded.pool_size, pool_complete = excluded.pool_complete,
    video_comment_count = excluded.video_comment_count, selected_count = excluded.selected_count,
    featured_lookup_n = excluded.featured_lookup_n, featured_unknown_n = excluded.featured_unknown_n,
    rule_version = excluded.rule_version, rule_params = excluded.rule_params, pool_stats = excluded.pool_stats,
    units_used = least(s.units_used + excluded.units_used, 32767);

  if v_status <> 'ok' then
    return jsonb_build_object('status', 'gravado', 'retrato', v_status, 'recebidos', 0);
  end if;

  v_recebidos := jsonb_array_length(v_comments);

  -- um id repetido no pacote derrubaria a escrita inteira (21000) a cada tentativa: fica um por id
  select coalesce(jsonb_agg(d.x order by d.ord), '[]'::jsonb) into v_comments from (
    select distinct on (t.x->>'youtube_comment_id') t.x, t.ord
      from jsonb_array_elements(v_comments) with ordinality as t(x, ord)
     where t.x->>'youtube_comment_id' is not null
     order by t.x->>'youtube_comment_id', (coalesce(t.x->>'via', 'lote') = 'lote') desc, t.ord) d;

  -- o comentário que o dono mandou apagar não volta; fica registrado que ele foi visto de novo
  -- F2: só topo e resposta do criador deixam marca de "voltou"; comentário de espectador nunca
  with ids as (select x->>'youtube_comment_id' as yid from jsonb_array_elements(v_comments) x
                where x->>'parent_youtube_id' is null or (x->>'is_creator')::boolean is true)
  update public.competitor_removed_items r set returned_seen_at = v_taken
   where r.site_id = v_site and r.kind = 'comentario' and r.returned_seen_at is null
     and r.youtube_id in (select yid from ids);

  -- (a) comentários de topo vindos no lote: insere ou atualiza; identidade só na inserção e só de quem não é o criador
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean,
      published_at timestamptz, edited_at timestamptz, is_creator boolean, creator_replied boolean,
      featured_reason text, featured_channel_id uuid, featured_size_band text, featured_ratio_band text,
      author jsonb, likes integer, reply_count integer, relevance_rank smallint, slot text)
     where x.parent_youtube_id is null and coalesce(x.via, 'lote') = 'lote'
       and x.youtube_comment_id is not null and x.body is not null and x.published_at is not null
       and x.is_creator is not null and x.likes is not null
       and not exists (select 1 from public.competitor_removed_items r
                        where r.site_id = v_site and r.kind = 'comentario' and r.youtube_id = x.youtube_comment_id)
  ), up as (
    insert into public.competitor_video_comments as c (
      site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, body_truncated, published_at, edited_at,
      is_creator, creator_replied, featured_reason, featured_channel_id, featured_size_band, featured_ratio_band,
      last_checked_at, first_seen_at, last_seen_at)
    select v_site, v_channel, p_video, i.youtube_comment_id, null, i.body, coalesce(i.body_truncated, false), i.published_at, i.edited_at,
           i.is_creator, i.creator_replied, i.featured_reason, i.featured_channel_id, i.featured_size_band, i.featured_ratio_band,
           v_taken, v_taken, v_taken
      from inp i
    on conflict (video_id, youtube_comment_id) do update set
      body = excluded.body, body_truncated = excluded.body_truncated, edited_at = excluded.edited_at,
      creator_replied = case when c.creator_replied is true and excluded.creator_replied is null then true else excluded.creator_replied end,
      featured_reason = coalesce(c.featured_reason, excluded.featured_reason),
      featured_channel_id = case when c.featured_reason is null and c.author_purged_at is null then excluded.featured_channel_id else c.featured_channel_id end,
      featured_size_band = case when c.featured_reason is null then excluded.featured_size_band else c.featured_size_band end,
      featured_ratio_band = case when c.featured_reason is null then excluded.featured_ratio_band else c.featured_ratio_band end,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      where c.parent_id is null
    returning c.id, c.youtube_comment_id, (c.xmax = 0) as inserted, c.is_creator
  ), au as (
    insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, channel_id, avatar_url, expires_at)
    select u.id, v_site, i.author->>'display_name', i.author->>'channel_id', i.author->>'avatar_url', v_taken + make_interval(days => v_days)
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
     where u.inserted and not u.is_creator and jsonb_typeof(i.author) = 'object'
       and coalesce(i.author->>'display_name', i.author->>'channel_id', i.author->>'avatar_url') is not null
    on conflict (comment_id) do nothing
    returning 1
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot, creator_replied)
    select u.id, p_mark, v_site, i.likes, i.reply_count, i.relevance_rank, i.slot, i.creator_replied
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set
      likes = excluded.likes, reply_count = excluded.reply_count, relevance_rank = excluded.relevance_rank, slot = excluded.slot,
      creator_replied = excluded.creator_replied
    returning 1
  )
  select (select count(*) from up where inserted), (select count(*) from up where not inserted), (select count(*) from au), (select count(*) from mk)
    into n1, n2, n3, n4;
  v_novos := n1; v_atualizados := n2; v_identidades := n3; v_leituras := n4;

  -- (b) comentários JÁ guardados (topo ou resposta) que não vieram no lote e foram achados por id: só atualiza
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, via text, body text, body_truncated boolean, edited_at timestamptz, likes integer, reply_count integer)
     where x.via = 'id' and x.youtube_comment_id is not null and x.body is not null and x.likes is not null
  ), up as (
    update public.competitor_video_comments c set
      body = i.body, body_truncated = coalesce(i.body_truncated, false), edited_at = i.edited_at,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      from inp i
     where c.video_id = p_video and c.youtube_comment_id = i.youtube_comment_id
    returning c.id, c.youtube_comment_id, c.parent_id
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select u.id, p_mark, v_site, i.likes, case when u.parent_id is null then i.reply_count end, null, null
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set likes = excluded.likes, reply_count = excluded.reply_count, relevance_rank = null, slot = null,
      creator_replied = null
    returning 1
  )
  select (select count(*) from up), (select count(*) from mk) into n1, n2;
  v_por_id := n1; v_leituras := v_leituras + n2;

  -- (c) respostas DO CRIADOR vistas no lote que já estão guardadas: atualiza
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean, edited_at timestamptz,
      is_creator boolean, likes integer)
     where x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is not null -- F2: de qualquer autor
       and x.youtube_comment_id is not null and x.body is not null and x.likes is not null
  ), up as (
    update public.competitor_video_comments c set
      body = i.body, body_truncated = coalesce(i.body_truncated, false), edited_at = i.edited_at,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      from inp i
     where c.video_id = p_video and c.youtube_comment_id = i.youtube_comment_id and c.parent_id is not null
       and c.is_creator = i.is_creator -- F2: nunca troca o lado; speaker_no não está no set (número congelado)
    returning c.id, c.youtube_comment_id, c.is_creator
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select u.id, p_mark, v_site, i.likes, null, null, null
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set likes = excluded.likes
    returning 1
  )
  select (select count(*) from up where is_creator), (select count(*) from mk), (select count(*) from up where not is_creator) into n1, n2, n3;
  v_resp_atualizadas := n1; v_leituras := v_leituras + n2; v_terc_atualizados := n3;

  -- (d) respostas DO CRIADOR novas: as mais antigas primeiro, até o teto por conversa (contando as já guardadas)
  with inp as (
    select x.* from jsonb_to_recordset(v_comments) as x(
      youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean,
      published_at timestamptz, edited_at timestamptz, is_creator boolean, likes integer)
     where x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is true
       and x.youtube_comment_id is not null and x.body is not null and x.published_at is not null and x.likes is not null
       and not exists (select 1 from public.competitor_removed_items r
                        where r.site_id = v_site and r.kind = 'comentario' and r.youtube_id in (x.youtube_comment_id, x.parent_youtube_id))
       and not exists (select 1 from public.competitor_video_comments k
                        where k.video_id = p_video and k.youtube_comment_id = x.youtube_comment_id)
  ), par as (
    select p.id as parent_id, p.youtube_comment_id,
           (select count(*) from public.competitor_video_comments k where k.parent_id = p.id and k.is_creator) as ja -- F2: só o criador
      from public.competitor_video_comments p
     where p.video_id = p_video and p.parent_id is null
  ), novo as (
    select i.*, par.parent_id, par.ja,
           row_number() over (partition by par.parent_id order by i.published_at, i.youtube_comment_id) as rn
      from inp i join par on par.youtube_comment_id = i.parent_youtube_id
  ), ins as (
    insert into public.competitor_video_comments as c (
      site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, body_truncated, published_at, edited_at,
      is_creator, last_checked_at, first_seen_at, last_seen_at)
    select v_site, v_channel, p_video, n.youtube_comment_id, n.parent_id, n.body, coalesce(n.body_truncated, false), n.published_at, n.edited_at,
           true, v_taken, v_taken, v_taken
      from novo n
     where n.rn + n.ja <= v_replies_max
    on conflict (video_id, youtube_comment_id) do nothing
    returning c.id, c.youtube_comment_id
  ), mk as (
    insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select s.id, p_mark, v_site, n.likes, null, null, null
      from ins s join novo n on n.youtube_comment_id = s.youtube_comment_id
    on conflict (comment_id, mark) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from mk) into n1, n2;
  v_resp_novas := n1; v_leituras := v_leituras + n2;

  -- (e) guardados que foram pedidos por id e não vieram: a ausência soma; marca na 2ª seguida, ou na 1ª se o marco é o 30
  --     F2 (D6): terceiro ausente é APAGADO na hora (não marca, não passa pela fila nem por competitor_removed_items);
  --     só topo e resposta do criador recebem missing_since.
  with seen as (
    select x->>'youtube_comment_id' as yid from jsonb_array_elements(v_comments) x
  ), del as (
    delete from public.competitor_video_comments c
     where c.video_id = p_video and c.parent_id is not null and not c.is_creator
       and c.youtube_comment_id = any(coalesce(p_missing, '{}'))
       and c.youtube_comment_id not in (select yid from seen where yid is not null)
    returning 1
  ), up as (
    update public.competitor_video_comments c set
      last_checked_at = v_taken,
      miss_streak = least(c.miss_streak + 1, 32767),
      missing_since = case when c.missing_since is null and (c.miss_streak + 1 >= 2 or p_mark = 30)
                           then (v_taken at time zone 'America/Sao_Paulo')::date else c.missing_since end
     where c.video_id = p_video and c.youtube_comment_id = any(coalesce(p_missing, '{}'))
       and (c.parent_id is null or c.is_creator) -- F2
       and c.youtube_comment_id not in (select yid from seen where yid is not null)
    returning (c.missing_since is not null) as marcado
  )
  select (select count(*) from up), (select count(*) filter (where marcado) from up), (select count(*) from del) into n1, n2, n3;
  v_ausentes := n1; v_marcados := n2; v_terc_apagados := n3;

  -- (g) F2: terceiro de fio sem resposta do criador presente (a única ficou ausente agora, ou o criador apagou) sai na mesma transação
  with del as (
    delete from public.competitor_video_comments t
     where t.video_id = p_video and t.parent_id is not null and not t.is_creator
       and not exists (select 1 from public.competitor_video_comments k
                        where k.parent_id = t.parent_id and k.is_creator and k.missing_since is null)
    returning 1
  )
  select count(*) into n1 from del;
  v_terc_apagados := v_terc_apagados + n1;

  -- (f) F2 (por ÚLTIMO: c → d → e → g → f, para ver o estado final): respostas de ESPECTADORES novas, só em fio com resposta do criador presente, até v_third_max por vídeo
  --     (as já guardadas contam), na ordem do pacote. Nunca identidade; speaker_no vem da coleta e congela.
  with inp as (
    select x.*, t.ord
      from jsonb_array_elements(v_comments) with ordinality as t(j, ord)
      cross join lateral jsonb_to_record(t.j) as x(
        youtube_comment_id text, parent_youtube_id text, via text, body text, body_truncated boolean,
        published_at timestamptz, edited_at timestamptz, is_creator boolean, likes integer, speaker_no smallint)
     where v_third_max > 0
       and x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is false
       and x.youtube_comment_id is not null and x.body is not null and x.published_at is not null and x.likes is not null
       and x.speaker_no is not null and x.speaker_no >= 1
       and not exists (select 1 from public.competitor_removed_items r
                        where r.site_id = v_site and r.kind = 'comentario' and r.youtube_id = x.youtube_comment_id)
       and not exists (select 1 from public.competitor_video_comments k
                        where k.video_id = p_video and k.youtube_comment_id = x.youtube_comment_id)
  ), par as (
    select p.id as parent_id, p.youtube_comment_id
      from public.competitor_video_comments p
     where p.video_id = p_video and p.parent_id is null
       and exists (select 1 from public.competitor_video_comments k
                    where k.parent_id = p.id and k.is_creator and k.missing_since is null)
  ), ja as (
    select count(*) as n from public.competitor_video_comments k
     where k.video_id = p_video and k.parent_id is not null and not k.is_creator
  ), novo as (
    select i.*, par.parent_id, row_number() over (order by i.ord) as rn
      from inp i join par on par.youtube_comment_id = i.parent_youtube_id
  ), ins as (
    insert into public.competitor_video_comments as c (
      site_id, competitor_channel_id, video_id, youtube_comment_id, parent_id, body, body_truncated, published_at, edited_at,
      is_creator, speaker_no, last_checked_at, first_seen_at, last_seen_at)
    select v_site, v_channel, p_video, n.youtube_comment_id, n.parent_id, n.body, coalesce(n.body_truncated, false), n.published_at,
           n.edited_at, false, n.speaker_no, v_taken, v_taken, v_taken
      from novo n cross join ja
     where n.rn + ja.n <= v_third_max
    on conflict (video_id, youtube_comment_id) do nothing
    returning c.id, c.youtube_comment_id
  ), mk as (
    insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select s.id, p_mark, v_site, n.likes, null, null, null
      from ins s join novo n on n.youtube_comment_id = s.youtube_comment_id
    on conflict (comment_id, mark) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from mk), (select count(*) from novo), (select count(*) from inp) into n1, n2, n3, n4;
  v_terc_novos := n1; v_leituras := v_leituras + n2; v_terc_fora := n3 - n1; v_terc_sem_fio := n4 - n3;

  v_ignorados := v_recebidos - (v_novos + v_atualizados + v_por_id + v_resp_novas + v_resp_atualizadas
                                + v_terc_novos + v_terc_atualizados + v_terc_fora + v_terc_sem_fio); -- F2

  return jsonb_build_object(
    'status', 'gravado', 'retrato', v_status, 'recebidos', v_recebidos,
    'comentarios_novos', v_novos, 'comentarios_atualizados', v_atualizados, 'achados_por_id', v_por_id,
    'respostas_novas', v_resp_novas, 'respostas_atualizadas', v_resp_atualizadas,
    'identidades', v_identidades, 'leituras', v_leituras,
    'ausentes', v_ausentes, 'ausentes_marcados', v_marcados, 'nao_gravados', v_ignorados,
    'terceiros_novos', v_terc_novos, 'terceiros_atualizados', v_terc_atualizados, 'terceiros_apagados', v_terc_apagados,
    'terceiros_fora_do_teto', v_terc_fora, 'terceiros_sem_fio', v_terc_sem_fio);
end $$;

-- 2. competitor_comment_health (mesma assinatura; só muda respostas_de_terceiros)
create or replace function public.competitor_comment_health(
  p_site_id uuid, p_now timestamptz, p_marks jsonb, p_identity_days integer, p_grace interval,
  p_since timestamptz default null
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with m as (
    select (x->>'mark')::smallint as mark, (x->>'from_h')::integer as from_h, (x->>'until_h')::integer as until_h
      from jsonb_array_elements(case when jsonb_typeof(p_marks) = 'array' then p_marks else '[]'::jsonb end) x
  ), base as (
    select v.id as video_id, c.site_id, v.discovered_at,
           greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where (p_site_id is null or c.site_id = p_site_id)
       and v.missing_since is null and c.missing_since is null and v.published_at is not null
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
    select coalesce(s.error_reason, 'sem_retrato') as motivo
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
$$;

-- 3. competitor_comments_preview (E9; terceiro não é "resposta do criador")
create or replace function public.competitor_comments_preview(p_site uuid, p_channel uuid, p_comment_ids bigint[])
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_alvo bigint[];
  v_todos bigint[];
  v_lotes bigint;
begin
  if p_site is null or p_channel is null or p_comment_ids is null
     or cardinality(p_comment_ids) = 0 or cardinality(p_comment_ids) > 500 then
    raise exception 'competitor_comments_preview: parâmetro inválido';
  end if;
  select coalesce(array_agg(k.id), '{}'::bigint[]) into v_alvo
    from public.competitor_video_comments k
   where k.id = any(p_comment_ids) and k.site_id = p_site
     and k.competitor_channel_id = p_channel and k.missing_since is not null;
  if cardinality(v_alvo) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select coalesce(array_agg(k.id), '{}'::bigint[]) into v_todos
    from public.competitor_video_comments k
   where k.id = any(v_alvo) or k.parent_id = any(v_alvo);
  -- (R8, D-I1) lotes exportados e não apagados do canal; null (nunca 0) quando a tabela da E10 não existe
  if to_regclass('public.obs_archive_batches') is not null then
    select count(distinct b.batch) into v_lotes
      from public.obs_archive_batches b
     where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null;
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'lotes_exportados', v_lotes,
    'encontrados', cardinality(v_alvo),
    -- F2: terceiro não é "resposta do criador"; rows continua contando tudo o que será apagado
    'respostas', (select count(*) from public.competitor_video_comments k
                   where k.id = any(v_todos) and k.is_creator and not (k.id = any(v_alvo))),
    'rows', jsonb_build_object(
      'competitor_video_comments', cardinality(v_todos),
      'competitor_video_comment_marks',
        (select count(*) from public.competitor_video_comment_marks m where m.comment_id = any(v_todos)),
      'competitor_video_comment_authors',
        (select count(*) from public.competitor_video_comment_authors a where a.comment_id = any(v_todos))));
end $$;

-- 4. competitor_comments_purge (E9; não grava id de espectador em competitor_removed_items)
create or replace function public.competitor_comments_purge(
  p_site uuid, p_channel uuid, p_comment_ids bigint[], p_actor uuid, p_ip text, p_ua text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pedidos integer;
  v_alvo bigint[];
  v_todos bigint[];
  v_marcas bigint;
  v_autores bigint;
  v_rows jsonb;
  v_lotes bigint;
begin
  if p_site is null or p_channel is null or p_actor is null or p_comment_ids is null
     or cardinality(p_comment_ids) = 0 or cardinality(p_comment_ids) > 500 then
    raise exception 'competitor_comments_purge: parâmetro inválido';
  end if;
  select count(distinct x) into v_pedidos from unnest(p_comment_ids) x where x is not null;

  select coalesce(array_agg(q.id), '{}'::bigint[]) into v_alvo
    from (select k.id
            from public.competitor_video_comments k
           where k.id = any(p_comment_ids) and k.site_id = p_site
             and k.competitor_channel_id = p_channel and k.missing_since is not null
           order by k.id
             for update) q;
  if cardinality(v_alvo) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if cardinality(v_alvo) <> v_pedidos then
    return jsonb_build_object('status', 'mudou', 'pedidos', v_pedidos, 'encontrados', cardinality(v_alvo));
  end if;

  select coalesce(array_agg(k.id), '{}'::bigint[]) into v_todos
    from public.competitor_video_comments k
   where k.id = any(v_alvo) or k.parent_id = any(v_alvo);
  select count(*) into v_marcas from public.competitor_video_comment_marks m where m.comment_id = any(v_todos);
  select count(*) into v_autores from public.competitor_video_comment_authors a where a.comment_id = any(v_todos);
  v_rows := jsonb_build_object('competitor_video_comments', cardinality(v_todos),
                               'competitor_video_comment_marks', v_marcas,
                               'competitor_video_comment_authors', v_autores);
  -- (R8, D-I1) lotes exportados e não apagados do canal; null (nunca 0) quando a tabela da E10 não existe
  if to_regclass('public.obs_archive_batches') is not null then
    select count(distinct b.batch) into v_lotes
      from public.obs_archive_batches b
     where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null;
  end if;

  insert into public.competitor_removed_items as r
    (site_id, kind, youtube_id, competitor_channel_id, missing_since, decided_at, decided_by, rows_deleted)
  select p_site, 'comentario', a.youtube_comment_id, p_channel, a.missing_since, now(), p_actor,
         jsonb_build_object('competitor_video_comments', 1,
                            'competitor_video_comment_marks', a.marcas,
                            'competitor_video_comment_authors', a.autores)
    from (
      select distinct on (k.youtube_comment_id) k.youtube_comment_id, k.missing_since,
             (select count(*) from public.competitor_video_comment_marks m where m.comment_id = k.id) as marcas,
             (select count(*) from public.competitor_video_comment_authors x where x.comment_id = k.id) as autores
        from public.competitor_video_comments k
       where k.id = any(v_todos)
         and (k.parent_id is null or k.is_creator) -- F2: id de espectador nunca vai para a lista de removidos
       order by k.youtube_comment_id, k.id
    ) a
  on conflict (site_id, kind, youtube_id) do update set
    competitor_channel_id = excluded.competitor_channel_id,
    missing_since = excluded.missing_since,
    decided_at = excluded.decided_at,
    decided_by = excluded.decided_by,
    rows_deleted = public.competitor_jsonb_sum(r.rows_deleted, excluded.rows_deleted),
    purge_count = least(r.purge_count + 1, 32767)::smallint,
    returned_seen_at = null, return_decision = null, return_decided_at = null;

  delete from public.competitor_video_comments k where k.id = any(v_alvo);

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, 'competitor_missing_purge', 'competitor_comment_group', p_channel, s.org_id, p_site,
         jsonb_build_object('kind', 'comentario', 'comentarios', cardinality(v_todos), 'rows_deleted', v_rows),
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_comments_purge: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'apagado', 'comentarios', cardinality(v_todos), 'rows_deleted', v_rows,
                            'lotes_exportados', v_lotes);
end $$;

-- Grants: create or replace mantém os de hoje; reafirma (só service_role executa)
revoke all on function public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_comments_preview(uuid, uuid, bigint[]) from public, anon, authenticated;
grant execute on function public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[]) to service_role;
grant execute on function public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz) to service_role;
grant execute on function public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text) to service_role;
grant execute on function public.competitor_comments_preview(uuid, uuid, bigint[]) to service_role;
