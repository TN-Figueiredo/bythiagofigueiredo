-- =============================================================================
-- MIGRATION MG8: observatorio_a5_e14_comentarios_de_destaque
-- =============================================================================
-- Fase A5 do Observatório, etapa E14 (spec v2.3, arquivo 02, seção 4.6). DEPENDE da MG1 (competitor_removed_items com
-- 'comentario' no check de kind; missing_since e live_* em competitor_videos). NÃO depende da MG10 nem da MG9.
-- O que traz: o retrato dos comentários por vídeo e marco (1, 7 e 30 dias), o comentário (texto da última leitura),
-- a leitura por marco, a IDENTIDADE do autor em tabela própria com prazo (28 dias), a escrita atômica do retrato,
-- a rotina que apaga a identidade vencida, a lista do que está devido, a prova embutida e a contagem para remoção.
--
-- Idempotência: create table/index if not exists, create or replace function, drop policy if exists antes de create
-- policy. Rodar duas vezes não muda nada. Compatibilidade: só cria objeto novo; nenhuma tabela, coluna ou função
-- existente é alterada. O código que está em main não lê nem grava nada daqui.
-- NÃO recria competitor_channel_removal_impact nem youtube_channel_removal_impact (decisão R1 do controlador: essas duas
-- têm um corpo só, por catálogo, e o dono do texto é o plano das ordens 8 e 10). Nenhuma das quatro tabelas tem FK para
-- youtube_channels. Lote B, depois da MG10 e da MG9 (não depende delas em SQL).

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O retrato: uma linha por vídeo e marco. Sem linha = "não coletado".
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comment_snaps (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  mark smallint not null check (mark in (0, 1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  taken_at timestamptz not null,
  video_age_hours numeric not null,
  status text not null check (status in ('ok', 'sem_comentarios', 'desligados', 'erro')),
  error_reason text,
  pool_size smallint,
  pool_complete boolean,
  video_comment_count bigint,
  selected_count smallint,
  featured_lookup_n smallint,
  featured_unknown_n smallint,
  rule_version smallint not null,
  rule_params jsonb not null,
  units_used smallint not null,
  pool_stats jsonb,
  primary key (video_id, mark),
  constraint competitor_video_comment_snaps_reason_check check ((status = 'erro') = (error_reason is not null)),
  constraint competitor_video_comment_snaps_reason_format_check check (error_reason is null or error_reason ~ '^[a-z0-9_]{1,40}$'),
  constraint competitor_video_comment_snaps_pool_stats_check check (pool_stats is null or (jsonb_typeof(pool_stats) = 'object' and octet_length(pool_stats::text) <= 2000))
);
create index if not exists idx_cvcs_channel_taken on public.competitor_video_comment_snaps (competitor_channel_id, taken_at);
comment on table public.competitor_video_comment_snaps is 'A5 E14: retrato dos comentários de um vídeo de concorrente numa idade (marco 1, 7 ou 30 dias). A linha separa ok, sem_comentarios, desligados e erro; sem linha = não coletado.';
comment on column public.competitor_video_comment_snaps.error_reason is 'CÓDIGO de um catálogo fechado (o check só aceita letras minúsculas, algarismos e _ até 40): nunca texto vindo da API nem do banco. A frase que o dono lê sai de uma função do código, a partir do código. Só com status = erro.';
comment on column public.competitor_video_comment_snaps.video_age_hours is 'Idade do vídeo no retrato, CALCULADA PELO BANCO (taken_at menos o maior entre published_at e live_actual_start_at). O valor mandado por quem chama é ignorado.';
comment on column public.competitor_video_comment_snaps.pool_stats is 'Agregados do lote lido (até 100 conversas) que NÃO é guardado: só números e sim/não (a função recusa texto, lista e objeto). Nenhum texto, nome ou id. Nulo = retrato sem lote.';
comment on column public.competitor_video_comment_snaps.featured_lookup_n is 'Autores consultados em channels.list neste retrato (0 a 20). Nulo = a consulta falhou.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O comentário: uma linha por comentário guardado; o texto é o da última leitura. SEM identidade do autor.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comments (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  youtube_comment_id text not null,
  parent_id bigint references public.competitor_video_comments(id) on delete cascade,
  body text not null,
  body_truncated boolean not null default false,
  published_at timestamptz not null,
  edited_at timestamptz,
  is_creator boolean not null,
  creator_replied boolean,
  featured_reason text check (featured_reason in ('canal_acompanhado', 'inscritos', 'canal_proprio')),
  featured_channel_id uuid references public.competitor_channels(id) on delete set null,
  featured_size_band text check (featured_size_band in ('100k_1m', '1m_10m', '10m_mais')),
  featured_ratio_band text check (featured_ratio_band in ('10x_100x', '100x_1000x', '1000x_mais')),
  author_purged_at timestamptz,
  last_checked_at timestamptz,
  miss_streak smallint not null default 0,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since date,
  removal_decision text check (removal_decision in ('manter')),
  removal_decided_at timestamptz,
  removal_decided_by uuid,
  unique (video_id, youtube_comment_id),
  constraint competitor_video_comments_bands_check check ((featured_size_band is null and featured_ratio_band is null) or featured_reason = 'inscritos'),
  constraint competitor_video_comments_featured_channel_check check (featured_channel_id is null or featured_reason = 'canal_acompanhado'),
  constraint competitor_video_comments_reply_check check (parent_id is null or is_creator)
);
create index if not exists idx_cvc_channel on public.competitor_video_comments (competitor_channel_id, first_seen_at);
create index if not exists idx_cvc_missing on public.competitor_video_comments (site_id, missing_since) where missing_since is not null and removal_decision is null;
create index if not exists idx_cvc_parent on public.competitor_video_comments (parent_id) where parent_id is not null;
create index if not exists idx_cvc_featured_channel on public.competitor_video_comments (featured_channel_id) where featured_channel_id is not null;
comment on table public.competitor_video_comments is 'A5 E14: comentário de destaque guardado (texto de terceiros, risco aceito pelo dono). A identidade do autor NÃO fica aqui: está em competitor_video_comment_authors, com prazo.';
comment on column public.competitor_video_comments.parent_id is 'Nulo = comentário de topo. Preenchido = resposta DO CRIADOR a ele (o check impede resposta de outra pessoa).';
comment on column public.competitor_video_comments.creator_replied is 'Só no topo. true = há resposta do canal do vídeo entre as vistas; false = todas as respostas foram vistas e nenhuma é dele; nulo = não se sabe.';
comment on column public.competitor_video_comments.author_purged_at is 'Preenchido pela rotina de anulação. A escrita nunca regrava identidade de comentário que já existia.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. A identidade do autor, com prazo. Uma linha por comentário de quem NÃO é o criador; apagada aos 28 dias.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comment_authors (
  comment_id bigint primary key references public.competitor_video_comments(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  display_name text,
  channel_id text,
  avatar_url text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cvca_due on public.competitor_video_comment_authors (expires_at);
comment on table public.competitor_video_comment_authors is 'A5 E14: nome, id do canal e URL da foto do autor de um comentário. Dado pessoal de terceiros: só quem edita lê; a linha é APAGADA quando expires_at vence (competitor_comment_identity_purge).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A leitura: uma linha por comentário e marco.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_comment_marks (
  comment_id bigint not null references public.competitor_video_comments(id) on delete cascade,
  mark smallint not null check (mark in (0, 1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  likes integer not null,
  reply_count integer,
  relevance_rank smallint,
  slot text check (slot in ('criador', 'destaque', 'curtidos')),
  creator_replied boolean,
  primary key (comment_id, mark)
);
comment on column public.competitor_video_comment_marks.relevance_rank is 'Posição 1 a 100 no lote. Nulo = fora do lote, lido por id.';
comment on column public.competitor_video_comment_marks.creator_replied is 'O que ESTA leitura viu (true, false ou nulo = não se sabe), sem a regra de "sim não vira não se sabe" da coluna de mesmo nome do comentário. Só no topo lido no lote.';
comment on column public.competitor_video_comment_marks.slot is 'Grupo pelo qual foi escolhido neste marco. Nulo = não escolhido (lido só para acompanhar).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS. Nenhuma policy de escrita (só service_role).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.competitor_video_comment_snaps enable row level security;
alter table public.competitor_video_comments enable row level security;
alter table public.competitor_video_comment_marks enable row level security;
alter table public.competitor_video_comment_authors enable row level security;

drop policy if exists "competitor_video_comment_snaps_select" on public.competitor_video_comment_snaps;
create policy "competitor_video_comment_snaps_select" on public.competitor_video_comment_snaps
  for select using (public.can_view_site(site_id));

-- O texto e as leituras: quem tem o direito "ver desempenho privado" (MG11) ou edita. Se a MG11 ainda não existe,
-- nasce em can_edit_site e a MG11 troca (ela procura as policies pelo nome <tabela>_select).
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['competitor_video_comments', 'competitor_video_comment_marks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
  end loop;
end $$;

-- A identidade: SEMPRE só quem edita. Fica fora do bloco acima e a MG11 não a troca.
drop policy if exists "competitor_video_comment_authors_select" on public.competitor_video_comment_authors;
create policy "competitor_video_comment_authors_select" on public.competitor_video_comment_authors
  for select using (public.can_edit_site(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. A escrita atômica do retrato: o retrato, os comentários, as leituras, a identidade e as ausências, numa transação.
-- ─────────────────────────────────────────────────────────────────────────────
-- p_snap: { taken_at, from_h, until_h (a tolerância do marco: OBRIGATÓRIOS), status, error_reason, pool_size, pool_complete,
--           video_comment_count, selected_count, featured_lookup_n, featured_unknown_n, rule_version, rule_params, units_used,
--           pool_stats (objeto só de números e sim/não, ou ausente), identity_days (padrão 28), creator_replies_max (padrão 3) }
--           A idade do vídeo NÃO vem de quem chama: o banco calcula de taken_at e recusa o retrato fora da tolerância.
-- p_comments: lista de { youtube_comment_id, parent_youtube_id (nulo = topo), via ('lote' | 'id'), body, body_truncated,
--           published_at, edited_at, is_creator, creator_replied, featured_reason, featured_channel_id,
--           featured_size_band, featured_ratio_band, author { display_name, channel_id, avatar_url } | null,
--           likes, reply_count, relevance_rank, slot }
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
  with ids as (select x->>'youtube_comment_id' as yid from jsonb_array_elements(v_comments) x)
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
     where x.parent_youtube_id is not null and coalesce(x.via, 'lote') = 'lote' and x.is_creator is true
       and x.youtube_comment_id is not null and x.body is not null and x.likes is not null
  ), up as (
    update public.competitor_video_comments c set
      body = i.body, body_truncated = coalesce(i.body_truncated, false), edited_at = i.edited_at,
      last_checked_at = v_taken, last_seen_at = v_taken, miss_streak = 0, missing_since = null
      from inp i
     where c.video_id = p_video and c.youtube_comment_id = i.youtube_comment_id and c.parent_id is not null
    returning c.id, c.youtube_comment_id
  ), mk as (
    insert into public.competitor_video_comment_marks as m (comment_id, mark, site_id, likes, reply_count, relevance_rank, slot)
    select u.id, p_mark, v_site, i.likes, null, null, null
      from up u join inp i on i.youtube_comment_id = u.youtube_comment_id
    on conflict (comment_id, mark) do update set likes = excluded.likes
    returning 1
  )
  select (select count(*) from up), (select count(*) from mk) into n1, n2;
  v_resp_atualizadas := n1; v_leituras := v_leituras + n2;

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
           (select count(*) from public.competitor_video_comments k where k.parent_id = p.id) as ja
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
  with seen as (
    select x->>'youtube_comment_id' as yid from jsonb_array_elements(v_comments) x
  ), up as (
    update public.competitor_video_comments c set
      last_checked_at = v_taken,
      miss_streak = least(c.miss_streak + 1, 32767),
      missing_since = case when c.missing_since is null and (c.miss_streak + 1 >= 2 or p_mark = 30)
                           then (v_taken at time zone 'America/Sao_Paulo')::date else c.missing_since end
     where c.video_id = p_video and c.youtube_comment_id = any(coalesce(p_missing, '{}'))
       and c.youtube_comment_id not in (select yid from seen where yid is not null)
    returning (c.missing_since is not null) as marcado
  )
  select count(*), count(*) filter (where marcado) into n1, n2 from up;
  v_ausentes := n1; v_marcados := n2;

  v_ignorados := v_recebidos - (v_novos + v_atualizados + v_por_id + v_resp_novas + v_resp_atualizadas);

  return jsonb_build_object(
    'status', 'gravado', 'retrato', v_status, 'recebidos', v_recebidos,
    'comentarios_novos', v_novos, 'comentarios_atualizados', v_atualizados, 'achados_por_id', v_por_id,
    'respostas_novas', v_resp_novas, 'respostas_atualizadas', v_resp_atualizadas,
    'identidades', v_identidades, 'leituras', v_leituras,
    'ausentes', v_ausentes, 'ausentes_marcados', v_marcados, 'nao_gravados', v_ignorados);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. A rotina: apaga a identidade vencida e carimba o comentário, numa instrução. Sem parâmetro de relógio de
--    propósito: ninguém consegue apagar antes da hora nem "adiantar" o prazo.
--    p_site_id nulo = todos os sites (é como a agenda chama, SEMPRE). O parâmetro existe para o teste de integração,
--    que roda num banco compartilhado com outras etapas e só pode mexer nas linhas do próprio site.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comment_identity_purge(p_site_id uuid default null)
returns jsonb
language sql security invoker set search_path = '' as $$
  with antes as (
    select count(*) as n from public.competitor_video_comment_authors a where p_site_id is null or a.site_id = p_site_id
  ), gone as (
    delete from public.competitor_video_comment_authors a
     where a.expires_at <= now() and (p_site_id is null or a.site_id = p_site_id)
    returning a.comment_id, a.expires_at
  ), upd as (
    update public.competitor_video_comments c set author_purged_at = now(), featured_channel_id = null
      from gone g where c.id = g.comment_id
    returning 1
  )
  select jsonb_build_object(
    'apagadas', (select count(*) from gone),
    'comentarios_carimbados', (select count(*) from upd),
    'vencidas_ha_mais_de_1_dia', (select count(*) from gone where expires_at < now() - interval '1 day'),
    'restantes', (select n from antes) - (select count(*) from gone));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. O que está devido: (vídeo, marco) dentro da tolerância e sem retrato final. O mais perto de perder o prazo primeiro.
--    p_marks: [{ "mark": 1, "from_h": 24, "until_h": 72 }, …] (vem de rules; as janelas não se sobrepõem).
--    Retrato em erro volta a ser devido depois de p_retry_after; se o motivo é passageiro (p_fast_reasons: rede, tempo
--    esgotado, 5xx…), depois de p_retry_fast. total_due = quantos há ao todo (o p_limit não esconde).
--    p_since: nulo = sem corte; com data, só entra o marco ATINGIDO (t0 + from_h) nela ou depois ("retroação nenhuma").
--    p_site_id: nulo = todos os sites (a agenda); o teste de integração passa o próprio site (banco compartilhado).
--    Parâmetro nulo NUNCA vira "nada devido": p_now nulo ou p_marks que não é lista com itens LANÇA (22023).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comment_due(
  p_now timestamptz, p_marks jsonb, p_retry_after interval, p_limit integer,
  p_fast_reasons text[] default '{}', p_retry_fast interval default interval '15 minutes',
  p_since timestamptz default null, p_site_id uuid default null
) returns table (
  video_id uuid, youtube_video_id text, site_id uuid, channel_row_id uuid, channel_youtube_id text,
  channel_subscribers integer, channel_subscribers_hidden boolean,
  mark smallint, t0 timestamptz, deadline timestamptz,
  video_comment_count bigint, video_checked_at timestamptz, prev_status text, stored_n bigint, total_due bigint
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
begin
  if p_now is null or jsonb_typeof(p_marks) is distinct from 'array' or jsonb_array_length(p_marks) = 0 then
    raise exception 'competitor_comment_due: p_now nulo ou p_marks que nao e lista com itens' using errcode = '22023';
  end if;
  return query
  with m as (
    select (x->>'mark')::smallint as mark, (x->>'from_h')::integer as from_h, (x->>'until_h')::integer as until_h
      from jsonb_array_elements(p_marks) x
  ), base as (
    select v.id as video_id, v.video_id as youtube_video_id, c.site_id, c.id as channel_row_id, c.channel_id as channel_youtube_id,
           c.subscriber_count, c.subscribers_hidden, v.comment_count, v.last_checked_at,
           greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where (p_site_id is null or c.site_id = p_site_id)
       and v.missing_since is null and c.missing_since is null and v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
  ), due as (
    select b.*, m.mark, b.t0 + make_interval(hours => m.until_h) as deadline, s.status as prev_status
      from base b
      join m on b.t0 <= p_now - make_interval(hours => m.from_h) and b.t0 > p_now - make_interval(hours => m.until_h)
      left join public.competitor_video_comment_snaps s on s.video_id = b.video_id and s.mark = m.mark
     where (p_since is null or b.t0 + make_interval(hours => m.from_h) >= p_since)
       and (s.video_id is null
        or (s.status = 'erro' and s.taken_at <= p_now - case when s.error_reason = any(coalesce(p_fast_reasons, '{}'))
                                                               then coalesce(p_retry_fast, interval '15 minutes')
                                                               else coalesce(p_retry_after, interval '20 hours') end))
  )
  select d.video_id, d.youtube_video_id, d.site_id, d.channel_row_id, d.channel_youtube_id,
         d.subscriber_count, d.subscribers_hidden, d.mark, d.t0, d.deadline,
         d.comment_count, d.last_checked_at, d.prev_status,
         (select count(*) from public.competitor_video_comments k where k.video_id = d.video_id) as stored_n,
         count(*) over () as total_due
    from due d
   order by d.deadline asc, d.video_id, d.mark
   limit greatest(coalesce(p_limit, 200), 1);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. A prova embutida. p_site_id nulo = todos os sites. p_grace = folga depois do marco antes de cobrar o retrato.
--    p_since: o mesmo corte da lista de devidos (nulo = sem corte); sem ele a prova cobraria o que a lista não lista.
--    Parâmetro nulo NUNCA vira zero: p_now, p_identity_days ou p_grace nulos, ou p_marks que não é lista com itens,
--    devolvem NULO (quem lê trata nulo como "prova ilegível", vermelho).
--    Números que ficam vermelhos em quem lê (ver o plano): identidade_vencida, identidade_prazo_errado,
--    identidade_de_criador, respostas_de_terceiros, retratos_atrasados (com a fila zerada), retratos_perdidos_7d
--    (menos os de motivo aceito, por perdidos_por_motivo) e erros_por_motivo (3 ou mais presos no mesmo motivo).
-- ─────────────────────────────────────────────────────────────────────────────
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
      select count(*) from public.competitor_video_comments c
       where (p_site_id is null or c.site_id = p_site_id) and c.parent_id is not null and not c.is_creator),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. O que a remoção de um canal leva das quatro tabelas (a remoção já leva tudo por cascata; isto é a contagem).
--    Função PRÓPRIA, de propósito: competitor_channel_removal_impact NÃO é recriada aqui (decisão R1: um corpo só,
--    por catálogo, com um dono). As leituras e as identidades não têm FK direta para o canal (chegam pelo comentário)
--    e featured_elsewhere não é contagem por FK: por isso a contagem dos comentários tem função dela.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_channel_comment_impact(p_site_id uuid, p_channel_id uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select case when not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id)
    then jsonb_build_object('status', 'not_found')
    else jsonb_build_object(
      'status', 'ok',
      'comment_snaps', (select count(*) from public.competitor_video_comment_snaps s where s.competitor_channel_id = p_channel_id),
      'comments', (select count(*) from public.competitor_video_comments c where c.competitor_channel_id = p_channel_id),
      'comment_marks', (select count(*) from public.competitor_video_comment_marks m
                          join public.competitor_video_comments c on c.id = m.comment_id where c.competitor_channel_id = p_channel_id),
      'comment_authors', (select count(*) from public.competitor_video_comment_authors a
                            join public.competitor_video_comments c on c.id = a.comment_id where c.competitor_channel_id = p_channel_id),
      'featured_elsewhere', (select count(*) from public.competitor_video_comments c
                              where c.featured_channel_id = p_channel_id and c.competitor_channel_id <> p_channel_id))
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Quem executa: só service_role.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.competitor_comment_identity_purge(uuid) from public, anon, authenticated;
revoke all on function public.competitor_comment_due(timestamptz, jsonb, interval, integer, text[], interval, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_comment_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[]) to service_role;
grant execute on function public.competitor_comment_identity_purge(uuid) to service_role;
grant execute on function public.competitor_comment_due(timestamptz, jsonb, interval, integer, text[], interval, timestamptz, uuid) to service_role;
grant execute on function public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz) to service_role;
grant execute on function public.competitor_channel_comment_impact(uuid, uuid) to service_role;
