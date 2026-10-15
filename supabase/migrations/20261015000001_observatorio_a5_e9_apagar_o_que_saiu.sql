-- Fase A5 do Observatório, etapa E9 (spec v2.3, arquivo 01, seção 4.5): a fila "Saíram do YouTube".
-- DEPENDE da MG1 (competitor_removed_items, colunas de ausência), da MG2 (competitor_video_early) e da MG8
-- (competitor_video_comments). NÃO altera tabela nem função existente: cria uma tabela pequena e treze funções.
-- Idempotência: create table/index if not exists, create or replace function, drop policy if exists antes de create policy.
-- Código antigo depois desta migration: inerte (ninguém chama as funções; a tabela nova fica vazia).

set lock_timeout = '5s';

do $$
begin
  if to_regclass('public.competitor_removed_items') is null then
    raise exception 'MG-E9 depende da MG1 (competitor_removed_items)';
  end if;
  if to_regclass('public.competitor_video_early') is null then
    raise exception 'MG-E9 depende da MG2 (competitor_video_early)';
  end if;
  if to_regclass('public.competitor_video_comments') is null then
    raise exception 'MG-E9 depende da MG8 (competitor_video_comments)';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O piso da prova "sem resposta o dado fica": quantas linhas o vídeo ausente tinha quando foi visto ausente.
--    Uma linha por vídeo e por episódio de ausência. Estado de conferência, sem conteúdo de terceiros.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_missing_baseline (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  missing_since date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  lines_floor integer not null check (lines_floor >= 0),
  measured_at timestamptz not null,
  primary key (video_id, missing_since)
);
create index if not exists idx_cmb_site on public.competitor_missing_baseline (site_id);
comment on table public.competitor_missing_baseline is 'A5 E9: piso da prova dos ausentes. lines_floor = linhas de série diária, das primeiras horas e de versões do vídeo na 1ª vez em que a prova o viu ausente. Menos linhas que o piso, sem o vídeo ter sido apagado pelo dono, é perda.';
alter table public.competitor_missing_baseline enable row level security;
drop policy if exists "competitor_missing_baseline_select" on public.competitor_missing_baseline;
create policy "competitor_missing_baseline_select" on public.competitor_missing_baseline
  for select using (public.can_edit_site(site_id));
revoke insert, update, delete, truncate on public.competitor_missing_baseline from anon, authenticated;
revoke select on public.competitor_missing_baseline from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Soma de dois objetos de contagem, chave a chave (para apagar o mesmo id pela 2ª vez).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_jsonb_sum(p_a jsonb, p_b jsonb)
returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(t.k, t.v), '{}'::jsonb)
    from (
      select s.k, sum(s.v) as v
        from (
          select e.key as k, (e.value #>> '{}')::numeric as v
            from jsonb_each(coalesce(p_a, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number'
          union all
          select e.key, (e.value #>> '{}')::numeric
            from jsonb_each(coalesce(p_b, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number'
        ) s
       group by s.k
    ) t;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. O que a cascata levaria: linhas por tabela, lidas do CATÁLOGO (toda tabela presa por chave estrangeira
--    "on delete cascade" à raiz, nível 1, e às filhas dela, nível 2). Tabela nova entra sozinha.
--    Onde o catálogo não alcança, LANÇA: contagem menor que a verdade não se devolve.
--    A raiz não entra na contagem (quem chama soma a linha dela).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_cascade_counts(p_root text, p_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_root oid;
  v_out jsonb := '{}'::jsonb;
  v_n bigint;
  v_fundo text;
  v_composta text;
  r record;
begin
  if p_id is null then
    raise exception 'competitor_cascade_counts: id nulo';
  end if;
  v_root := case p_root
              when 'video' then 'public.competitor_videos'::regclass::oid
              when 'canal' then 'public.competitor_channels'::regclass::oid
            end;
  if v_root is null then
    raise exception 'competitor_cascade_counts: raiz desconhecida (%)', coalesce(p_root, 'nulo');
  end if;

  with fk as (
    select k.conrelid as filho, k.confrelid as pai, cardinality(k.conkey) as colunas
      from pg_catalog.pg_constraint k
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  ), n1 as (
    select distinct fk.filho from fk where fk.pai = v_root
  ), n2 as (
    select distinct fk.filho from fk join n1 on n1.filho = fk.pai where fk.filho <> v_root
  ), so2 as (
    select n2.filho from n2 except select n1.filho from n1
  )
  select (select string_agg(distinct fk.filho::regclass::text, ', ') from fk join so2 on so2.filho = fk.pai),
         (select string_agg(distinct fk.filho::regclass::text, ', ') from fk
           where fk.colunas > 1 and (fk.pai = v_root or fk.pai in (select n1.filho from n1)))
    into v_fundo, v_composta;
  if v_fundo is not null then
    raise exception 'competitor_cascade_counts: nível 3 fora da contagem (%)', v_fundo;
  end if;
  if v_composta is not null then
    raise exception 'competitor_cascade_counts: chave composta fora da contagem (%)', v_composta;
  end if;

  for r in
    with fk as (
      select k.conrelid as filho, k.confrelid as pai,
             (select a.attname from pg_catalog.pg_attribute a where a.attrelid = k.conrelid and a.attnum = k.conkey[1]) as col,
             (select a.attname from pg_catalog.pg_attribute a where a.attrelid = k.confrelid and a.attnum = k.confkey[1]) as ref
        from pg_catalog.pg_constraint k
       where k.contype = 'f' and k.confdeltype = 'c' and cardinality(k.conkey) = 1
    ), n1 as (
      select fk.filho, string_agg(format('%I = $1', fk.col), ' or ' order by fk.col) as pred
        from fk
       where fk.pai = v_root and fk.filho <> v_root
       group by fk.filho
    ), n2 as (
      -- inclui a auto-referência de uma filha (a resposta do criador aponta para o comentário): o OR abaixo não conta duas vezes
      select fk.filho,
             string_agg(format('%I in (select %I from %s where %s)', fk.col, fk.ref, fk.pai::regclass, n1.pred), ' or ' order by fk.col) as pred
        from fk join n1 on n1.filho = fk.pai
       where fk.filho <> v_root
       group by fk.filho
    ), todos as (
      select n1.filho, n1.pred from n1
      union all
      select n2.filho, n2.pred from n2
    )
    select t.filho::regclass as tab,
           (select c.relname from pg_catalog.pg_class c where c.oid = t.filho) as nome,
           string_agg('(' || t.pred || ')', ' or ') as pred
      from todos t
     group by t.filho
     order by 2
  loop
    execute format('select count(*) from %s where %s', r.tab, r.pred) into v_n using p_id;
    v_out := v_out || jsonb_build_object(r.nome, v_n);
  end loop;
  return v_out;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. A prévia do painel: o que "apagar" levaria de UM vídeo ou canal deste site. Só lê.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_purge_preview(p_site uuid, p_kind text, p_id uuid, p_janela_min integer)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_yt text;
  v_since date;
  v_rows jsonb;
  v_blobs bigint;
  v_busy bigint;
  v_lotes bigint;
begin
  if p_site is null or p_id is null or p_janela_min is null or p_janela_min not between 1 and 240 then
    raise exception 'competitor_purge_preview: parâmetro inválido';
  end if;
  if p_kind = 'video' then
    select v.video_id, v.missing_since into v_yt, v_since
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where v.id = p_id and c.site_id = p_site;
    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;
    v_rows := public.competitor_cascade_counts('video', p_id) || jsonb_build_object('competitor_videos', 1);
    select count(distinct x.thumb_blob_url) into v_blobs
      from public.competitor_video_versions x
     where x.video_id = p_id and x.thumb_blob_url is not null;
    select count(*) into v_busy
      from public.youtube_intelligence_tasks t
     where t.target_video_id = p_id and t.status = 'running'
       and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  elsif p_kind = 'canal' then
    select c.channel_id, c.missing_since into v_yt, v_since
      from public.competitor_channels c
     where c.id = p_id and c.site_id = p_site;
    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;
    v_rows := public.competitor_cascade_counts('canal', p_id) || jsonb_build_object('competitor_channels', 1);
    select count(distinct x.thumb_blob_url) into v_blobs
      from public.competitor_video_versions x
      join public.competitor_videos v on v.id = x.video_id
     where v.competitor_channel_id = p_id and x.thumb_blob_url is not null;
    select count(*) into v_busy
      from public.youtube_intelligence_tasks t
      join public.competitor_videos v on v.id = t.target_video_id
     where v.competitor_channel_id = p_id and t.status = 'running'
       and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  else
    raise exception 'competitor_purge_preview: tipo desconhecido (%)', coalesce(p_kind, 'nulo');
  end if;
  if to_regclass('public.obs_archive_batches') is not null then
    select count(distinct b.batch) into v_lotes
      from public.obs_archive_batches b
     where b.site_id = p_site and b.deleted_at is null
       and b.channel_ref = (case when p_kind = 'canal' then p_id::text
                                 else (select v.competitor_channel_id::text from public.competitor_videos v where v.id = p_id) end);
  end if;
  return jsonb_build_object('status', 'ok', 'youtube_id', v_yt, 'missing_since', v_since,
                            'rows', v_rows, 'blobs', v_blobs, 'forja_em_andamento', v_busy > 0,
                            'lotes_exportados', v_lotes);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. (emenda 1: D-I3) A prévia do grupo de comentários, com a MESMA regra do apagar: os pedidos e as respostas
--     presas a eles (parent_id), com as marcas e as identidades de todos. Só lê.
-- ─────────────────────────────────────────────────────────────────────────────
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
    'respostas', cardinality(v_todos) - cardinality(v_alvo),
    'rows', jsonb_build_object(
      'competitor_video_comments', cardinality(v_todos),
      'competitor_video_comment_marks',
        (select count(*) from public.competitor_video_comment_marks m where m.comment_id = any(v_todos)),
      'competitor_video_comment_authors',
        (select count(*) from public.competitor_video_comment_authors a where a.comment_id = any(v_todos))));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Apagar UM vídeo que saiu do YouTube. Uma transação: trava, recusa, conta, apaga, registra, audita.
--    Devolve status: 'apagado' | 'not_found' | 'no_ar' | 'forja_em_andamento'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_video_purge(
  p_site uuid, p_video uuid, p_actor uuid, p_janela_min integer, p_ip text, p_ua text
) returns jsonb
-- (emenda 1: D-I4 e S-I6) teto próprio na DEFINIÇÃO: dentro do corpo não adianta (o relógio do comando já está armado)
language plpgsql security invoker set search_path = '' set statement_timeout = '30s' as $$
declare
  v_yt text;
  v_channel uuid;
  v_since date;
  v_rows jsonb;
  v_blobs text[];
  v_busy bigint;
  v_item bigint;
  v_purge smallint;
  v_lotes bigint;
begin
  if p_site is null or p_video is null or p_actor is null
     or p_janela_min is null or p_janela_min not between 1 and 240 then
    raise exception 'competitor_video_purge: parâmetro inválido';
  end if;

  -- 1. a linha do vídeo, deste site, travada: ninguém insere filha nova nem a atualiza até o fim
  select v.video_id, v.competitor_channel_id, v.missing_since into v_yt, v_channel, v_since
    from public.competitor_videos v
    join public.competitor_channels c on c.id = v.competitor_channel_id
   where v.id = p_video and c.site_id = p_site
     for update of v;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_since is null then
    return jsonb_build_object('status', 'no_ar');
  end if;

  -- 2. a forja: trava TODAS as tarefas do vídeo; um claim concorrente espera aqui e depois não acha a linha
  perform 1 from public.youtube_intelligence_tasks t
    where t.target_video_id = p_video order by t.id for update;
  select count(*) into v_busy
    from public.youtube_intelligence_tasks t
   where t.target_video_id = p_video and t.status = 'running'
     and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  if v_busy > 0 then
    return jsonb_build_object('status', 'forja_em_andamento', 'tarefas', v_busy, 'janela_min', p_janela_min);
  end if;

  -- 3. a contagem e os arquivos, com a linha travada
  v_rows := public.competitor_cascade_counts('video', p_video) || jsonb_build_object('competitor_videos', 1);
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_blobs
    from public.competitor_video_versions x
   where x.video_id = p_video and x.thumb_blob_url is not null;
  v_blobs := v_blobs || array['observatorio/thumbs/' || p_video::text || '/'];
  -- (R8, D-I1) lotes exportados e não apagados do canal; null (nunca 0) quando a tabela da E10 não existe
  if to_regclass('public.obs_archive_batches') is not null then
    select count(distinct b.batch) into v_lotes
      from public.obs_archive_batches b
     where b.site_id = p_site and b.channel_ref = v_channel::text and b.deleted_at is null;
  end if;

  -- 4. apaga (as filhas vão por cascata) e grava a linha sem conteúdo
  delete from public.competitor_videos v where v.id = p_video;

  insert into public.competitor_removed_items as r
    (site_id, kind, youtube_id, competitor_channel_id, missing_since, decided_at, decided_by, rows_deleted, blobs_pending, archive_pending)
  values (p_site, 'video', v_yt, v_channel, v_since, now(), p_actor, v_rows, v_blobs, false)
  on conflict (site_id, kind, youtube_id) do update set
    competitor_channel_id = excluded.competitor_channel_id,
    missing_since = excluded.missing_since,
    decided_at = excluded.decided_at,
    decided_by = excluded.decided_by,
    rows_deleted = public.competitor_jsonb_sum(r.rows_deleted, excluded.rows_deleted),
    blobs_pending = (select coalesce(array_agg(distinct b order by b), '{}'::text[])
                       from unnest(r.blobs_pending || excluded.blobs_pending) b),
    purge_count = least(r.purge_count + 1, 32767)::smallint,
    returned_seen_at = null, return_decision = null, return_decided_at = null
  returning r.id, r.purge_count into v_item, v_purge;

  -- 5. a auditoria, na mesma transação. Sem título, sem descrição, sem texto: código, datas e contagens.
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, 'competitor_missing_purge', 'competitor_video', p_video, s.org_id, p_site,
         jsonb_build_object('kind', 'video', 'youtube_id', v_yt, 'missing_since', v_since,
                            'rows_deleted', v_rows, 'blobs', cardinality(v_blobs), 'purge_count', v_purge),
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_video_purge: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'apagado', 'item_id', v_item, 'youtube_id', v_yt,
                            'rows_deleted', v_rows, 'blobs', to_jsonb(v_blobs), 'purge_count', v_purge,
                            'lotes_exportados', v_lotes);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Apagar UM canal inteiro que saiu do YouTube (um item, não um por vídeo). Mesma ordem do vídeo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_channel_purge(
  p_site uuid, p_channel uuid, p_actor uuid, p_janela_min integer, p_ip text, p_ua text
) returns jsonb
-- (emenda 1: D-I4 e S-I6) teto próprio na DEFINIÇÃO, como no vídeo
language plpgsql security invoker set search_path = '' set statement_timeout = '30s' as $$
declare
  v_yt text;
  v_since date;
  v_rows jsonb;
  v_blobs text[];
  v_busy bigint;
  v_item bigint;
  v_purge smallint;
  v_lotes bigint;
begin
  if p_site is null or p_channel is null or p_actor is null
     or p_janela_min is null or p_janela_min not between 1 and 240 then
    raise exception 'competitor_channel_purge: parâmetro inválido';
  end if;

  select c.channel_id, c.missing_since into v_yt, v_since
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_since is null then
    return jsonb_build_object('status', 'no_ar');
  end if;

  perform 1 from public.competitor_videos v
    where v.competitor_channel_id = p_channel order by v.id for update;
  perform 1 from public.youtube_intelligence_tasks t
    where t.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)
    order by t.id for update;
  select count(*) into v_busy
    from public.youtube_intelligence_tasks t
    join public.competitor_videos v on v.id = t.target_video_id
   where v.competitor_channel_id = p_channel and t.status = 'running'
     and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  if v_busy > 0 then
    return jsonb_build_object('status', 'forja_em_andamento', 'tarefas', v_busy, 'janela_min', p_janela_min);
  end if;

  v_rows := public.competitor_cascade_counts('canal', p_channel) || jsonb_build_object('competitor_channels', 1);
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_blobs
    from public.competitor_video_versions x
    join public.competitor_videos v on v.id = x.video_id
   where v.competitor_channel_id = p_channel and x.thumb_blob_url is not null;
  v_blobs := v_blobs || coalesce(
    (select array_agg('observatorio/thumbs/' || v.id::text || '/' order by v.id)
       from public.competitor_videos v where v.competitor_channel_id = p_channel), '{}'::text[]);

  -- (R8, D-I1) lotes exportados e não apagados do canal; null (nunca 0) quando a tabela da E10 não existe
  if to_regclass('public.obs_archive_batches') is not null then
    select count(distinct b.batch) into v_lotes
      from public.obs_archive_batches b
     where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null;
  end if;

  -- (M9, aviso de 15/10) Com a M3b em produção, o gatilho obs_archive_z_destino_declarado recusa o delete de canal
  -- sem destino declarado: quem declara e apaga é competitor_channel_remove(..., 'apagar', 'fila', ator).
  -- Antes da M3b a função não existe e o delete direto continua valendo (mesma transação, mesmo efeito).
  if to_regprocedure('public.competitor_channel_remove(uuid,uuid,text,text,uuid)') is not null then
    perform public.competitor_channel_remove(p_site, p_channel, 'apagar', 'fila', p_actor);
  else
    delete from public.competitor_channels c where c.id = p_channel;
  end if;
  -- (R8, D-I1b) o lote aberto de um canal que deixou de existir não pode ficar "exportado e não confirmado" para sempre
  if to_regclass('public.obs_archive_batches') is not null then
    update public.obs_archive_batches b
       set closed_at = now(), closed_reason = 'canal_apagado'
     where b.site_id = p_site and b.channel_ref = p_channel::text and b.closed_at is null;
  end if;

  insert into public.competitor_removed_items as r
    (site_id, kind, youtube_id, competitor_channel_id, missing_since, decided_at, decided_by, rows_deleted, blobs_pending, archive_pending)
  values (p_site, 'canal', v_yt, p_channel, v_since, now(), p_actor, v_rows, v_blobs, false)
  on conflict (site_id, kind, youtube_id) do update set
    competitor_channel_id = excluded.competitor_channel_id,
    missing_since = excluded.missing_since,
    decided_at = excluded.decided_at,
    decided_by = excluded.decided_by,
    rows_deleted = public.competitor_jsonb_sum(r.rows_deleted, excluded.rows_deleted),
    blobs_pending = (select coalesce(array_agg(distinct b order by b), '{}'::text[])
                       from unnest(r.blobs_pending || excluded.blobs_pending) b),
    purge_count = least(r.purge_count + 1, 32767)::smallint,
    returned_seen_at = null, return_decision = null, return_decided_at = null
  returning r.id, r.purge_count into v_item, v_purge;

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, 'competitor_missing_purge', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('kind', 'canal', 'youtube_id', v_yt, 'missing_since', v_since,
                            'rows_deleted', v_rows, 'blobs', cardinality(v_blobs), 'purge_count', v_purge),
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_channel_purge: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'apagado', 'item_id', v_item, 'youtube_id', v_yt,
                            'rows_deleted', v_rows, 'blobs', to_jsonb(v_blobs), 'purge_count', v_purge,
                            'lotes_exportados', v_lotes);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Apagar os comentários que o painel MOSTROU (de um canal). Tudo o que foi pedido, ou nada ('mudou').
--    Leva a resposta do criador (cascata), as identidades e as marcas. Sobra uma linha por comentário, só com o id.
--    A auditoria NÃO leva id de comentário (dado sensível): só contagens.
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Manter para análise. Só alcança o que está ausente, sem decisão, e é deste site.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_missing_keep(
  p_site uuid, p_kind text, p_ids uuid[], p_comment_ids bigint[], p_actor uuid, p_ip text, p_ua text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
  v_n integer := 0;
begin
  if p_site is null or p_actor is null then
    raise exception 'competitor_missing_keep: parâmetro nulo';
  end if;
  select s.org_id into v_org from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_missing_keep: site desconhecido';
  end if;

  if p_kind = 'video' then
    with up as (
      update public.competitor_videos v
         set removal_decision = 'manter', removal_decided_at = now(), removal_decided_by = p_actor
        from public.competitor_channels c
       where c.id = v.competitor_channel_id and c.site_id = p_site
         and v.id = any(coalesce(p_ids, '{}'::uuid[]))
         and v.missing_since is not null and v.removal_decision is null
      returning v.id, v.video_id, v.missing_since
    ), au as (
      insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
      select p_actor, 'competitor_missing_keep', 'competitor_video', up.id, v_org, p_site,
             jsonb_build_object('kind', 'video', 'youtube_id', up.video_id, 'missing_since', up.missing_since),
             p_ip::inet, nullif(p_ua, '')
        from up
      returning 1
    )
    select count(*) into v_n from au;
  elsif p_kind = 'canal' then
    with up as (
      update public.competitor_channels c
         set removal_decision = 'manter', removal_decided_at = now(), removal_decided_by = p_actor
       where c.site_id = p_site and c.id = any(coalesce(p_ids, '{}'::uuid[]))
         and c.missing_since is not null and c.removal_decision is null
      returning c.id, c.channel_id, c.missing_since
    ), au as (
      insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
      select p_actor, 'competitor_missing_keep', 'competitor_channel', up.id, v_org, p_site,
             jsonb_build_object('kind', 'canal', 'youtube_id', up.channel_id, 'missing_since', up.missing_since),
             p_ip::inet, nullif(p_ua, '')
        from up
      returning 1
    )
    select count(*) into v_n from au;
  elsif p_kind = 'comentario' then
    with up as (
      update public.competitor_video_comments k
         set removal_decision = 'manter', removal_decided_at = now(), removal_decided_by = p_actor
       where k.site_id = p_site and k.id = any(coalesce(p_comment_ids, '{}'::bigint[]))
         and k.missing_since is not null and k.removal_decision is null
      returning 1
    )
    select count(*) into v_n from up;
    if v_n > 0 then
      insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
      values (p_actor, 'competitor_missing_keep', 'competitor_comment_group', null, v_org, p_site,
              jsonb_build_object('kind', 'comentario', 'comentarios', v_n), p_ip::inet, nullif(p_ua, ''));
    end if;
  else
    raise exception 'competitor_missing_keep: tipo desconhecido (%)', coalesce(p_kind, 'nulo');
  end if;

  return jsonb_build_object('status', case when v_n > 0 then 'mantido' else 'nada' end, 'mantidos', v_n);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. A resposta a "voltou ao ar; voltar a acompanhar?". Comentário só aceita 'ignorar'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_return_decide(
  p_site uuid, p_item bigint, p_decision text, p_actor uuid, p_ip text, p_ua text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_kind text;
  v_yt text;
begin
  if p_site is null or p_item is null or p_actor is null then
    raise exception 'competitor_return_decide: parâmetro nulo';
  end if;
  if p_decision is null or p_decision not in ('voltar', 'ignorar') then
    raise exception 'competitor_return_decide: decisão desconhecida (%)', coalesce(p_decision, 'nulo');
  end if;

  update public.competitor_removed_items r
     set return_decision = p_decision, return_decided_at = now()
   where r.id = p_item and r.site_id = p_site
     and r.returned_seen_at is not null and r.return_decision is null
     and (p_decision = 'ignorar' or r.kind in ('video', 'canal'))
  returning r.kind, r.youtube_id into v_kind, v_yt;
  if not found then
    return jsonb_build_object('status', 'nada');
  end if;

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, case p_decision when 'voltar' then 'competitor_return_follow' else 'competitor_return_ignore' end,
         'competitor_removed_item', null, s.org_id, p_site,
         jsonb_build_object('kind', v_kind, 'item_id', p_item)
           || case when v_kind = 'comentario' then '{}'::jsonb else jsonb_build_object('youtube_id', v_yt) end,
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_return_decide: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'ok', 'kind', v_kind, 'decision', p_decision);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Tirar de blobs_pending o que o Blob confirmou apagado. Atômica: o cron e o clique não se atropelam.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_removed_blobs_done(p_site uuid, p_item bigint, p_done text[])
returns jsonb
language sql security invoker set search_path = '' as $$
  with up as (
    update public.competitor_removed_items r
       set blobs_pending = coalesce(
             (select array_agg(b order by b) from unnest(r.blobs_pending) b
               where b <> all(coalesce(p_done, '{}'::text[]))), '{}'::text[])
     where r.id = p_item and r.site_id = p_site
    returning cardinality(r.blobs_pending) as restam
  )
  select coalesce((select jsonb_build_object('status', 'ok', 'restam', up.restam) from up),
                  jsonb_build_object('status', 'not_found'));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. A prova "sem resposta o dado fica", lida pelo cron de concorrentes a cada disparo.
--     Grava o piso de cada vídeo ausente na 1ª vez; depois, menos linhas que o piso = queda.
--     Vídeo de canal ausente entra, com a data do canal.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_missing_proof(p_site uuid, p_now timestamptz)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_out jsonb;
  v_hoje date;
begin
  if p_site is null or p_now is null then
    raise exception 'competitor_missing_proof: parâmetro nulo';
  end if;
  v_hoje := (p_now at time zone 'America/Sao_Paulo')::date;

  -- (emenda 1: D-M4 e S-m5) um "apagar" do mesmo vídeo que confirma enquanto o piso é inserido faz a inserção falhar por
  -- chave estrangeira. Não é perda: tenta de novo (a leitura seguinte já não vê o vídeo).
  -- (emenda 2: N3) "apagar canal" trava os vídeos em ordem de id: o piso é inserido na MESMA ordem (order by a.id), para as
  -- duas transações não se esperarem em círculo; se ainda assim houver impasse (40P01), é tratado como a falha de chave.
  -- São 3 tentativas: um impasse seguido de uma falha de chave (o apagar que confirma) gasta duas. A 3ª falha sobe.
  for v_try in 1..3 loop
  begin
  with aus as (
    select v.id, coalesce(v.missing_since, c.missing_since) as desde,
           (select count(*) from public.competitor_video_daily d where d.video_id = v.id)
         + (select count(*) from public.competitor_video_early e where e.video_id = v.id)
         + (select count(*) from public.competitor_video_versions x where x.video_id = v.id) as linhas,
           (select count(*) from public.competitor_video_versions x
             where x.video_id = v.id and x.thumb_blob_url is not null) as miniaturas
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site and (v.missing_since is not null or c.missing_since is not null)
  ), ant as (
    select a.id, a.desde, a.linhas, a.miniaturas, b.lines_floor
      from aus a
      left join public.competitor_missing_baseline b on b.video_id = a.id and b.missing_since = a.desde
  ), grava as (
    insert into public.competitor_missing_baseline (video_id, missing_since, site_id, lines_floor, measured_at)
    select a.id, a.desde, p_site, a.linhas, p_now from ant a where a.lines_floor is null
     order by a.id
    on conflict (video_id, missing_since) do nothing
    returning 1
  ), esp as (
    select v.missing_since as desde
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site and v.missing_since is not null and v.removal_decision is null and c.missing_since is null
    union all
    select c.missing_since
      from public.competitor_channels c
     where c.site_id = p_site and c.missing_since is not null and c.removal_decision is null
    union all
    select min(k.missing_since)
      from public.competitor_video_comments k
      join public.competitor_videos v on v.id = k.video_id
      join public.competitor_channels c on c.id = k.competitor_channel_id
     where k.site_id = p_site and k.missing_since is not null and k.removal_decision is null
       and v.missing_since is null and c.missing_since is null
     group by k.competitor_channel_id
  )
  select jsonb_build_object(
    'videos_ausentes', (select count(*) from ant),
    'linhas_de_ausentes', (select coalesce(sum(ant.linhas), 0) from ant),
    'miniaturas_de_ausentes', (select coalesce(sum(ant.miniaturas), 0) from ant),
    'ausentes_com_queda', (select count(*) from ant where ant.lines_floor is not null and ant.linhas < ant.lines_floor),
    'pisos_novos', (select count(*) from grava),
    'esperando', (select count(*) from esp),
    'mais_antigo_dias', (select v_hoje - min(esp.desde) from esp),
    'apagando', (select count(*) from public.competitor_removed_items r
                  where r.site_id = p_site and (cardinality(r.blobs_pending) > 0 or r.archive_pending)),
    -- (M9, aviso de 15/10) só o Blob: o arquivo tem tempo próprio (peça de pendências da manutenção), a fila não acusa por ele
    'apagando_ha_mais_de_1d', (select count(*) from public.competitor_removed_items r
                                where r.site_id = p_site and cardinality(r.blobs_pending) > 0
                                  and r.decided_at < p_now - interval '1 day'),
    'voltaram_sem_resposta', (select count(*) from public.competitor_removed_items r
                               where r.site_id = p_site and r.returned_seen_at is not null and r.return_decision is null)
  ) into v_out;
  exit;
  exception when foreign_key_violation or deadlock_detected then
    if v_try = 3 then
      raise;
    end if;
  end;
  end loop;
  return v_out;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. O número da aba: o que espera resposta + o que está apagando + o que voltou sem resposta. Só lê.
--     Vídeo de canal ausente não conta solto (o canal é um item); comentários contam um grupo por canal.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_missing_count(p_site uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'videos', (select count(*) from public.competitor_videos v
                 join public.competitor_channels c on c.id = v.competitor_channel_id
                where c.site_id = p_site and v.missing_since is not null
                  and v.removal_decision is null and c.missing_since is null),
    'canais', (select count(*) from public.competitor_channels c
                where c.site_id = p_site and c.missing_since is not null and c.removal_decision is null),
    'grupos_de_comentarios', (select count(distinct k.competitor_channel_id)
                                from public.competitor_video_comments k
                                join public.competitor_videos v on v.id = k.video_id
                                join public.competitor_channels c on c.id = k.competitor_channel_id
                               where k.site_id = p_site and k.missing_since is not null and k.removal_decision is null
                                 and v.missing_since is null and c.missing_since is null),
    'apagando', (select count(*) from public.competitor_removed_items r
                  where r.site_id = p_site and (cardinality(r.blobs_pending) > 0 or r.archive_pending)),
    -- (emenda 1: D-M9 e D-M10) cada linha conta uma vez: a que ainda está apagando não entra aqui; comentários contam um por canal
    'voltaram', (select count(*) from public.competitor_removed_items r
                  where r.site_id = p_site and r.kind in ('video', 'canal')
                    and r.returned_seen_at is not null and r.return_decision is null
                    and cardinality(r.blobs_pending) = 0 and not r.archive_pending)
              + (select count(distinct r.competitor_channel_id) from public.competitor_removed_items r
                  where r.site_id = p_site and r.kind = 'comentario'
                    and r.returned_seen_at is not null and r.return_decision is null));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12b. (emenda 1: D-I2) Comentários já apagados, um objeto por canal: a tela mostra a contagem sem trazer as linhas
--      (são uma por comentário e passam do teto de linhas da API). Só lê; não devolve id de comentário.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_removed_comment_groups(p_site uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
                    'competitor_channel_id', g.competitor_channel_id,
                    'comentarios', g.n,
                    'decided_at', g.decided_at) order by g.decided_at desc), '[]'::jsonb)
    from (select r.competitor_channel_id, count(*) as n, max(r.decided_at) as decided_at
            from public.competitor_removed_items r
           where r.site_id = p_site and r.kind = 'comentario'
           group by r.competitor_channel_id) g;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Quem executa: só service_role.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.competitor_jsonb_sum(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_cascade_counts(text, uuid) from public, anon, authenticated;
revoke all on function public.competitor_purge_preview(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.competitor_video_purge(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.competitor_channel_purge(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_missing_keep(uuid, text, uuid[], bigint[], uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_return_decide(uuid, bigint, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_removed_blobs_done(uuid, bigint, text[]) from public, anon, authenticated;
revoke all on function public.competitor_missing_proof(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_missing_count(uuid) from public, anon, authenticated;
revoke all on function public.competitor_comments_preview(uuid, uuid, bigint[]) from public, anon, authenticated;
revoke all on function public.competitor_removed_comment_groups(uuid) from public, anon, authenticated;
grant execute on function public.competitor_jsonb_sum(jsonb, jsonb) to service_role;
grant execute on function public.competitor_cascade_counts(text, uuid) to service_role;
grant execute on function public.competitor_purge_preview(uuid, text, uuid, integer) to service_role;
grant execute on function public.competitor_video_purge(uuid, uuid, uuid, integer, text, text) to service_role;
grant execute on function public.competitor_channel_purge(uuid, uuid, uuid, integer, text, text) to service_role;
grant execute on function public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text) to service_role;
grant execute on function public.competitor_missing_keep(uuid, text, uuid[], bigint[], uuid, text, text) to service_role;
grant execute on function public.competitor_return_decide(uuid, bigint, text, uuid, text, text) to service_role;
grant execute on function public.competitor_removed_blobs_done(uuid, bigint, text[]) to service_role;
grant execute on function public.competitor_missing_proof(uuid, timestamptz) to service_role;
grant execute on function public.competitor_missing_count(uuid) to service_role;
grant execute on function public.competitor_comments_preview(uuid, uuid, bigint[]) to service_role;
grant execute on function public.competitor_removed_comment_groups(uuid) to service_role;

reset lock_timeout;
