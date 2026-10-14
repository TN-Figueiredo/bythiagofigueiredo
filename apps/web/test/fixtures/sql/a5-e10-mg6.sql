-- MG6 (A5, E10): registro dos lotes de export, pausa de coleta e sinal de tamanho do banco.
-- Depende de: MG13 (yt_reporting_blobs_purge devolve 0: esta migration NÃO a toca), MG2b/MG9 (competitor_series_health,
-- competitor_hourly_health) e MG8 (competitor_comment_due, competitor_comment_health). Recusa sem elas.
-- Inerte para o código antigo: nada do que está em produção lê ou grava o que nasce aqui; os quatro corpos remendados
-- (bloco 10) só mudam de resposta quando existe uma linha em competitor_collection_pauses, e só as funções daqui a criam.
-- Idempotente: pode ser aplicada duas vezes.
set lock_timeout = '5s';

-- ───────────────────────── 0. Dependências ─────────────────────────
do $$
declare
  v_falta text;
begin
  select string_agg(x, ', ') into v_falta
    from unnest(array[
      'public.can_edit_site(uuid)', 'public.is_member_staff()',
      'public.competitor_series_health(uuid,timestamptz)',
      'public.competitor_hourly_health(uuid,timestamptz,integer,integer)',
      'public.competitor_comment_due(timestamptz,jsonb,interval,integer,text[],interval,timestamptz,uuid)',
      'public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)',
      'public.yt_reporting_blobs_purge(text[])'
    ]) x
   where to_regprocedure(x) is null;
  if v_falta is not null then
    raise exception 'MG6 depende de funções que não existem (MG13, MG2b, MG9, MG8): %', v_falta;
  end if;
end $$;

-- ───────────────────────── 1. Registro dos lotes ─────────────────────────
create table if not exists public.obs_archive_batches (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  batch text not null check (batch ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  kind text not null default 'canal' check (kind in ('canal', 'idade')),
  table_name text not null,
  channel_ref text not null,
  channel_label text,
  period_start date not null,
  period_end date not null,
  row_count bigint not null check (row_count >= 0),
  control_sum numeric,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  csv_sha256 text not null check (csv_sha256 ~ '^[0-9a-f]{64}$'),
  blob_count integer check (blob_count is null or blob_count >= 0),
  blob_bytes bigint check (blob_bytes is null or blob_bytes >= 0),
  blob_missing integer check (blob_missing is null or blob_missing >= 0),
  exported_at timestamptz not null,
  verified_at timestamptz,
  nas_confirmed_at timestamptz,
  nas_confirmed_by uuid,
  deleted_at timestamptz,
  rows_deleted bigint,
  blob_urls_pending text[],
  unique (site_id, batch, table_name, channel_ref, period_start),
  check (period_end >= period_start),
  check (nas_confirmed_at is null or verified_at is not null),
  check (deleted_at is null or nas_confirmed_at is not null)
);
-- (emenda 1: D-I3, S-M4) encerramento sem apagamento: o dono despausou (o export não vale mais) ou o canal foi removido por outro lote.
alter table public.obs_archive_batches
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text;
-- (reconciliação 13/10, emenda 2: D2-m2, S2-m2) terceiro valor, 'canal_apagado' (só a função de apagar canal da E9, MG18, grava).
-- A restrição ganhou nome e drop + add: `add column if not exists` com `check` em linha não troca um `check` já criado.
-- O nome é o que o Postgres daria ao `check` em linha, para o `drop` também tirar a versão de dois valores onde ela tiver sido aplicada. NÃO RODADO.
alter table public.obs_archive_batches drop constraint if exists obs_archive_batches_closed_reason_check;
alter table public.obs_archive_batches add constraint obs_archive_batches_closed_reason_check
  check (closed_reason in ('despausado', 'substituido', 'canal_apagado'));
-- (emenda 2: D-m4) as duas colunas andam juntas: protege contra uma terceira função futura que grave só uma. drop + add: reaplicável.
alter table public.obs_archive_batches drop constraint if exists obs_archive_batches_closed_par;
alter table public.obs_archive_batches add constraint obs_archive_batches_closed_par check ((closed_at is null) = (closed_reason is null));
create index if not exists idx_obs_archive_batches_channel on public.obs_archive_batches (site_id, channel_ref, exported_at desc);
alter table public.obs_archive_batches enable row level security;
drop policy if exists "obs_archive_batches_select" on public.obs_archive_batches;
create policy "obs_archive_batches_select" on public.obs_archive_batches
  for select using (public.can_edit_site(site_id));
revoke all on table public.obs_archive_batches from anon, authenticated;
grant select on table public.obs_archive_batches to authenticated;
grant all on table public.obs_archive_batches to service_role;

comment on table public.obs_archive_batches is
  'Uma linha por arquivo de export (tabela × canal × mês). O registro fica online para sempre: é ele que diz o que foi arquivado. Só as funções obs_archive_* e competitor_channel_remove_archived gravam aqui.';
comment on column public.obs_archive_batches.control_sum is 'Soma de controle (a soma de views, onde a tabela tem). Nulo = a tabela não tem coluna somável.';
comment on column public.obs_archive_batches.csv_sha256 is 'sha256 do CSV sem compressão. conferir relê o banco com a mesma consulta e compara com este valor.';
comment on column public.obs_archive_batches.blob_missing is 'Miniaturas que o Blob respondeu 404 no export (aceitas de propósito pelo dono). Nulo = a tabela não tem miniatura.';
comment on column public.obs_archive_batches.blob_urls_pending is 'Só na linha de table_name = competitor_channels: miniaturas do canal removido que ainda estão no Blob. Vazio ou nulo = nada pendente.';

-- ───────────────────────── 2. Pausa de coleta ─────────────────────────
alter table public.competitor_channels
  add column if not exists collection_paused_at timestamptz,
  add column if not exists collection_paused_by uuid;
comment on column public.competitor_channels.collection_paused_at is 'Nulo = coleta ligada. Preenchido = nenhuma tarefa lê este canal (passo 0 do export). Só competitor_channel_pause e competitor_channel_unpause gravam.';

create table if not exists public.competitor_collection_pauses (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  paused_at timestamptz not null,
  paused_by uuid not null,
  reason text not null default 'exportar' check (reason in ('exportar')),
  resumed_at timestamptz,
  resumed_by uuid,
  check (resumed_at is null or resumed_at >= paused_at)
);
create unique index if not exists uq_competitor_collection_pauses_open
  on public.competitor_collection_pauses (competitor_channel_id) where resumed_at is null;
create index if not exists idx_competitor_collection_pauses_channel
  on public.competitor_collection_pauses (competitor_channel_id, paused_at);
alter table public.competitor_collection_pauses enable row level security;
drop policy if exists "competitor_collection_pauses_select" on public.competitor_collection_pauses;
create policy "competitor_collection_pauses_select" on public.competitor_collection_pauses
  for select using (public.can_edit_site(site_id));
revoke all on table public.competitor_collection_pauses from anon, authenticated;
grant select on table public.competitor_collection_pauses to authenticated;
grant all on table public.competitor_collection_pauses to service_role;
comment on table public.competitor_collection_pauses is
  'Histórico das pausas de coleta por canal. É o que permite dizer, depois, "sem coleta de dd/mm a dd/mm" em vez de buraco. Uma pausa aberta por canal.';

-- ───────────────────────── 3. Sinal de tamanho do banco ─────────────────────────
create table if not exists public.obs_db_size_daily (
  day date primary key,
  db_bytes bigint not null check (db_bytes >= 0),
  competitor_bytes bigint not null check (competitor_bytes >= 0),
  own_bytes bigint not null check (own_bytes >= 0),
  measured_at timestamptz not null default now()
);
alter table public.obs_db_size_daily add column if not exists top_relations jsonb not null default '{}'::jsonb;
alter table public.obs_db_size_daily enable row level security;
drop policy if exists "obs_db_size_daily_select" on public.obs_db_size_daily;
create policy "obs_db_size_daily_select" on public.obs_db_size_daily
  for select using (public.is_member_staff());
revoke all on table public.obs_db_size_daily from anon, authenticated;
-- (emenda 1: S-M1, D-m13) top_relations é o mapa do banco: só o cliente de serviço lê. authenticated lê as cinco colunas do spec.
grant select (day, db_bytes, competitor_bytes, own_bytes, measured_at) on table public.obs_db_size_daily to authenticated;
grant all on table public.obs_db_size_daily to service_role;
comment on table public.obs_db_size_daily is
  'Uma linha por dia de São Paulo com o tamanho do banco. Gravada só por obs_db_size_record (tarefa tamanho_do_banco). Dia sem linha = sem leitura, nunca zero.';
comment on column public.obs_db_size_daily.top_relations is 'As 30 maiores relações do banco no instante da medida: {"schema.nome": bytes}.';

create or replace function public.obs_db_size_record(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_db bigint;
  v_comp bigint;
  v_own bigint;
  v_top jsonb;
begin
  if p_now is null then
    raise exception 'E10:parametro_nulo: obs_db_size_record' using errcode = '22023';
  end if;
  v_day := (p_now at time zone 'America/Sao_Paulo')::date;
  v_db := pg_catalog.pg_database_size(pg_catalog.current_database());
  select coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where c.relname like 'competitor\_%'), 0)::bigint,
         coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)) filter (where c.relname like 'yt\_own\_%' or c.relname like 'yt\_reporting\_%'), 0)::bigint
    into v_comp, v_own
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
  select coalesce(jsonb_object_agg(z.nome, z.bytes), '{}'::jsonb) into v_top
    from (
      select n.nspname || '.' || c.relname as nome, pg_catalog.pg_total_relation_size(c.oid) as bytes
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'm') and n.nspname not in ('pg_catalog', 'information_schema')
       order by 2 desc, 1
       limit 30
    ) z;
  insert into public.obs_db_size_daily as d (day, db_bytes, competitor_bytes, own_bytes, measured_at, top_relations)
  values (v_day, v_db, v_comp, v_own, p_now, v_top)
  on conflict (day) do update
    set db_bytes = excluded.db_bytes, competitor_bytes = excluded.competitor_bytes, own_bytes = excluded.own_bytes,
        measured_at = excluded.measured_at, top_relations = excluded.top_relations;
  return jsonb_build_object('day', v_day, 'db_bytes', v_db, 'competitor_bytes', v_comp, 'own_bytes', v_own, 'measured_at', p_now);
end $$;

-- ───────────────────────── 4. Quem pode confirmar (o dono) ─────────────────────────
create or replace function public.obs_archive_is_site_admin(p_site uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members om
      join public.organizations o on o.id = om.org_id
      join public.sites s on s.id = p_site
     where om.user_id = p_user and om.role = 'org_admin'
       and (om.org_id = s.org_id or o.parent_org_id is null)
  ) and exists (select 1 from auth.users u where u.id = p_user);
$$;

-- ───────────────────────── 5. Pausar e despausar ─────────────────────────
create or replace function public.competitor_channel_pause_covers(p_channel uuid, p_now timestamptz, p_tail interval)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.competitor_collection_pauses p
     where p.competitor_channel_id = p_channel
       and p.paused_at <= p_now
       and (p.resumed_at is null or p.resumed_at > p_now - p_tail)
  );
$$;

create or replace function public.competitor_channel_pause(p_site uuid, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
  v_falta text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: competitor_channel_pause' using errcode = '22023';
  end if;
  -- As quatro funções que escolhem ou cobram vídeo por canal têm de conhecer a pausa. Se outra migration as recriou sem o
  -- remendo, pausar deixaria o cron vermelho (provas) e a fila de comentários gravando no canal: recusa.
  select string_agg(p.proname, ', ' order by p.proname) into v_falta
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('competitor_series_health', 'competitor_hourly_health', 'competitor_comment_due', 'competitor_comment_health')
     and p.prosrc not like '%competitor_channel_pause_covers%';
  if v_falta is not null then
    raise exception 'E10:pausa_sem_remendo: %', v_falta using errcode = 'P0001';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: quem pausa tem de administrar o site' using errcode = '42501';
  end if;
  select c.collection_paused_at into v_paused
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_paused is not null then
    return jsonb_build_object('status', 'ja_pausado', 'paused_at', v_paused);
  end if;
  update public.competitor_channels c
     set collection_paused_at = v_now, collection_paused_by = p_by
   where c.id = p_channel and c.site_id = p_site;
  insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by)
  values (p_site, p_channel, v_now, p_by);
  return jsonb_build_object('status', 'pausado', 'paused_at', v_now);
end $$;

create or replace function public.competitor_channel_unpause(p_site uuid, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
  v_invalidados integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: competitor_channel_unpause' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: quem despausa tem de administrar o site' using errcode = '42501';
  end if;
  select c.collection_paused_at into v_paused
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_paused is null then
    return jsonb_build_object('status', 'nao_pausado');
  end if;
  update public.competitor_channels c
     set collection_paused_at = null, collection_paused_by = null
   where c.id = p_channel and c.site_id = p_site;
  update public.competitor_collection_pauses p
     set resumed_at = v_now, resumed_by = p_by
   where p.competitor_channel_id = p_channel and p.resumed_at is null;
  -- A coleta volta a gravar: o arquivo exportado deixa de ser o retrato do canal. A conferência antiga não vale.
  update public.obs_archive_batches b
     set verified_at = null, nas_confirmed_at = null, nas_confirmed_by = null
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null
     and (b.verified_at is not null or b.nas_confirmed_at is not null);
  get diagnostics v_invalidados = row_count;
  -- (emenda 1: D-I3, S-M4) o lote exportado antes de despausar está encerrado: deixa de contar como "exportado e não confirmado"
  update public.obs_archive_batches b
     set closed_at = v_now, closed_reason = 'despausado'
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null and b.closed_at is null;
  return jsonb_build_object('status', 'despausado', 'resumed_at', v_now, 'arquivos_invalidados', v_invalidados);
end $$;

-- ───────────────────────── 6. O que o export cobre, e a contagem por canal ─────────────────────────
-- filter_sql usa o apelido t e $1 = id (uuid) do canal. period_sql devolve uma data; nulo = arquivo único (1970-01-01).
create or replace function public.obs_archive_registry()
returns table (table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
language sql
stable   -- (emenda 1: D-m13) era immutable; a função é recriada por migrations futuras
set search_path = ''
as $$
  values
    ('competitor_channels', 't.id = $1', null, null, 't.id'),
    ('competitor_collection_pauses', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_channel_snapshots', 't.competitor_channel_id = $1', 't.snapshot_date', 't.view_count', 't.id'),
    ('competitor_channel_hour_map', 't.competitor_channel_id = $1', 't.month', null, 't.month, t.format, t.phase'),
    ('competitor_videos', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_field_versions',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_raw',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_video_versions',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_changes',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)', null, null, 't.id'),
    ('competitor_video_tier_spans',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.from_date', null, 't.video_id, t.from_date'),
    ('competitor_video_daily',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.snap_date', 't.views', 't.video_id, t.snap_date'),
    -- (emenda 1: D-I1) tabela da MG4, que ainda não existe: a contagem a pula até existir. Chave primária (video_id, age_days) do spec.
    ('competitor_video_marks',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.age_days'),
    -- (reconciliação 13/10: R1) segunda tabela da MG4 (plano da E4, desvio 4): mesma chave (video_id, age_days). Pulada até existir. NÃO RODADA.
    ('competitor_video_mark_misses',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.age_days'),
    -- (reconciliação 13/10: R2) tabela da MG18 (plano da E9): piso da prova dos ausentes, chave (video_id, missing_since). Pulada até existir. NÃO RODADA.
    ('competitor_missing_baseline',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     null, null, 't.video_id, t.missing_since'),
    ('competitor_video_early',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.taken_at at time zone ''UTC'')::date', 't.views', 't.video_id, t.taken_at'),
    ('competitor_video_hourly',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.hour_slot at time zone ''UTC'')::date', 't.views', 't.video_id, t.hour_slot'),
    ('competitor_hour_fold_log',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     't.day', null, 't.video_id, t.day'),
    ('competitor_video_comment_snaps',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.taken_at at time zone ''UTC'')::date', null, 't.video_id, t.mark'),
    ('competitor_video_comments',
     '(t.competitor_channel_id = $1 or t.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_video_comment_marks',
     't.comment_id in (select k.id from public.competitor_video_comments k where k.competitor_channel_id = $1 or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1))',
     null, 't.likes', 't.comment_id, t.mark'),
    ('competitor_readings',
     't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.generated_at at time zone ''UTC'')::date', null, 't.id'),
    ('youtube_intelligence_tasks',
     't.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
     '(t.requested_at at time zone ''UTC'')::date', null, 't.id');
$$;

-- Tabelas que somem em cascata com o canal e que, de propósito, NÃO vão para o arquivo.
create or replace function public.obs_archive_excluded()
returns table (table_name text, reason text)
language sql
stable   -- (emenda 1: D-m13)
set search_path = ''
as $$
  values ('competitor_video_comment_authors', 'identidade do autor do comentário: decisão 20 do dono, não se guarda além de 28 dias');
$$;

-- Toda tabela que some em cascata com um canal e não está no registro nem na lista de exclusão. Vazio = o export cobre tudo.
create or replace function public.obs_archive_uncovered()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive alvo (rel) as (
    select 'public.competitor_channels'::regclass::oid
    union
    select k.conrelid
      from pg_catalog.pg_constraint k
      join alvo a on k.confrelid = a.rel
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  )
  select coalesce(array_agg(c.relname::text order by c.relname::text), '{}'::text[])
    from alvo a
    join pg_catalog.pg_class c on c.oid = a.rel
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where not (n.nspname = 'public' and c.relname::text in (select r.table_name from public.obs_archive_registry() r))
     and not (n.nspname = 'public' and c.relname::text in (select e.table_name from public.obs_archive_excluded() e));
$$;

create or replace function public.obs_archive_channel_counts(p_channel uuid)
returns table (table_name text, period_start date, row_count bigint, control_sum numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_channel is null then
    raise exception 'E10:parametro_nulo: obs_archive_channel_counts' using errcode = '22023';
  end if;
  for r in select * from public.obs_archive_registry() loop
    -- tabela do registro que ainda não existe neste banco (migration de outra etapa não aplicada) não tem linha: pula
    continue when to_regclass('public.' || quote_ident(r.table_name)) is null;
    return query execute format(
      'select %L::text, %s, count(*)::bigint, %s::numeric from public.%I t where %s group by 2',
      r.table_name,
      case when r.period_sql is null then 'date ''1970-01-01''' else format('date_trunc(''month'', (%s)::timestamp)::date', r.period_sql) end,
      case when r.sum_sql is null then 'null' else format('coalesce(sum(%s), 0)', r.sum_sql) end,
      r.table_name, r.filter_sql
    ) using p_channel;
  end loop;
end $$;

-- As diferenças entre o banco e o registro de um lote: vazio = iguais. Só nomes de tabela, meses e números.
create or replace function public.obs_archive_diff(p_site uuid, p_batch text, p_channel uuid)
returns table (table_name text, period_start date, db_rows bigint, file_rows bigint, db_sum numeric, file_sum numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(d.table_name, b.table_name), coalesce(d.period_start, b.period_start),
         d.row_count, b.row_count, d.control_sum, b.control_sum
    from public.obs_archive_channel_counts(p_channel) d
    full join (select x.table_name, x.period_start, x.row_count, x.control_sum
                 from public.obs_archive_batches x
                where x.site_id = p_site and x.batch = p_batch and x.channel_ref = p_channel::text and x.deleted_at is null) b
      on b.table_name = d.table_name and b.period_start = d.period_start
   where d.row_count is distinct from b.row_count or d.control_sum is distinct from b.control_sum
   order by 1, 2;
$$;

-- ───────────────────────── 7. Os quatro comandos ─────────────────────────
-- Passo 1 (exportar): registra o lote. Recusa canal não pausado, pausado há menos de 6 minutos, em sincronização,
-- e arquivo que não bate com o banco.
create or replace function public.obs_archive_register(p_site uuid, p_batch text, p_channel uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_n integer;
  v_falta text[];
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_batch is null or p_channel is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'E10:parametro_nulo: obs_archive_register' using errcode = '22023';
  end if;
  v_falta := public.obs_archive_uncovered();
  if cardinality(v_falta) > 0 then
    raise exception 'E10:tabela_sem_export: %', array_to_string(v_falta, ', ') using errcode = 'P0001';
  end if;
  select c.channel_name, c.collection_paused_at, c.sync_status, c.sync_started_at into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_c.collection_paused_at is null then
    raise exception 'E10:nao_pausado: pause a coleta do canal antes de exportar' using errcode = 'P0001';
  end if;
  if v_c.collection_paused_at > v_now - interval '6 minutes' then
    raise exception 'E10:pausa_recente: espere 6 minutos depois de pausar (um disparo em andamento ainda pode gravar)' using errcode = 'P0001';
  end if;
  if v_c.sync_status = 'syncing' and v_c.sync_started_at > v_now - interval '10 minutes' then
    raise exception 'E10:sincronizando: o canal está sendo sincronizado agora' using errcode = 'P0001';
  end if;
  -- (emenda 1: D-m8) uma tarefa da forja em execução para um vídeo do canal ainda pode gravar uma leitura depois do export
  if exists (select 1 from public.youtube_intelligence_tasks t
              where t.status = 'running'
                and t.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)) then
    raise exception 'E10:forja_em_andamento: há leitura da forja em execução para um vídeo deste canal; espere terminar' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.obs_archive_batches b
              where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is not null) then
    raise exception 'E10:lote_ja_apagado: use outro nome de lote' using errcode = 'P0001';
  end if;
  -- reexportar: o registro antigo deste lote e canal sai inteiro (a conferência e a confirmação antigas não valem)
  delete from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  insert into public.obs_archive_batches
    (site_id, batch, kind, table_name, channel_ref, channel_label, period_start, period_end, row_count, control_sum,
     file_sha256, csv_sha256, blob_count, blob_bytes, blob_missing, exported_at)
  select p_site, p_batch, 'canal', x.table_name, p_channel::text, v_c.channel_name, x.period_start, x.period_end, x.row_count, x.control_sum,
         x.file_sha256, x.csv_sha256, x.blob_count, x.blob_bytes, x.blob_missing, v_now
    from jsonb_to_recordset(p_rows) as x(table_name text, period_start date, period_end date, row_count bigint, control_sum numeric,
                                          file_sha256 text, csv_sha256 text, blob_count integer, blob_bytes bigint, blob_missing integer);
  get diagnostics v_n = row_count;
  if exists (select 1 from public.obs_archive_diff(p_site, p_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, p_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  return jsonb_build_object('status', 'exportado', 'arquivos', v_n, 'exported_at', v_now,
    'linhas', (select sum(b.row_count) from public.obs_archive_batches b where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text));
end $$;

-- A guarda comum dos passos 2, 3 e 4: trava a linha do canal e confere em que passo o lote está.
create or replace function public.obs_archive_guard(p_site uuid, p_batch text, p_channel uuid, p_need text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paused timestamptz;
  v_n integer;
  v_min_exp timestamptz;
  v_sem_conf integer;
  v_sem_nas integer;
begin
  select c.collection_paused_at into v_paused
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  if v_paused is null then
    raise exception 'E10:nao_pausado: o canal não está com a coleta pausada' using errcode = 'P0001';
  end if;
  select count(*), min(b.exported_at), count(*) filter (where b.verified_at is null), count(*) filter (where b.nas_confirmed_at is null)
    into v_n, v_min_exp, v_sem_conf, v_sem_nas
    from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  if v_n = 0 then
    raise exception 'E10:sem_lote: não há lote exportado deste canal com este nome' using errcode = 'P0001';
  end if;
  if v_min_exp < v_paused then
    raise exception 'E10:despausado_depois_do_export: exporte de novo' using errcode = 'P0001';
  end if;
  if p_need in ('conferido', 'confirmado') and v_sem_conf > 0 then
    raise exception 'E10:lote_nao_conferido: rode conferir antes' using errcode = 'P0001';
  end if;
  if p_need = 'confirmado' and v_sem_nas > 0 then
    raise exception 'E10:lote_nao_confirmado: falta confirmar a cópia no NAS' using errcode = 'P0001';
  end if;
end $$;

-- Passo 2 (conferir): o script já releu o disco; aqui o banco é recontado e comparado com o registro.
create or replace function public.obs_archive_verify(p_site uuid, p_batch text, p_channel uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_batch is null or p_channel is null then
    raise exception 'E10:parametro_nulo: obs_archive_verify' using errcode = '22023';
  end if;
  perform public.obs_archive_guard(p_site, p_batch, p_channel, 'exportado');
  if exists (select 1 from public.obs_archive_diff(p_site, p_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, p_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  update public.obs_archive_batches b set verified_at = v_now
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'conferido', 'arquivos', v_n, 'verified_at', v_now);
end $$;

-- Passo 3 (confirmar-nas): só quem administra o site.
create or replace function public.obs_archive_confirm_nas(p_site uuid, p_batch text, p_channel uuid, p_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_batch is null or p_channel is null or p_by is null then
    raise exception 'E10:parametro_nulo: obs_archive_confirm_nas' using errcode = '22023';
  end if;
  if not public.obs_archive_is_site_admin(p_site, p_by) then
    raise exception 'E10:sem_direito: só quem administra o site confirma a cópia no NAS' using errcode = '42501';
  end if;
  perform public.obs_archive_guard(p_site, p_batch, p_channel, 'conferido');
  update public.obs_archive_batches b set nas_confirmed_at = v_now, nas_confirmed_by = p_by
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'confirmado', 'arquivos', v_n, 'nas_confirmed_at', v_now);
end $$;

-- Passo 4 (nesta fase): remover o canal inteiro, liberado pelo lote confirmado. Trava o canal, os vídeos e os comentários
-- (nenhuma linha filha entra entre a recontagem e o apagamento), reconta, compara com o registro e só então apaga.
create or replace function public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch text;
  v_c record;
  v_falta text[];
  v_urls text[];
  v_linhas bigint;
  v_arquivos integer;
  v_featured integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_site is null or p_channel is null or p_actor is null then
    raise exception 'E10:parametro_nulo: competitor_channel_remove_archived' using errcode = '22023';
  end if;
  v_falta := public.obs_archive_uncovered();
  if cardinality(v_falta) > 0 then
    raise exception 'E10:tabela_sem_export: %', array_to_string(v_falta, ', ') using errcode = 'P0001';
  end if;
  select c.channel_id, c.channel_name into v_c
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    raise exception 'E10:canal_nao_encontrado: neste site' using errcode = 'P0002';
  end if;
  -- o lote mais recente deste canal que ainda não foi apagado
  select b.batch into v_batch
    from public.obs_archive_batches b
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null
   order by b.exported_at desc, b.batch desc
   limit 1;
  if v_batch is null then
    raise exception 'E10:sem_lote: este canal ainda não foi exportado' using errcode = 'P0001';
  end if;
  perform public.obs_archive_guard(p_site, v_batch, p_channel, 'confirmado');
  perform 1 from public.competitor_videos v where v.competitor_channel_id = p_channel for update;
  if to_regclass('public.competitor_video_comments') is not null then
    perform 1 from public.competitor_video_comments k
      where k.competitor_channel_id = p_channel
         or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)
      for update;
  end if;
  if exists (select 1 from public.obs_archive_diff(p_site, v_batch, p_channel)) then
    raise exception 'E10:banco_difere_do_manifesto: %',
      (select string_agg(d.table_name || ' ' || d.period_start || ' banco=' || coalesce(d.db_rows::text, 'sem linha') || ' arquivo=' || coalesce(d.file_rows::text, 'sem arquivo'), '; ')
         from (select * from public.obs_archive_diff(p_site, v_batch, p_channel) limit 10) d)
      using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_urls
    from public.competitor_video_versions x
    join public.competitor_videos v on v.id = x.video_id
   where v.competitor_channel_id = p_channel and x.thumb_blob_url is not null;
  select count(*) into v_featured from public.competitor_video_comments k
   where k.featured_channel_id = p_channel and k.competitor_channel_id <> p_channel;
  select sum(b.row_count), count(*) into v_linhas, v_arquivos
    from public.obs_archive_batches b
   where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text and b.deleted_at is null;

  delete from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;

  if exists (select 1 from public.obs_archive_channel_counts(p_channel)) then
    raise exception 'E10:sobrou_linha: uma tabela do registro não apaga em cascata' using errcode = 'P0001';
  end if;
  update public.obs_archive_batches b
     set deleted_at = v_now, rows_deleted = b.row_count,
         blob_urls_pending = case when b.table_name = 'competitor_channels' then v_urls else b.blob_urls_pending end
   where b.site_id = p_site and b.batch = v_batch and b.channel_ref = p_channel::text and b.deleted_at is null;
  -- (emenda 1: D-I3, S-M4) os outros lotes abertos deste canal apontam para um canal que não existe mais: encerrados
  update public.obs_archive_batches b
     set closed_at = v_now, closed_reason = 'substituido'
   where b.site_id = p_site and b.channel_ref = p_channel::text and b.deleted_at is null and b.closed_at is null;
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data)
  select p_actor, 'observatorio_canal_removido_com_arquivo', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('channel_id', v_c.channel_id, 'channel_name', v_c.channel_name),
         jsonb_build_object('batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'miniaturas_no_blob', cardinality(v_urls), 'featured_refs_cleared', v_featured)
    from public.sites s where s.id = p_site;
  return jsonb_build_object('status', 'removido', 'batch', v_batch, 'arquivos', v_arquivos, 'linhas', v_linhas,
                            'blob_urls', to_jsonb(v_urls), 'featured_refs_cleared', v_featured);
end $$;

-- Depois de apagar do Blob as miniaturas de um canal removido: tira as URLs da pendência.
create or replace function public.obs_archive_blobs_done(p_site uuid, p_batch text, p_channel_ref text, p_urls text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restam integer;
begin
  if p_site is null or p_batch is null or p_channel_ref is null or p_urls is null then
    raise exception 'E10:parametro_nulo: obs_archive_blobs_done' using errcode = '22023';
  end if;
  update public.obs_archive_batches b
     set blob_urls_pending = coalesce((select array_agg(u) from unnest(b.blob_urls_pending) u where u <> all (p_urls)), '{}'::text[])
   where b.site_id = p_site and b.batch = p_batch and b.channel_ref = p_channel_ref
     and b.table_name = 'competitor_channels' and b.deleted_at is not null
  returning cardinality(b.blob_urls_pending) into v_restam;
  return v_restam;
end $$;

-- ───────────────────────── 8. Sugestões: canal sem publicar há N meses ─────────────────────────
create or replace function public.competitor_archive_suggestions(p_site uuid, p_now timestamptz, p_months integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with canais as (
    select c.id, c.channel_name, c.last_ok_synced_at,   -- (emenda 1: D-m5)
           (select max(v.published_at) from public.competitor_videos v where v.competitor_channel_id = c.id) as ultima,
           (select count(*) from public.competitor_videos v where v.competitor_channel_id = c.id) as videos
      from public.competitor_channels c
     where c.site_id = p_site and c.missing_since is null and c.collection_paused_at is null
  ), parados as (
    select k.*, (select coalesce(sum(n.row_count), 0) from public.obs_archive_channel_counts(k.id) n) as linhas
      from canais k
     where k.ultima is not null and k.ultima < p_now - make_interval(months => p_months)
  )
  select case when p_site is null or p_now is null or p_months is null or p_months < 1 then null else jsonb_build_object(
    'canais_avaliados', (select count(*) from canais),
    'canais_sem_video', (select count(*) from canais where ultima is null),
    'sugestoes', coalesce((select jsonb_agg(jsonb_build_object(
        'channel_row_id', p.id, 'channel_name', p.channel_name, 'last_published_at', p.ultima, 'last_ok_synced_at', p.last_ok_synced_at, 'videos', p.videos, 'linhas', p.linhas)
        order by p.ultima, p.id) from parados p), '[]'::jsonb)
  ) end;
$$;

-- ───────────────────────── 9. Privilégios das funções ─────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.obs_db_size_record(timestamptz)',
    'public.obs_archive_is_site_admin(uuid, uuid)',
    'public.competitor_channel_pause_covers(uuid, timestamptz, interval)',
    'public.competitor_channel_pause(uuid, uuid, uuid)',
    'public.competitor_channel_unpause(uuid, uuid, uuid)',
    'public.obs_archive_registry()',
    'public.obs_archive_excluded()',
    'public.obs_archive_uncovered()',
    'public.obs_archive_channel_counts(uuid)',
    'public.obs_archive_diff(uuid, text, uuid)',
    'public.obs_archive_register(uuid, text, uuid, jsonb)',
    'public.obs_archive_guard(uuid, text, uuid, text)',
    'public.obs_archive_verify(uuid, text, uuid)',
    'public.obs_archive_confirm_nas(uuid, text, uuid, uuid)',
    'public.competitor_channel_remove_archived(uuid, uuid, uuid)',
    'public.obs_archive_blobs_done(uuid, text, text, text[])',
    'public.competitor_archive_suggestions(uuid, timestamptz, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ───────────────────────── 10. As quatro funções que escolhem ou cobram vídeo por canal ─────────────────────────
-- Remendo por âncora sobre o corpo INSTALADO (o de quem é dono da função: MG2b, MG9, MG8), para não copiar corpo de outra
-- migration: acrescenta uma condição e nada mais. Recusa (e desfaz a migration) se a âncora não aparecer exatamente uma vez.
-- Já remendada = pula. Cauda: por quanto tempo depois de despausar o canal continua fora da prova.
do $$
declare
  r record;
  v_def text;
  v_n integer;
begin
  for r in
    select * from (values
      ('public.competitor_series_health(uuid,timestamptz)',
       'or v.missing_since is not null or c.missing_since is not null',
       'or v.missing_since is not null or c.missing_since is not null or public.competitor_channel_pause_covers(c.id, p_now, interval ''3 days'')'),
      ('public.competitor_hourly_health(uuid,timestamptz,integer,integer)',
       'and v.missing_since is null and c.missing_since is null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''26 hours'')'),
      ('public.competitor_comment_due(timestamptz,jsonb,interval,integer,text[],interval,timestamptz,uuid)',
       'and v.missing_since is null and c.missing_since is null and v.published_at is not null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''0'') and v.published_at is not null'),
      ('public.competitor_comment_health(uuid,timestamptz,jsonb,integer,interval,timestamptz)',
       'and v.missing_since is null and c.missing_since is null and v.published_at is not null',
       'and v.missing_since is null and c.missing_since is null and not public.competitor_channel_pause_covers(c.id, p_now, interval ''7 days'') and v.published_at is not null')
    ) as t(assinatura, ancora, troca)
  loop
    v_def := pg_catalog.pg_get_functiondef(r.assinatura::regprocedure);
    continue when v_def like '%competitor_channel_pause_covers%';
    v_n := (length(v_def) - length(replace(v_def, r.ancora, ''))) / length(r.ancora);
    if v_n <> 1 then
      raise exception 'MG6: a âncora do remendo aparece % vez(es) em % (esperado: 1). O corpo da função mudou: conferir antes de aplicar.', v_n, r.assinatura;
    end if;
    execute replace(v_def, r.ancora, r.troca);
  end loop;
end $$;
