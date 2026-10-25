-- Manutenção M3b: o arquivo durável (spec 2026-10-13-fase-manutencao-nas, 02 §10). RASCUNHO até a Tarefa 10 do plano M3b-site
-- (TRAVA M3b-1): não mover para supabase/migrations à mão; o dia é o de `npm run db:new manutencao_m3b_arquivo`.
-- Depende de: M2 (obs_archive_rehearsal, obs_partitions_ensure) e M10a (competitor_videos.archive_frozen_at) em produção.
-- Idempotente: create ... if not exists, create or replace function, drop ... if exists antes de create policy/trigger.

-- M3B PARTE 1: o registro, a política e o administrador do site

-- A política fechada (02 §10.3). Mudada só por migration; `released` falso em tudo na M3b (D12).
create or replace function public.obs_archive_policy()
returns table (class text, table_name text, exit_mode text, window_months int, seal_margin_days int, wait_days int,
               auto_allowed text, released boolean, control_column text, filho text)
language sql immutable set search_path = '' as $$
  values
    ('horaria', 'competitor_video_hourly', 'particao', 3, 28, 7, 'depois_de_3', false, 'views', 'numerico'),
    ('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false, 'views', 'numerico'),
    ('serie', 'competitor_video_early', 'particao', 6, 28, 7, 'depois_de_3_da_tabela', false, 'views', 'numerico'),
    ('texto', 'competitor_video_comments', 'faixa', 6, 45, 0, 'nunca', false, null, 'texto'),
    ('texto', 'competitor_video_comment_marks', 'faixa', 6, 45, 0, 'nunca', false, 'likes', 'texto'),
    ('texto', 'competitor_raw', 'faixa', 6, 45, 0, 'nunca', false, null, 'texto'),
    ('ensaio', 'obs_archive_rehearsal', 'particao', 6, 28, 1, 'nunca', false, 'views', 'numerico'),
    ('video_antigo', 'competitor_video_versions', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_field_versions', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_raw', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_video_tier_spans', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_video_comment_snaps', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_hour_fold_log', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_changes', 'lista', 0, 28, 0, 'nunca', false, null, 'texto'),
    ('video_antigo', 'competitor_readings', 'lista', 0, 28, 0, 'nunca', false, null, 'texto')
$$;
revoke all on function public.obs_archive_policy() from public, anon, authenticated;
grant execute on function public.obs_archive_policy() to service_role;

-- O administrador do site (02 §10.5, condição 11; pedido 13). Mesma assinatura e regra da MG6 da E10 (plano E10 :1402-1416):
-- o parâmetro chama-se p_user; create or replace com outro nome falharia quando a E10 chegar.
create or replace function public.obs_archive_is_site_admin(p_site uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_members om
      join public.organizations o on o.id = om.org_id
      join public.sites s on s.id = p_site
     where om.user_id = p_user and om.role = 'org_admin'
       and (om.org_id = s.org_id or o.parent_org_id is null)
  ) and exists (select 1 from auth.users u where u.id = p_user);
$$;
revoke all on function public.obs_archive_is_site_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_is_site_admin(uuid, uuid) to service_role;

-- As classes do registro (check) e o par (classe, tabela) da política (gatilho).
create or replace function public.obs_archive_class_table_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.obs_archive_policy() p where p.class = new.class and p.table_name = new.table_name) then
    raise exception 'classe_tabela_invalida' using errcode = 'P0001', detail = new.class || '/' || new.table_name;
  end if;
  return new;
end $$;

create table if not exists public.obs_archive_units (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  table_name text not null,
  channel_ref text not null check (channel_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  month date not null check (month = date_trunc('month', month)::date),
  version integer not null check (version between 1 and 9999),
  row_count bigint not null check (row_count >= 0),
  control_sum numeric,
  hash_conteudo text not null check (hash_conteudo ~ '^[0-9a-f]{64}$'),
  schema_fp text not null check (schema_fp ~ '^[0-9a-f]{64}$'),
  sha256_bytes text check (sha256_bytes ~ '^[0-9a-f]{64}$'),
  csv_sha256 text check (csv_sha256 ~ '^[0-9a-f]{64}$'),
  file_bytes bigint check (file_bytes >= 0),
  parts smallint not null default 1 check (parts between 1 and 99),
  min_key text, max_key text,
  origem text not null default 'rota' check (origem in ('rota', 'expurgo')),
  exported_at timestamptz not null default now(),
  received_at timestamptz, received_sha256 text, received_row_count bigint, received_control_sum numeric,
  nas_attested_at timestamptz,
  nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente', 'conteudo_divergente')),
  absent_first_at timestamptz, absent_last_at timestamptz,
  redo_reason text check (redo_reason in ('arquivo_ausente', 'divergente', 'conteudo_divergente', 'conteudo_mudou', 'mudou_durante_a_leitura', 'parte_mudou')),
  superseded_at timestamptz,
  dropped_at timestamptz, dropped_by uuid,
  purged_at timestamptz, purged_by uuid, purge_ref text,
  lost_at timestamptz, lost_by text, lost_reason text check (lost_reason in ('ausente_nas_e_b2', 'nunca_recebida')),
  unique (site_id, class, table_name, channel_ref, month, version),
  check ((row_count = 0) = (sha256_bytes is null)),
  check ((purged_at is null) = (purged_by is null) and (purged_at is null) = (purge_ref is null)),
  check ((lost_at is null) = (lost_by is null) and (lost_at is null) = (lost_reason is null)),
  check ((absent_first_at is null) = (absent_last_at is null) and (absent_last_at is null or absent_last_at >= absent_first_at)),
  check ((nas_withdrawn_at is null) = (nas_withdrawn_reason is null))
);
create index if not exists idx_oau_site_channel on public.obs_archive_units (site_id, channel_ref);          -- P36
create index if not exists idx_oau_month on public.obs_archive_units (site_id, class, month);
create index if not exists idx_oau_pending on public.obs_archive_units (site_id) where received_at is null and purged_at is null and lost_at is null;

create table if not exists public.obs_archive_unit_parts (
  unit_id uuid not null references public.obs_archive_units(id) on delete restrict,
  part smallint not null check (part between 1 and 99),
  sha256_bytes text not null check (sha256_bytes ~ '^[0-9a-f]{64}$'),
  csv_sha256 text not null check (csv_sha256 ~ '^[0-9a-f]{64}$'),
  file_bytes bigint not null, row_count bigint not null, control_sum numeric,
  row_offset bigint not null check (row_offset >= 0),
  min_key text, max_key text,
  received_at timestamptz, received_sha256 text, received_row_count bigint, received_control_sum numeric,
  nas_attested_at timestamptz, nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente', 'conteudo_divergente')),
  primary key (unit_id, part)
);

create table if not exists public.obs_archive_months (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  table_name text not null,
  month date not null check (month = date_trunc('month', month)::date),
  units_total integer, units_empty integer, rows_total bigint, days_measured integer, days_in_month integer,
  manifest_version integer, manifest_sha256 text, manifest_list_sha256 text, manifest_bytes bigint, manifest_list_bytes bigint,
  manifest_received_at timestamptz, manifest_nas_attested_at timestamptz, manifest_nas_withdrawn_at timestamptz,
  sealed_at timestamptz, sealed_version integer, sealed_kind text check (sealed_kind in ('com_dado', 'vazio_conferido', 'sem_dado_a_guardar')),
  nas_attested_at timestamptz,
  b2_forja_ok_at timestamptz, b2_forja_manifest_sha256 text, b2_dono_ok_at timestamptz, b2_dono_manifest_sha256 text, b2_dono_by text,
  b2_attested_at timestamptz, b2_attested_by text, b2_attested_via text check (b2_attested_via in ('forja', 'dono')), b2_manifest_sha256 text,
  b2_last_attempt_at timestamptz, b2_last_attempt_result text, b2_last_attempt_via text check (b2_last_attempt_via in ('forja', 'dono')),
  b2_withdrawn_at timestamptz, b2_withdrawn_reason text, b2_withdrawn_via text check (b2_withdrawn_via in ('forja', 'dono')),
  b2_forja_diverged_at timestamptz,
  detached_at timestamptz, detached_by uuid,
  dropped_at timestamptz, dropped_by uuid, drop_mode text check (drop_mode in ('clique', 'automatico')), rows_dropped bigint, bytes_freed bigint,
  closed_at timestamptz, closed_by uuid,
  unsealed_at timestamptz, unsealed_reason text check (unsealed_reason in ('conteudo_mudou', 'mudou_no_destaque', 'unidade_nova', 'expurgo')),   -- expurgo: a M9 reabre o mês para refazer o manifesto
  unique (site_id, class, table_name, month)
);
create index if not exists idx_oam_detached on public.obs_archive_months (site_id) where detached_at is not null and dropped_at is null;

create table if not exists public.obs_archive_prechecks (
  site_id uuid not null, class text not null, table_name text not null, month date not null, channel_ref text not null,
  checked_at timestamptz not null default now(),
  primary key (site_id, class, table_name, month, channel_ref)
);
create table if not exists public.obs_archive_restores (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, class text not null, table_name text not null, schema_fp text not null,
  origem text not null check (origem = 'b2'), chave text not null check (chave = 'cofre'),
  units_checked integer not null, rows_restored bigint not null, diff_rows bigint not null,
  done_by text not null, done_at timestamptz not null default now()
);
create index if not exists idx_oar_class_table on public.obs_archive_restores (site_id, class, table_name, done_at desc);
create table if not exists public.obs_archive_switch (
  site_id uuid not null, class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  armed_by uuid, armed_at timestamptz, expires_at timestamptz, disarmed_at timestamptz, disarm_reason text,
  refusals_nas integer not null default 0,
  first_month date, first_month_at timestamptz,      -- D13: início da classe, calculado uma vez pelo plano e lido daqui (Phil M7)
  primary key (site_id, class)
);
create table if not exists public.obs_archive_heartbeat (
  site_id uuid not null, worker text not null check (worker in ('copiador', 'respondedor', 'conferir_b2')),
  last_poll_at timestamptz, version text, nas_ok boolean, nas_checked_at timestamptz,
  sentinel_ok jsonb, mounts_ok jsonb, machine_time timestamptz, free_bytes jsonb, total_bytes jsonb,
  stopped_at_cap text check (stopped_at_cap in ('dia', 'mes')),   -- C8: parado_no_teto, só do conferir_b2
  last_error text, updated_at timestamptz,
  primary key (site_id, worker)
);
create table if not exists public.obs_archive_purges (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, class text not null, table_name text not null, channel_ref text not null, month date not null,
  from_version integer not null, to_version integer not null, rows_removed bigint not null, done_at timestamptz not null default now()
);
create table if not exists public.obs_archive_unit_attachments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  unit_id uuid not null references public.obs_archive_units(id) on delete restrict,
  class text not null default 'video_antigo' check (class = 'video_antigo'),
  channel_ref text not null,
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'), ext text check (ext in ('jpg', 'png', 'webp')), file_bytes bigint,
  origin_url text not null, blob_url text,
  estado text not null default 'pendente' check (estado in ('pendente', 'baixado', 'perdida_na_origem', 'recusado')),
  missing_first_at timestamptz, missing_last_at timestamptz,
  received_at timestamptz, nas_attested_at timestamptz, nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente'))
);
create index if not exists idx_oaua_channel on public.obs_archive_unit_attachments (site_id, channel_ref);
create table if not exists public.obs_archive_summaries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo', 'ensaio')),
  channel_ref text not null, month date not null, version integer not null check (version between 1 and 9999),
  empty boolean not null,
  canal_sha256 text, canal_bytes bigint, canal_rows integer,
  video_sha256 text, video_bytes bigint, video_rows integer,
  ficha_sha256 text, ficha_bytes bigint, ficha_rows integer,
  unit_hashes jsonb not null,                       -- {"u:<id>": "<hash_conteudo>"} das unidades de que foi gerado
  exported_at timestamptz not null default now(), received_at timestamptz,
  nas_attested_at timestamptz, nas_withdrawn_at timestamptz,
  nas_withdrawn_reason text check (nas_withdrawn_reason in ('ausente', 'divergente', 'conteudo_divergente')),
  superseded_at timestamptz, lost_at timestamptz,
  purged_at timestamptz, purged_by uuid, purge_ref text,
  unique (site_id, class, channel_ref, month, version),
  check (empty = (canal_sha256 is null)),
  check ((purged_at is null) = (purged_by is null))
);
create index if not exists idx_oas_site_channel on public.obs_archive_summaries (site_id, channel_ref);       -- P36
create table if not exists public.obs_archive_channel_removals (
  site_id uuid not null, channel_ref text not null,
  youtube_channel_id text, name_at_removal text,
  removed_at timestamptz, removed_by uuid,
  removed_via text not null check (removed_via in ('botao', 'fila', 'e10_export', 'vigia')),
  archive_decision text not null check (archive_decision in ('apagar', 'guardar')),
  decided_at timestamptz not null, decided_by uuid,
  units_at_removal integer not null default 0, bytes_at_removal bigint not null default 0, first_month date, last_month date,
  removed_item_id bigint,
  blobs_pending text[] not null default '{}',
  online_thumbs_known boolean not null,
  thumbs_unknown_ack_at timestamptz,
  declared_xid xid8,
  nas_absent_first_at timestamptz, nas_absent_at timestamptz, b2_absent_at timestamptz, snapshots_clear_on date,
  completed_at timestamptz, reappeared_at timestamptz, reappeared_count integer not null default 0,
  primary key (site_id, channel_ref),
  check (archive_decision = 'apagar' or removed_via = 'e10_export')
);
create index if not exists idx_oacr_open on public.obs_archive_channel_removals (site_id) where completed_at is null;    -- P36

-- D5: o que o spec descreve sem dizer onde mora.
create table if not exists public.obs_archive_b2_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, started_at timestamptz not null default now(), expires_at timestamptz not null,
  modo text not null check (modo in ('normal', 'completo')),
  negative_name text not null, negative_filho text not null check (negative_filho in ('numerico', 'texto')),
  canary_days jsonb not null,                        -- {"numerico": "AAAA-MM-DD" | null, "texto": ...}
  negative_ok boolean, canary_ok jsonb not null default '{}'::jsonb,   -- {"numerico": true|false}
  estado text not null default 'aguardando_controle' check (estado in ('aguardando_controle', 'controle_ok', 'controle_falhou')),
  files_reported integer not null default 0,
  -- r2.2 (I3 do Phil): a retomada do completo entre execuções. Nulas no modo normal.
  completo_desde timestamptz,                        -- início do completo em aberto; herdado pela execução que retoma
  retomado_de text,                                  -- o cursor de onde esta execução partiu (null = do zero)
  paginas jsonb not null default '[]'::jsonb,        -- páginas servidas aqui, em ordem: [{"ate": <arquivo_id>, "ids": [...], "ultima": bool, "aceita": bool}]
  paginas_aceitas integer not null default 0,        -- herdadas + aceitas aqui
  paginas_total integer,                             -- na abertura: aceitas + páginas de 500 que faltam
  cursor_aceito text,                                -- `<execucao_id>|<arquivo_id>` da última página aceita; herdado
  completo_fechado_em timestamptz,                   -- hora do banco em que a última página foi aceita
  -- r2.2 (M6 do Phil): o histórico do teto de bytes, marcado pelo batimento do conferir_b2.
  batimento_em timestamptz,
  parou_no_teto text check (parou_no_teto in ('dia', 'mes'))
);
create index if not exists idx_oab2r_completo on public.obs_archive_b2_runs (site_id, started_at desc) where modo = 'completo';
create table if not exists public.obs_archive_b2_files (
  site_id uuid not null, arquivo_id text not null, class text not null, month date not null,
  last_ok_at timestamptz, last_ok_via text check (last_ok_via in ('forja', 'dono')), last_ok_file_id text, last_ok_upload_ts bigint,
  last_attempt_at timestamptz, last_attempt_result text, last_attempt_run uuid,
  pending_mismatch jsonb, pending_since timestamptz, pending_run uuid,
  primary key (site_id, arquivo_id)
);
create index if not exists idx_oabf_month on public.obs_archive_b2_files (site_id, class, month);
create table if not exists public.obs_archive_canaries (
  site_id uuid not null, filho text not null check (filho in ('numerico', 'texto')), dia date not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'), informed_at timestamptz not null default now(),
  b2_ok_at timestamptz, b2_file_id text, b2_failed_at timestamptz,
  primary key (site_id, filho, dia)
);
create table if not exists public.obs_archive_sweeps (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null, due_since timestamptz not null, nas_back_at timestamptz, started_at timestamptz, finished_at timestamptz,
  motivo text not null check (motivo in ('silencio_nas', 'pedido'))
);
create unique index if not exists idx_oasw_open on public.obs_archive_sweeps (site_id) where finished_at is null;

alter table public.competitor_removed_items add column if not exists archive_note text;     -- D15

do $$
declare t text;
begin
  foreach t in array array['obs_archive_units', 'obs_archive_unit_parts', 'obs_archive_months', 'obs_archive_prechecks', 'obs_archive_restores',
    'obs_archive_switch', 'obs_archive_heartbeat', 'obs_archive_purges', 'obs_archive_unit_attachments', 'obs_archive_summaries',
    'obs_archive_channel_removals', 'obs_archive_b2_runs', 'obs_archive_b2_files', 'obs_archive_canaries', 'obs_archive_sweeps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    -- K3: os privilégios padrão do Supabase dão tudo ao service_role; o registro só se escreve pelas funções.
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    if t = 'obs_archive_unit_parts' then
      execute format('create policy %I on public.%I for select using (exists (select 1 from public.obs_archive_units u where u.id = unit_id and public.can_edit_site(u.site_id)))', t || '_select', t);
    else
      execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_select', t);
    end if;
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
  foreach t in array array['obs_archive_units', 'obs_archive_months', 'obs_archive_restores', 'obs_archive_prechecks', 'obs_archive_purges'] loop
    execute format('drop trigger if exists obs_archive_class_table on public.%I', t);
    execute format('create trigger obs_archive_class_table before insert or update of class, table_name on public.%I for each row execute function public.obs_archive_class_table_guard()', t);
  end loop;
end $$;
revoke all on function public.obs_archive_class_table_guard() from public, anon, authenticated, service_role;

-- M3B PARTE 2: o leitor único e os hashes. O trecho entre os marcadores é supabase/sql/obs-archive-hash.sql, byte a byte (D17).
-- obs-archive-hash.sql: início
-- O corpo único de obs_archive_schema_fp, obs_archive_unit_source, obs_archive_content_hash e obs_archive_read_unit (spec 02 §9.3,
-- decisão B; §10.4). Lido pela migration da M3b (byte a byte, entre marcadores) e pelo comando ensaiar-restauracao (M8).
-- Os cinco ajustes de sessão ficam no cabeçalho de cada função: o resultado não depende de quem chama.

create or replace function public.obs_archive_schema_fp(p_rel regclass)
returns text language sql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
  select encode(sha256(convert_to(string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), E'\n' order by a.attnum), 'UTF8')), 'hex')
    from pg_catalog.pg_attribute a
   where a.attrelid = p_rel and a.attnum > 0 and not a.attisdropped
$$;

create or replace function public.obs_archive_unit_source(p_class text, p_table text)
returns table (rel regclass, from_where text, order_by text, control_expr text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
-- $1 site, $2 canal, $3 mês (date, dia 1), $4 início e $5 fim do mês em São Paulo com -03 explícito (timestamptz), $6 dia 1 do mês seguinte (date)
declare
  v_rel regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_pol record;
  v_pk text;
  -- competitor_videos não tem site_id: o site vem do canal (Phil I1; 20261007000002_...:37).
  v_video text := 'join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id where ch.site_id = $1 and v.competitor_channel_id = $2';
begin
  select * into v_pol from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  if not found then raise exception 'classe_tabela_invalida' using errcode = 'P0001', detail = p_class || '/' || p_table; end if;
  if v_rel is null then raise exception 'tabela_ausente' using errcode = 'P0001', detail = p_table; end if;
  select string_agg('t.' || pg_catalog.quote_ident(a.attname), ', ' order by k.ord) into v_pk
    from pg_catalog.pg_index i
    cross join lateral unnest(i.indkey) with ordinality k(attnum, ord)
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
   where i.indrelid = v_rel and i.indisprimary;
  if v_pk is null then raise exception 'sem_chave_primaria' using errcode = 'P0001', detail = p_table; end if;
  rel := v_rel; order_by := v_pk;
  control_expr := case when v_pol.control_column is null then 'null::numeric' else 't.' || pg_catalog.quote_ident(v_pol.control_column) || '::numeric' end;
  from_where := case
    when p_class = 'horaria' then format('from public.%I t %s and t.hour_slot >= $4 and t.hour_slot < $5', p_table, v_video)
    when p_class = 'ensaio' then 'from public.obs_archive_rehearsal t join public.competitor_videos v on v.id = t.video_id where t.site_id = $1 and v.competitor_channel_id = $2 and t.hour_slot >= $4 and t.hour_slot < $5'
    when p_table = 'competitor_video_daily' then format('from public.%I t %s and t.snap_date >= $3 and t.snap_date < $6', p_table, v_video)
    when p_table = 'competitor_video_early' then format('from public.%I t %s and t.taken_at >= $4 and t.taken_at < $5', p_table, v_video)
    when p_class = 'texto' and p_table = 'competitor_video_comments' then
      'from public.competitor_video_comments t left join public.competitor_video_comments p on p.id = t.parent_id
        where t.site_id = $1 and t.competitor_channel_id = $2 and coalesce(p.first_seen_at, t.first_seen_at) >= $4 and coalesce(p.first_seen_at, t.first_seen_at) < $5'
    when p_class = 'texto' and p_table = 'competitor_video_comment_marks' then
      'from public.competitor_video_comment_marks t join public.competitor_video_comments k on k.id = t.comment_id
        left join public.competitor_video_comments p on p.id = k.parent_id
        where k.site_id = $1 and k.competitor_channel_id = $2 and coalesce(p.first_seen_at, k.first_seen_at) >= $4 and coalesce(p.first_seen_at, k.first_seen_at) < $5'
    when p_class = 'texto' and p_table = 'competitor_raw' then
      'from public.competitor_raw t where t.site_id = $1 and t.competitor_channel_id = $2 and not t.is_current and t.last_seen_at >= $4 and t.last_seen_at < $5'
    when p_class = 'video_antigo' and p_table = 'competitor_raw' then
      format('from public.competitor_raw t %s and t.is_current and v.archive_frozen_at >= $4 and v.archive_frozen_at < $5', v_video)
    when p_class = 'video_antigo' then
      format('from public.%I t %s and v.archive_frozen_at >= $4 and v.archive_frozen_at < $5', p_table, v_video)
  end;
  return next;
end $$;

create or replace function public.obs_archive_read_unit(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_offset bigint, p_limit integer)
returns table (rows jsonb, row_count bigint, control_sum text, hash_conteudo text, columns jsonb, schema_fp text, first_key text, last_key text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v_cols text; v_colnames jsonb; v_keyexpr text;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_offset < 0 or p_limit < 1 or p_limit > 50000 then raise exception 'faixa_invalida' using errcode = 'P0001'; end if;
  select * into s from public.obs_archive_unit_source(p_class, p_table);
  select string_agg('t.' || pg_catalog.quote_ident(a.attname) || '::text', ', ' order by a.attnum),
         jsonb_agg(jsonb_build_object('nome', a.attname, 'tipo', pg_catalog.format_type(a.atttypid, a.atttypmod), 'nulo', not a.attnotnull) order by a.attnum)
    into v_cols, v_colnames
    from pg_catalog.pg_attribute a where a.attrelid = s.rel and a.attnum > 0 and not a.attisdropped;
  v_keyexpr := 'concat_ws(''|'', ' || s.order_by || ')';
  return query execute format(
    'with u as (select to_jsonb(array[%1$s]::text[]) as r, %2$s as k, %3$s as c, row_number() over (order by %4$s) as n %5$s)
     select (select coalesce(jsonb_agg(u.r order by u.n), ''[]''::jsonb) from u where u.n > $7 and u.n <= $7 + $8),
            (select count(*) from u)::bigint,
            (coalesce((select sum(u.c) from u), $11::numeric))::text,
            (select encode(sha256(convert_to(coalesce(string_agg(u.r::text, E''\n'' order by u.n), ''''), ''UTF8'')), ''hex'') from u),
            $9::jsonb, public.obs_archive_schema_fp($10),
            (select u.k from u where u.n = $7 + 1),
            (select u.k from u where u.n = least($7 + $8, (select count(*) from u)))',
    v_cols, v_keyexpr, s.control_expr, s.order_by, s.from_where)
  using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date, p_offset, p_limit, v_colnames, s.rel,
        case when s.control_expr = 'null::numeric' then null::numeric else 0::numeric end;
end $$;

create or replace function public.obs_archive_content_hash(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date)
returns table (row_count bigint, control_sum text, hash_conteudo text)
language sql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
  select r.row_count, r.control_sum, r.hash_conteudo from public.obs_archive_read_unit(p_site, p_class, p_table, p_channel, p_month, 0, 1) r
$$;
-- obs-archive-hash.sql: fim
revoke all on function public.obs_archive_schema_fp(regclass) from public, anon, authenticated;
revoke all on function public.obs_archive_unit_source(text, text) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_read_unit(uuid, text, text, uuid, date, bigint, integer) from public, anon, authenticated;
revoke all on function public.obs_archive_content_hash(uuid, text, text, uuid, date) from public, anon, authenticated;
grant execute on function public.obs_archive_read_unit(uuid, text, text, uuid, date, bigint, integer) to service_role;
grant execute on function public.obs_archive_content_hash(uuid, text, text, uuid, date) to service_role;
grant execute on function public.obs_archive_schema_fp(regclass) to service_role;
-- M3B PARTE 3: gravação, recebimento, resumo, manifesto, selagem e conferência do NAS

alter table public.obs_archive_units add column if not exists nas_reported_at timestamptz;          -- último informe com o filho montado (varredura: 02 §10.10)
alter table public.obs_archive_unit_parts add column if not exists nas_reported_at timestamptz;
alter table public.obs_archive_summaries add column if not exists nas_reported_at timestamptz;
alter table public.obs_archive_summaries add column if not exists received_papers text[] not null default '{}';
alter table public.obs_archive_months add column if not exists manifest_created_at timestamptz;
alter table public.obs_archive_months add column if not exists manifest_received_papers text[] not null default '{}';
alter table public.obs_archive_months add column if not exists manifest_nas_reported_at timestamptz;
-- Desvio de 14/10 (ledger): o plano pede o vermelho nas_ilegivel:<arquivo_id> e canario_regravado:<filho>, mas não dá onde guardá-los. Duas colunas.
alter table public.obs_archive_units add column if not exists nas_unreadable_at timestamptz;
alter table public.obs_archive_unit_parts add column if not exists nas_unreadable_at timestamptz;
alter table public.obs_archive_summaries add column if not exists nas_unreadable_at timestamptz;
alter table public.obs_archive_canaries add column if not exists regravado_at timestamptz;

-- O dia de hoje em São Paulo. Em teste, `obs_archive.hoje` (texto AAAA-MM-DD, local à transação) fixa o relógio.
-- Dívida declarada (Yannis M6): gancho de teste em função de produção; só quem tem SQL fixa o GUC, e só na própria transação.
create or replace function public.obs_archive_hoje_sp() returns date language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('obs_archive.hoje', true), '')::date, (now() at time zone 'America/Sao_Paulo')::date)
$$;
revoke all on function public.obs_archive_hoje_sp() from public, anon, authenticated, service_role;

-- O dia em que o mês fica devido: último dia do mês + margem (02 l.169). A única conta (D20); gravação, plano, atraso e vermelhos a chamam.
create or replace function public.obs_archive_due_on(p_month date, p_margin integer)
returns date language sql immutable set search_path = '' as $$
  select ((p_month + interval '1 month')::date - 1) + p_margin
$$;
revoke all on function public.obs_archive_due_on(date, integer) from public, anon, authenticated;
grant execute on function public.obs_archive_due_on(date, integer) to service_role;

-- O devido num (classe, mês): a única definição (D19, regra D14). O plano, o atraso, o resumo, o manifesto, a selagem e
-- obs_archive_unit_due a chamam (teste de catálogo por prosrc). Provada no bythiago_int em 14/10 (begin … rollback), menos o ramo do rol do ensaio.
-- Canal removido (sem linha em competitor_channels, a regra de obs_archive_record_core) nunca entra.
create or replace function public.obs_archive_expected_units(p_site uuid, p_class text, p_month date)
returns table (table_name text, channel_ref text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ini timestamptz;            -- 00:00 de São Paulo do dia 1 do mês ($4 do leitor)
  v_fim timestamptz;            -- 00:00 de São Paulo do dia 1 do mês seguinte ($5); também o corte do added_at (D14)
  v_seg date;                   -- dia 1 do mês seguinte ($6)
  v_inicio date;
  v_rol regclass;
  v_t record;
  v_src record;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    raise exception 'mes_invalido' using errcode = 'P0001';
  end if;
  if p_class = 'video_antigo' then return; end if;                                -- (c) nenhum até a M10b
  v_seg := (p_month + interval '1 month')::date;
  v_ini := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim := (v_seg::text || ' 00:00:00-03')::timestamptz;
  -- D13: início da classe, lido de obs_archive_switch (gravado pelo plano). Piso de outubro de 2026, menos no ensaio.
  -- Início ainda não calculado: vale só o piso (nunca "nada devido", que seria verde falso).
  select s.first_month into v_inicio from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class;
  if p_class <> 'ensaio' then
    v_inicio := greatest(coalesce(v_inicio, date '2026-10-01'), date '2026-10-01');
  end if;
  if v_inicio is not null and p_month < v_inicio then return; end if;
  v_rol := case when p_class = 'ensaio' then pg_catalog.to_regclass('public.obs_archive_rehearsal_seed') end;
  for v_t in select p.table_name from public.obs_archive_policy() p where p.class = p_class order by p.table_name loop
    if p_class = 'ensaio' and v_rol is not null then
      -- (b) o rol da carga (M8), inclusive o canal sem linha; só canal que existe
      return query execute format(
        'select %L::text, c.id::text
           from public.competitor_channels c
          where c.site_id = $1
            and exists (select 1 from %s r where r.site_id = $1 and r.month = $2 and r.channel_ref = c.id::text)',
        v_t.table_name, v_rol)
        using p_site, p_month;
    elsif pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(v_t.table_name)) is null then
      -- tabela da política ausente: os cadastrados continuam devidos e a exportação responde 409 tabela_ausente (vermelho), nunca some
      return query
        select v_t.table_name, c.id::text from public.competitor_channels c
         where c.site_id = p_site and p_class <> 'ensaio'
           and coalesce(c.added_at, '-infinity'::timestamptz) < v_fim;
    else
      -- (a) cadastrado antes do fim do mês, ou com linha no mês na tabela; (b) sem rol: só os com linha.
      -- Uma consulta por tabela, com o canal correlacionado no from_where do leitor ($2 vira c.id), nunca um laço por canal.
      select * into v_src from public.obs_archive_unit_source(p_class, v_t.table_name);
      return query execute format(
        'select %L::text, c.id::text
           from public.competitor_channels c
          where c.site_id = $1
            and (%s or exists (select 1 %s))',
        v_t.table_name,
        case when p_class = 'ensaio' then 'false' else 'coalesce(c.added_at, ''-infinity''::timestamptz) < $5' end,
        replace(v_src.from_where, '$2', 'c.id'))
        using p_site, null::uuid, p_month, v_ini, v_fim, v_seg;
    end if;
  end loop;
end $$;
revoke all on function public.obs_archive_expected_units(uuid, text, date) from public, anon, authenticated;
grant execute on function public.obs_archive_expected_units(uuid, text, date) to service_role;

-- Unidade devida (D24): o par está em obs_archive_expected_units, o mês não é anterior ao início da classe (D13) e já chegou ao dia devido.
create or replace function public.obs_archive_unit_due(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.obs_archive_expected_units(p_site, p_class, p_month) e
                  where e.table_name = p_table and e.channel_ref = p_channel::text)
$$;
revoke all on function public.obs_archive_unit_due(uuid, text, text, uuid, date) from public, anon, authenticated, service_role;

-- Os arquivos de um mês (D23): do conjunto corrente (a versão mais nova já recebida por (tabela, canal): a selada até a nova chegar, item 78;
-- sem nenhuma recebida, a mais nova; arquivo retirado (nas_withdrawn_at) sai com nas_attested_at nulo),
-- unidades com row_count > 0 e parts = 1, as partes das unidades com parts > 1, os resumos (maior versão por canal) com
-- empty = false, um arquivo por papel, e os dois arquivos do manifesto da maior versão; fora lost_at e purged_at.
-- Unidade vazia e resumo vazio não têm arquivo e nunca entram. Usada em reconferir, no plano do B2, em nas_attested_at,
-- em b2_forja_ok_at e em pode_desligar. Os caminhos são os do contrato C0.2. Provada no bythiago_int em 14/10 (begin … rollback).
create or replace function public.obs_archive_month_files(p_site uuid, p_class text, p_month date)
returns table (arquivo_id text, tipo text, filho text, caminho text, table_name text, channel_ref text, version integer,
               control_column text, file_bytes bigint, received_at timestamptz, nas_attested_at timestamptz, b2_ok_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with pol as (
    select p.table_name, p.control_column, p.filho from public.obs_archive_policy() p where p.class = p_class
  ), cls as (
    select min(pol.filho) as filho, to_char(p_month, 'YYYY-MM') as mes from pol      -- cada classe mora num filho só
  ), u as (
    select distinct on (x.table_name, x.channel_ref) x.*
      from public.obs_archive_units x
     where x.site_id = p_site and x.class = p_class and x.month = p_month
     order by x.table_name, x.channel_ref, (x.received_at is not null) desc, x.version desc
  ), s as (
    select distinct on (y.channel_ref) y.*
      from public.obs_archive_summaries y
     where y.site_id = p_site and y.class = p_class and y.month = p_month
     order by y.channel_ref, (y.received_at is not null) desc, y.version desc
  ), man as (
    select o.manifest_version, o.manifest_sha256, o.manifest_list_sha256, o.manifest_bytes, o.manifest_list_bytes,
           o.manifest_received_at, o.manifest_nas_attested_at, o.manifest_nas_withdrawn_at
      from public.obs_archive_months o
     where o.site_id = p_site and o.class = p_class and o.month = p_month and o.manifest_version is not null
     order by o.manifest_version desc
     limit 1
  ), f (arquivo_id, tipo, filho, caminho, table_name, channel_ref, version, control_column, file_bytes, received_at, nas_attested_at) as (
  select 'u:' || u.id, 'unidade', cls.filho,
         p_class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || cls.mes || '.v' || u.version || '.csv.gz',
         u.table_name, u.channel_ref, u.version, pol.control_column, u.file_bytes, u.received_at, case when u.nas_withdrawn_at is not null then null else u.nas_attested_at end
    from u join pol on pol.table_name = u.table_name cross join cls
   where u.row_count > 0 and u.parts = 1 and u.lost_at is null and u.purged_at is null
  union all
  select 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0'), 'parte', cls.filho,
         p_class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || cls.mes || '.v' || u.version
           || '.p' || lpad(pt.part::text, 2, '0') || '.csv.gz',
         u.table_name, u.channel_ref, u.version, pol.control_column, pt.file_bytes, pt.received_at, case when pt.nas_withdrawn_at is not null then null else pt.nas_attested_at end
    from u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join pol on pol.table_name = u.table_name cross join cls
   where u.row_count > 0 and u.parts > 1 and u.lost_at is null and u.purged_at is null
  union all
  select 's:' || s.id || ':' || r.papel, 'resumo', cls.filho,
         p_class || '/canais/' || s.channel_ref || '/resumo/' || cls.mes || '.v' || s.version || '.' || r.papel || '.csv.gz',
         null::text, s.channel_ref, s.version, null::text, r.bytes, s.received_at, case when s.nas_withdrawn_at is not null then null else s.nas_attested_at end
    from s cross join lateral (values ('canal', s.canal_sha256, s.canal_bytes),
                                      ('video', s.video_sha256, s.video_bytes),
                                      ('ficha', s.ficha_sha256, s.ficha_bytes)) r(papel, sha, bytes)   -- ficha só existe na video_antigo
         cross join cls
   where not s.empty and s.lost_at is null and s.purged_at is null and r.sha is not null
  union all
  select 'm:' || p_class || ':' || cls.mes || ':v' || man.manifest_version || ':' || k.ext, 'manifesto', cls.filho,
         p_class || '/manifestos/' || cls.mes || '.v' || man.manifest_version || '.' || k.ext,
         null::text, null::text, man.manifest_version, null::text, k.bytes, man.manifest_received_at, case when man.manifest_nas_withdrawn_at is not null then null else man.manifest_nas_attested_at end
    from man cross join lateral (values ('json', man.manifest_bytes), ('sha256', man.manifest_list_bytes)) k(ext, bytes)
         cross join cls
  )
  -- b2_ok_at: a última conferência boa do B2 daquele arquivo (forja ou dono), nula se nunca houve
  select f.*, b.last_ok_at
    from f left join public.obs_archive_b2_files b on b.site_id = p_site and b.arquivo_id = f.arquivo_id
$$;
revoke all on function public.obs_archive_month_files(uuid, text, date) from public, anon, authenticated;
grant execute on function public.obs_archive_month_files(uuid, text, date) to service_role;

-- A rede (02 §10.5): canal com remoção 'apagar' nunca ganha linha; versão nova de unidade retirada só pelo expurgo, de dentro da
-- função de gravação (dono da tabela) e com a marca presa a esta transação. security invoker de propósito (P56).
create or replace function public.obs_archive_insert_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_owner name; v_retirada boolean;
begin
  if exists (select 1 from public.obs_archive_channel_removals r where r.site_id = new.site_id and r.channel_ref = new.channel_ref and r.archive_decision = 'apagar') then
    raise exception 'canal_removido' using errcode = 'P0001', detail = new.channel_ref;
  end if;
  if tg_table_name = 'obs_archive_units' then
    select exists (select 1 from public.obs_archive_units u where u.site_id = new.site_id and u.class = new.class and u.table_name = new.table_name
                     and u.channel_ref = new.channel_ref and u.month = new.month and u.dropped_at is not null) into v_retirada;
  else
    select exists (select 1 from public.obs_archive_units u where u.site_id = new.site_id and u.class = new.class
                     and u.channel_ref = new.channel_ref and u.month = new.month and u.dropped_at is not null) into v_retirada;
  end if;
  if v_retirada then
    select pg_catalog.pg_get_userbyid(c.relowner) into v_owner from pg_catalog.pg_class c where c.oid = tg_relid;
    if not (current_user = v_owner and current_setting('obs_archive.origem', true) = 'expurgo:' || pg_current_xact_id()::text) then
      raise exception 'unidade_retirada' using errcode = 'P0001', detail = new.channel_ref;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists obs_archive_insert_guard on public.obs_archive_units;
create trigger obs_archive_insert_guard before insert on public.obs_archive_units for each row execute function public.obs_archive_insert_guard();
drop trigger if exists obs_archive_insert_guard on public.obs_archive_summaries;
create trigger obs_archive_insert_guard before insert on public.obs_archive_summaries for each row execute function public.obs_archive_insert_guard();

-- O único caminho de gravação de linha nova no registro. O _core não tem execute para o service_role (D22, K3): só a
-- casca sem p_origem é da aplicação, e a marca do expurgo (P56) só sai de função do dono.
create or replace function public.obs_archive_record_core(p_site uuid, p_kind text, p_payload jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_class text := p_payload->>'classe'; v_table text := p_payload->>'tabela';
  v_channel uuid := (p_payload->>'canal')::uuid; v_month date := (p_payload->>'mes')::date;
  v_dec text; v_pol record; v_last record; v_id uuid; v_ver int; v_empty boolean; v_novo_par boolean;
begin
  -- payload sem canal ou sem mês: hashtextextended(null) daria trava nula e o status sairia canal_removido (Yannis 11)
  if v_channel is null or v_month is null then raise exception 'payload_invalido' using errcode = 'P0001'; end if;
  -- duas gravações da versão 1 ao mesmo tempo: o for update sem linha não trava nada (Phil M6)
  perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|' || p_kind || '|' || coalesce(v_class, '') || '|' || coalesce(v_table, '')
                                                 || '|' || v_channel::text || '|' || v_month::text, 0));
  -- a marca é gravada em toda chamada, antes de qualquer insert (P56): vazia fora do expurgo
  perform set_config('obs_archive.origem', case when p_origem = 'expurgo' then 'expurgo:' || pg_current_xact_id()::text else '' end, true);
  perform 1 from public.competitor_channels c where c.id = v_channel and c.site_id = p_site for key share;
  if not found then
    select r.archive_decision into v_dec from public.obs_archive_channel_removals r
     where r.site_id = p_site and r.channel_ref = v_channel::text for share;
    if p_origem = 'expurgo' and v_dec = 'guardar' then null;            -- a única exceção (02 §10.5)
    elsif p_origem = 'expurgo' and v_dec is null then return jsonb_build_object('status', 'sem_destino');
    else return jsonb_build_object('status', 'canal_removido');
    end if;
  end if;
  if p_kind = 'unidade' then
    select * into v_pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = v_table;
    if not found then raise exception 'classe_tabela_invalida' using errcode = 'P0001'; end if;
    if p_origem is distinct from 'expurgo' and public.obs_archive_due_on(v_month, v_pol.seal_margin_days) > public.obs_archive_hoje_sp() then
      return jsonb_build_object('status', 'mes_aberto');
    end if;
    -- mês destacado ou descartado nunca se reexporta a partir do online (02 l.352, l.578; Phil C3)
    if p_origem is distinct from 'expurgo' and exists (select 1 from public.obs_archive_months m
         where m.site_id = p_site and m.class = v_class and m.table_name = v_table and m.month = v_month
           and (m.detached_at is not null or m.dropped_at is not null)) then
      return jsonb_build_object('status', 'mes_fora_do_banco');
    end if;
    -- a rota não grava o que o plano não pediria (Yannis M17)
    if p_origem is distinct from 'expurgo' and not public.obs_archive_unit_due(p_site, v_class, v_table, v_channel, v_month) then
      return jsonb_build_object('status', 'nao_devida');
    end if;
    select * into v_last from public.obs_archive_units u
     where u.site_id = p_site and u.class = v_class and u.table_name = v_table and u.channel_ref = v_channel::text and u.month = v_month
     order by u.version desc limit 1 for update;
    v_novo_par := not found;
    if found and v_last.dropped_at is not null and p_origem is distinct from 'expurgo' then return jsonb_build_object('status', 'unidade_retirada'); end if;
    -- reaproveita a versão nunca recebida também quando ela só foi marcada parte_mudou ou mudou_durante_a_leitura (Phil M3)
    if found and v_last.hash_conteudo = p_payload->>'hash_conteudo' and v_last.received_at is null
       and (v_last.redo_reason is null or v_last.redo_reason in ('parte_mudou', 'mudou_durante_a_leitura'))
       and v_last.superseded_at is null and p_origem is distinct from 'expurgo' then
      -- versão em andamento com parte já recebida: não reescreve as partes (Yannis M16)
      if exists (select 1 from public.obs_archive_unit_parts x where x.unit_id = v_last.id and x.received_at is not null) then
        return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
      end if;
      update public.obs_archive_units set sha256_bytes = nullif(p_payload->>'sha256_bytes', ''), csv_sha256 = nullif(p_payload->>'csv_sha256', ''),
             file_bytes = (p_payload->>'file_bytes')::bigint, parts = coalesce((p_payload->>'partes')::smallint, 1), min_key = p_payload->>'min_key', max_key = p_payload->>'max_key',
             redo_reason = null
       where id = v_last.id;
      delete from public.obs_archive_unit_parts where unit_id = v_last.id;
      v_id := v_last.id; v_ver := v_last.version;
    elsif found and v_last.hash_conteudo = p_payload->>'hash_conteudo' and v_last.received_at is not null and v_last.redo_reason is null
          and v_last.superseded_at is null and p_origem is distinct from 'expurgo' then
      return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 'u:' || v_last.id, 'versao', v_last.version);
    else
      v_ver := coalesce(v_last.version, 0) + 1;
      -- par novo: trava as linhas do mês (units -> months, a ordem do receive) ANTES de gravar a unidade. Sem isto, a selagem que confirma entre
      -- o insert e o teste de sealed_at abaixo sela sem o par novo e o reabrir (unidade_nova) se perde (Yannis 5). For update, não for share:
      -- dois pares novos ao mesmo tempo num mês selado se enfileiram em vez de travar um no outro ao subir para o update do reabrir.
      if v_novo_par then
        perform 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month order by m.table_name for update;
      end if;
      v_empty := (p_payload->>'row_count')::bigint = 0;
      insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp,
             sha256_bytes, csv_sha256, file_bytes, parts, min_key, max_key, origem, received_at, received_row_count, received_control_sum)
      values (p_site, v_class, v_table, v_channel::text, v_month, v_ver, (p_payload->>'row_count')::bigint, (p_payload->>'control_sum')::numeric,
              p_payload->>'hash_conteudo', p_payload->>'schema_fp', nullif(p_payload->>'sha256_bytes', ''), nullif(p_payload->>'csv_sha256', ''),
              (p_payload->>'file_bytes')::bigint, coalesce((p_payload->>'partes')::smallint, 1), p_payload->>'min_key', p_payload->>'max_key',
              case when p_origem = 'expurgo' then 'expurgo' else 'rota' end,
              case when v_empty then now() end, case when v_empty then 0 end, case when v_empty then (p_payload->>'control_sum')::numeric end)
      returning id into v_id;
    end if;
    insert into public.obs_archive_unit_parts (unit_id, part, sha256_bytes, csv_sha256, file_bytes, row_count, control_sum, row_offset, min_key, max_key)
    select v_id, (x->>'parte')::smallint, x->>'sha256_bytes', x->>'csv_sha256', (x->>'file_bytes')::bigint, (x->>'row_count')::bigint,
           (x->>'control_sum')::numeric, (x->>'row_offset')::bigint, x->>'min_key', x->>'max_key'
      from jsonb_array_elements(coalesce(p_payload->'parts', '[]'::jsonb)) x;
    insert into public.obs_archive_months (site_id, class, table_name, month) values (p_site, v_class, v_table, v_month) on conflict do nothing;
    -- par novo num mês já selado reabre o selo (Phil C1)
    if v_novo_par and exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month and m.sealed_at is not null) then
      update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'unidade_nova'
       where site_id = p_site and class = v_class and month = v_month;
    end if;
    return jsonb_build_object('status', case when v_id = v_last.id then 'mesma' else 'nova' end, 'arquivo_id', 'u:' || v_id, 'versao', v_ver);
  elsif p_kind = 'resumo' then
    if not exists (select 1 from public.obs_archive_policy() p where p.class = v_class) then raise exception 'classe_tabela_invalida' using errcode = 'P0001'; end if;
    -- o resumo de um mês fora do banco não se refaz do online (02 l.578)
    if exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.month = v_month and (m.detached_at is not null or m.dropped_at is not null)) then
      return jsonb_build_object('status', 'ja_no_arquivo');
    end if;
    select * into v_last from public.obs_archive_summaries s
     where s.site_id = p_site and s.class = v_class and s.channel_ref = v_channel::text and s.month = v_month
     order by s.version desc limit 1 for update;
    if found and v_last.unit_hashes = p_payload->'unit_hashes' and v_last.superseded_at is null and v_last.nas_withdrawn_at is null then
      if v_last.received_at is not null then return jsonb_build_object('status', 'nao_devida', 'arquivo_id', 's:' || v_last.id, 'versao', v_last.version); end if;
      update public.obs_archive_summaries set canal_sha256 = p_payload->>'canal_sha256', canal_bytes = (p_payload->>'canal_bytes')::bigint,
             canal_rows = (p_payload->>'canal_rows')::int, video_sha256 = p_payload->>'video_sha256', video_bytes = (p_payload->>'video_bytes')::bigint,
             video_rows = (p_payload->>'video_rows')::int, received_papers = '{}'
       where id = v_last.id;
      return jsonb_build_object('status', 'mesma', 'arquivo_id', 's:' || v_last.id, 'versao', v_last.version);
    end if;
    v_ver := coalesce(v_last.version, 0) + 1;
    v_empty := (p_payload->>'vazio')::boolean;
    insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows,
           video_sha256, video_bytes, video_rows, unit_hashes, received_at)
    values (p_site, v_class, v_channel::text, v_month, v_ver, v_empty, p_payload->>'canal_sha256', (p_payload->>'canal_bytes')::bigint,
            (p_payload->>'canal_rows')::int, p_payload->>'video_sha256', (p_payload->>'video_bytes')::bigint, (p_payload->>'video_rows')::int,
            p_payload->'unit_hashes', case when v_empty then now() end)
    returning id into v_id;
    return jsonb_build_object('status', 'nova', 'arquivo_id', 's:' || v_id, 'versao', v_ver);
  end if;
  raise exception 'tipo_invalido' using errcode = 'P0001';
end $$;
revoke all on function public.obs_archive_record_core(uuid, text, jsonb, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_record(p_site uuid, p_kind text, p_payload jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select public.obs_archive_record_core(p_site, p_kind, p_payload, null)
$$;
revoke all on function public.obs_archive_record(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_record(uuid, text, jsonb) to service_role;
revoke all on function public.obs_archive_insert_guard() from public, anon, authenticated, service_role;

-- ===== internas (sem execute para ninguém além do dono): o conjunto corrente, o terminal, os pendentes, o refazer =====

-- Terminal (a mesma definição em toda parte): recebida e sem pedido de refazer, ou vazia, ou perdida, ou expurgada.
create or replace function public.obs_archive_is_terminal(p_received_at timestamptz, p_redo text, p_rows bigint, p_lost timestamptz, p_purged timestamptz)
returns boolean language sql immutable set search_path = '' as $$
  select (p_received_at is not null and p_redo is null) or p_rows = 0 or p_lost is not null or p_purged is not null
$$;
revoke all on function public.obs_archive_is_terminal(timestamptz, text, bigint, timestamptz, timestamptz) from public, anon, authenticated, service_role;

-- O conjunto corrente: a maior versão por (tabela, canal) de uma classe e mês.
create or replace function public.obs_archive_current_units(p_site uuid, p_class text, p_month date)
returns setof public.obs_archive_units language sql stable security definer set search_path = '' as $$
  select distinct on (x.table_name, x.channel_ref) x.*
    from public.obs_archive_units x
   where x.site_id = p_site and x.class = p_class and x.month = p_month
   order by x.table_name, x.channel_ref, x.version desc
$$;
revoke all on function public.obs_archive_current_units(uuid, text, date) from public, anon, authenticated, service_role;

-- O que ainda falta antes do resumo, do manifesto e do selo: par esperado sem unidade nenhuma ('faltando:<tabela>:<canal>') e
-- unidade corrente que não é terminal ('u:<id>'). Zero unidade é pendente, nunca terminal (Phil C1). p_channel nulo = todos os canais.
create or replace function public.obs_archive_pending_units(p_site uuid, p_class text, p_month date, p_channel text default null)
returns table (faltando text, unidade text) language sql stable security definer set search_path = '' as $$
  with cur as (select * from public.obs_archive_current_units(p_site, p_class, p_month))
  select 'faltando:' || e.table_name || ':' || e.channel_ref, null::text
    from public.obs_archive_expected_units(p_site, p_class, p_month) e
   where (p_channel is null or e.channel_ref = p_channel)
     and not exists (select 1 from cur where cur.table_name = e.table_name and cur.channel_ref = e.channel_ref)
  union all
  select null::text, 'u:' || cur.id
    from cur
   where (p_channel is null or cur.channel_ref = p_channel)
     and not public.obs_archive_is_terminal(cur.received_at, cur.redo_reason, cur.row_count, cur.lost_at, cur.purged_at)
$$;
revoke all on function public.obs_archive_pending_units(uuid, text, date, text) from public, anon, authenticated, service_role;

-- {"u:<id>": "<hash_conteudo>"} das unidades correntes de um canal (o que o resumo carrega e o selo confere).
create or replace function public.obs_archive_channel_unit_hashes(p_site uuid, p_class text, p_channel text, p_month date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg('u:' || c.id, c.hash_conteudo), '{}'::jsonb)
    from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = p_channel
$$;
revoke all on function public.obs_archive_channel_unit_hashes(uuid, text, text, date) from public, anon, authenticated, service_role;

-- Pode-se refazer a unidade a partir do online? Canal existe, mês dentro do banco e unidade não retirada (Phil C3).
create or replace function public.obs_archive_can_redo(p_site uuid, p_class text, p_table text, p_channel text, p_month date, p_dropped timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_dropped is null
     and exists (select 1 from public.competitor_channels c where c.site_id = p_site and c.id::text = p_channel)
     and not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.table_name = p_table and m.month = p_month
                        and (m.detached_at is not null or m.dropped_at is not null))
$$;
revoke all on function public.obs_archive_can_redo(uuid, text, text, text, date, timestamptz) from public, anon, authenticated, service_role;

-- Como cada tabela é lida no resumo e no selo: a hora, o dia de São Paulo, o vídeo, e se tem views/likes/comments.
create or replace function public.obs_archive_table_exprs(p_table text)
returns table (ts_expr text, day_expr text, video_expr text, measured boolean) language sql immutable set search_path = '' as $$
  select case p_table
           when 'competitor_video_daily' then 't.snap_date::text'
           when 'competitor_video_early' then 't.taken_at'
           when 'competitor_video_comments' then 'coalesce(p.first_seen_at, t.first_seen_at)'
           when 'competitor_video_comment_marks' then 'coalesce(p.first_seen_at, k.first_seen_at)'
           when 'competitor_raw' then 't.last_seen_at'
           else 't.hour_slot' end,
         case p_table
           when 'competitor_video_daily' then 't.snap_date'
           when 'competitor_video_early' then '(t.taken_at at time zone ''America/Sao_Paulo'')::date'
           when 'competitor_video_comments' then '(coalesce(p.first_seen_at, t.first_seen_at) at time zone ''America/Sao_Paulo'')::date'
           when 'competitor_video_comment_marks' then '(coalesce(p.first_seen_at, k.first_seen_at) at time zone ''America/Sao_Paulo'')::date'
           when 'competitor_raw' then '(t.last_seen_at at time zone ''America/Sao_Paulo'')::date'
           else '(t.hour_slot at time zone ''America/Sao_Paulo'')::date' end,
         case p_table when 'competitor_video_comment_marks' then 'k.video_id' else 't.video_id' end,
         p_table in ('competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early', 'obs_archive_rehearsal')
$$;
revoke all on function public.obs_archive_table_exprs(text) from public, anon, authenticated, service_role;

-- nas_attested_at do mês: o menor entre os arquivos de obs_archive_month_files; com algum nulo (ou sem arquivo), nulo (Phil I2).
create or replace function public.obs_archive_recompute_nas(p_site uuid, p_class text, p_month date)
returns void language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  select case when count(*) = 0 or bool_or(f.nas_attested_at is null) then null else min(f.nas_attested_at) end into v
    from public.obs_archive_month_files(p_site, p_class, p_month) f;
  update public.obs_archive_months set nas_attested_at = v where site_id = p_site and class = p_class and month = p_month;
end $$;
revoke all on function public.obs_archive_recompute_nas(uuid, text, date) from public, anon, authenticated, service_role;

-- ===== selagem =====
-- Interna (D22): só o recebimento do último arquivo do manifesto chega aqui. Devolve a versão selada, ou nulo se não selou agora.
create or replace function public.obs_archive_seal(p_site uuid, p_class text, p_month date)
returns integer language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_mv integer; v_row record; v_seg date := (p_month + interval '1 month')::date;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
  v_ex record; v_src record; v_dias date[]; v_arr date[]; v_ch text; v_total integer; v_vazias integer; v_linhas bigint; v_kind text; v_dm integer;
begin
  -- a trava vem antes de qualquer leitura: dois recebimentos do último arquivo selam uma vez só (Yannis I8)
  perform 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month order by m.table_name for update;
  select max(m.manifest_version) into v_mv from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month;
  if v_mv is null then return null; end if;
  if exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month
              and (m.manifest_version is distinct from v_mv or m.manifest_received_at is null)) then return null; end if;
  if not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month
                  and not (m.sealed_at is not null and m.sealed_version = v_mv and m.unsealed_at is null)) then return null; end if;     -- já selado nesta versão
  -- cada par de obs_archive_expected_units tem unidade terminal (a função refaz a conta; não confia no manifesto)
  if exists (select 1 from public.obs_archive_pending_units(p_site, p_class, p_month, null)) then return null; end if;
  if not exists (select 1 from public.obs_archive_expected_units(p_site, p_class, p_month)) and not exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month)) then return null; end if;
  -- todo resumo devido está recebido (ou vazio) e é o das unidades correntes; canal sem unidade viva não tem resumo devido
  for v_ch in select distinct e.channel_ref from public.obs_archive_expected_units(p_site, p_class, p_month) e loop
    if exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = v_ch and c.purged_at is null) then
      if not exists (select 1 from (select * from public.obs_archive_summaries s where s.site_id = p_site and s.class = p_class and s.channel_ref = v_ch and s.month = p_month
                                     order by s.version desc limit 1) s
                      where s.received_at is not null and s.purged_at is null and s.unit_hashes = public.obs_archive_channel_unit_hashes(p_site, p_class, v_ch, p_month)) then
        return null;
      end if;
    end if;
  end loop;
  -- grava por tabela (Phil I10)
  for v_row in select m.table_name, m.detached_at, m.dropped_at from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month order by m.table_name loop
    select count(*), count(*) filter (where c.row_count = 0), coalesce(sum(c.row_count), 0) into v_total, v_vazias, v_linhas
      from public.obs_archive_current_units(p_site, p_class, p_month) c where c.table_name = v_row.table_name and c.purged_at is null;
    v_kind := case when v_total = 0 then 'sem_dado_a_guardar' when v_vazias = v_total then 'vazio_conferido' else 'com_dado' end;
    -- dias de São Paulo com linha, contados na tabela online pela mesma regra do leitor, na hora do selo
    v_dias := '{}'; v_dm := 0;
    if v_kind = 'com_dado' and v_row.detached_at is null and v_row.dropped_at is null and exists (select 1 from pg_catalog.pg_class where oid = pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(v_row.table_name))) then
      select * into v_ex from public.obs_archive_table_exprs(v_row.table_name);
      select * into v_src from public.obs_archive_unit_source(p_class, v_row.table_name);
      for v_ch in select c.channel_ref from public.obs_archive_current_units(p_site, p_class, p_month) c
                   where c.table_name = v_row.table_name and c.purged_at is null and c.lost_at is null and c.row_count > 0 loop
        execute format('select coalesce(array_agg(distinct %s), ''{}'') %s', v_ex.day_expr, v_src.from_where)
          into v_arr using p_site, v_ch::uuid, p_month, v_ini, v_fim, v_seg;
        v_dias := v_dias || v_arr;
      end loop;
      select count(distinct d)::int into v_dm from unnest(v_dias) d;
    end if;
    update public.obs_archive_months
       set sealed_at = now(), sealed_version = v_mv, units_total = v_total, units_empty = v_vazias, rows_total = v_linhas,
           -- mês fora do banco (detached/dropped) guarda os dias medidos no selo anterior: o online já não os tem (pedido da M9)
           days_measured = case when detached_at is not null or dropped_at is not null then days_measured else v_dm end,
           days_in_month = case when detached_at is not null or dropped_at is not null then days_in_month else (v_seg - p_month) end,
           sealed_kind = v_kind, unsealed_at = null, unsealed_reason = null
     where site_id = p_site and class = p_class and month = p_month and table_name = v_row.table_name;
  end loop;
  -- versões anteriores de canal que existe (a de canal removido nunca: 02 §10.5) e os resumos anteriores
  update public.obs_archive_units u set superseded_at = coalesce(u.superseded_at, now())
   where u.site_id = p_site and u.class = p_class and u.month = p_month
     and u.version < (select max(w.version) from public.obs_archive_units w where w.site_id = u.site_id and w.class = u.class and w.table_name = u.table_name and w.channel_ref = u.channel_ref and w.month = u.month)
     and exists (select 1 from public.competitor_channels c where c.site_id = p_site and c.id::text = u.channel_ref);
  update public.obs_archive_summaries s set superseded_at = coalesce(s.superseded_at, now())
   where s.site_id = p_site and s.class = p_class and s.month = p_month
     and s.version < (select max(w.version) from public.obs_archive_summaries w where w.site_id = s.site_id and w.class = s.class and w.channel_ref = s.channel_ref and w.month = s.month)
     and exists (select 1 from public.competitor_channels c where c.site_id = p_site and c.id::text = s.channel_ref);
  return v_mv;
end $$;
revoke all on function public.obs_archive_seal(uuid, text, date) from public, anon, authenticated, service_role;

-- ===== recebimento (rota unit/received, contrato C6) =====
create or replace function public.obs_archive_receive(p_site uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; v_id text; v_sha text; v_lin bigint; v_soma numeric; v_bytes bigint; v_res text; v_can boolean;
  v_itens jsonb := '[]'; v_selados jsonb := '[]'; v_tocados text[] := '{}'; v_t text; v_sel integer;
  u record; pt record; s record; mr record; an record; m text[]; v_esp text; v_esp_b bigint; v_lin_esp bigint; v_papel text; v_papers text[]; v_todos boolean; v_k record; v_achou boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'forma' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_id := it->>'arquivo_id'; v_sha := it->>'sha256'; v_lin := (it->>'linhas')::bigint; v_soma := (it->>'soma')::numeric; v_bytes := (it->>'bytes')::bigint;
    v_res := 'desconhecido';
    if v_id ~ '^u:[0-9a-f-]{36}$' then
      select * into u from public.obs_archive_units x where x.id = substr(v_id, 3)::uuid and x.site_id = p_site for update;
      if found then
        v_can := public.obs_archive_can_redo(p_site, u.class, u.table_name, u.channel_ref, u.month, u.dropped_at);
        if u.purged_at is not null then v_res := 'canal_removido';
        elsif u.row_count = 0 then v_res := 'ja_recebida';
        elsif u.parts > 1 or u.lost_at is not null then v_res := 'desconhecido';
        elsif v_sha is distinct from u.sha256_bytes then
          v_res := 'divergente';
          if v_can then update public.obs_archive_units set redo_reason = 'divergente' where id = u.id; end if;
        elsif v_lin is distinct from u.row_count or v_soma is distinct from u.control_sum then
          v_res := 'conteudo_divergente';
          if v_can then update public.obs_archive_units set redo_reason = 'conteudo_divergente' where id = u.id; end if;
        else
          v_res := case when u.received_at is not null then 'ja_recebida' else 'recebida' end;
          update public.obs_archive_units
             set received_sha256 = v_sha, received_row_count = v_lin, received_control_sum = v_soma, received_at = coalesce(received_at, now()),
                 nas_attested_at = now(), nas_reported_at = now(), nas_withdrawn_at = null, nas_withdrawn_reason = null, nas_unreadable_at = null,
                 absent_first_at = null, absent_last_at = null,
                 redo_reason = case when redo_reason in ('arquivo_ausente', 'divergente', 'conteudo_divergente') then null else redo_reason end
           where id = u.id;
        end if;
        v_tocados := v_tocados || (u.class || '|' || u.month::text);
      end if;
    elsif v_id ~ '^p:[0-9a-f-]{36}:[0-9]{2}$' then
      select * into u from public.obs_archive_units x where x.id = split_part(v_id, ':', 2)::uuid and x.site_id = p_site for update;
      v_achou := false;
      if found then
        select * into pt from public.obs_archive_unit_parts x where x.unit_id = u.id and x.part = split_part(v_id, ':', 3)::smallint;
        v_achou := found;
      end if;
      if v_achou then
        v_can := public.obs_archive_can_redo(p_site, u.class, u.table_name, u.channel_ref, u.month, u.dropped_at);
        if u.purged_at is not null then v_res := 'canal_removido';
        elsif u.lost_at is not null then v_res := 'desconhecido';
        elsif v_sha is distinct from pt.sha256_bytes then
          v_res := 'divergente';
          if v_can then update public.obs_archive_units set redo_reason = 'divergente' where id = u.id; end if;
        elsif v_lin is distinct from pt.row_count then
          v_res := 'conteudo_divergente';
          if v_can then update public.obs_archive_units set redo_reason = 'conteudo_divergente' where id = u.id; end if;
        else
          v_res := case when pt.received_at is not null then 'ja_recebida' else 'recebida' end;
          update public.obs_archive_unit_parts
             set received_sha256 = v_sha, received_row_count = v_lin, received_control_sum = v_soma, received_at = coalesce(received_at, now()),
                 nas_attested_at = now(), nas_reported_at = now(), nas_withdrawn_at = null, nas_withdrawn_reason = null, nas_unreadable_at = null
           where unit_id = u.id and part = pt.part;
          -- a unidade fica recebida quando todas as partes estão, as contagens fecham e a soma das somas relidas é a da unidade
          if not exists (select 1 from public.obs_archive_unit_parts x where x.unit_id = u.id and x.received_at is null) then
            select coalesce(sum(x.received_row_count), 0) as n, sum(x.received_control_sum) as soma into v_k from public.obs_archive_unit_parts x where x.unit_id = u.id;
            if v_k.n = u.row_count and v_k.soma is not distinct from u.control_sum then
              update public.obs_archive_units
                 set received_at = coalesce(received_at, now()), received_row_count = v_k.n, received_control_sum = v_k.soma, nas_attested_at = now(), nas_reported_at = now(),
                     nas_withdrawn_at = null, nas_withdrawn_reason = null, absent_first_at = null, absent_last_at = null,
                     redo_reason = case when redo_reason in ('arquivo_ausente', 'divergente', 'conteudo_divergente') then null else redo_reason end
               where id = u.id;
            else
              v_res := 'conteudo_divergente';
              if v_can then update public.obs_archive_units set redo_reason = 'conteudo_divergente' where id = u.id; end if;
            end if;
          end if;
        end if;
        v_tocados := v_tocados || (u.class || '|' || u.month::text);
      end if;
    elsif v_id ~ '^s:[0-9a-f-]{36}:(canal|video|ficha)$' then
      v_papel := split_part(v_id, ':', 3);
      select * into s from public.obs_archive_summaries x where x.id = split_part(v_id, ':', 2)::uuid and x.site_id = p_site for update;
      if found then
        v_esp := case v_papel when 'canal' then s.canal_sha256 when 'video' then s.video_sha256 else s.ficha_sha256 end;
        v_lin_esp := case v_papel when 'canal' then s.canal_rows when 'video' then s.video_rows else s.ficha_rows end;
        if s.purged_at is not null then v_res := 'canal_removido';
        elsif s.empty then v_res := 'ja_recebida';
        elsif v_esp is null or s.lost_at is not null then v_res := 'desconhecido';
        elsif v_sha is distinct from v_esp then v_res := 'divergente';
        elsif v_lin is distinct from v_lin_esp then v_res := 'conteudo_divergente';
        else
          v_res := case when s.received_at is not null then 'ja_recebida' else 'recebida' end;
          v_papers := s.received_papers;
          if not (v_papel = any(v_papers)) then v_papers := array_append(v_papers, v_papel); end if;
          v_todos := (s.canal_sha256 is null or 'canal' = any(v_papers)) and (s.video_sha256 is null or 'video' = any(v_papers)) and (s.ficha_sha256 is null or 'ficha' = any(v_papers));
          update public.obs_archive_summaries
             set received_papers = v_papers,
                 received_at = case when v_todos then coalesce(received_at, now()) else received_at end,
                 nas_attested_at = case when v_todos then now() else nas_attested_at end,
                 nas_reported_at = now(), nas_withdrawn_at = case when v_todos then null else nas_withdrawn_at end,
                 nas_withdrawn_reason = case when v_todos then null else nas_withdrawn_reason end, nas_unreadable_at = null
           where id = s.id;
        end if;
        v_tocados := v_tocados || (s.class || '|' || s.month::text);
      end if;
    elsif v_id ~ '^m:[a-z_]+:20[0-9]{2}-[0-9]{2}:v[0-9]+:(json|sha256)$' then
      m := regexp_match(v_id, '^m:([a-z_]+):(20[0-9]{2}-[0-9]{2}):v([0-9]+):(json|sha256)$');
      -- a trava das linhas do mês: dois recebimentos do último arquivo se enfileiram aqui
      perform 1 from public.obs_archive_months x where x.site_id = p_site and x.class = m[1] and x.month = (m[2] || '-01')::date order by x.table_name for update;
      select * into mr from public.obs_archive_months x where x.site_id = p_site and x.class = m[1] and x.month = (m[2] || '-01')::date and x.manifest_version = m[3]::int limit 1;
      if found then
        v_esp := case m[4] when 'json' then mr.manifest_sha256 else mr.manifest_list_sha256 end;
        v_esp_b := case m[4] when 'json' then mr.manifest_bytes else mr.manifest_list_bytes end;
        if v_esp is null then v_res := 'desconhecido';
        elsif v_sha is distinct from v_esp or (v_bytes is not null and v_bytes is distinct from v_esp_b) then v_res := 'divergente';
        else
          v_res := case when m[4] = any(mr.manifest_received_papers) then 'ja_recebida' else 'recebida' end;
          v_papers := mr.manifest_received_papers;
          if not (m[4] = any(v_papers)) then v_papers := array_append(v_papers, m[4]); end if;
          v_todos := 'json' = any(v_papers) and 'sha256' = any(v_papers);
          update public.obs_archive_months
             set manifest_received_papers = v_papers,
                 manifest_received_at = case when v_todos then coalesce(manifest_received_at, now()) else manifest_received_at end,
                 manifest_nas_attested_at = case when v_todos then now() else manifest_nas_attested_at end,
                 manifest_nas_reported_at = now(),
                 manifest_nas_withdrawn_at = case when v_todos then null else manifest_nas_withdrawn_at end
           where site_id = p_site and class = m[1] and month = (m[2] || '-01')::date and manifest_version = m[3]::int;
          if v_todos then
            v_sel := public.obs_archive_seal(p_site, m[1], (m[2] || '-01')::date);
            if v_sel is not null then v_selados := v_selados || jsonb_build_array(jsonb_build_object('classe', m[1], 'mes', m[2], 'versao', v_sel)); end if;
          end if;
        end if;
        v_tocados := v_tocados || (m[1] || '|' || (m[2] || '-01'));
      end if;
    elsif v_id ~ '^a:[0-9a-f-]{36}$' then
      select * into an from public.obs_archive_unit_attachments x where x.id = substr(v_id, 3)::uuid and x.site_id = p_site for update;
      if found then
        if an.sha256 is null then v_res := 'desconhecido';
        elsif v_sha is distinct from an.sha256 or (v_bytes is not null and v_bytes is distinct from an.file_bytes) then v_res := 'divergente';
        else
          v_res := case when an.received_at is not null then 'ja_recebida' else 'recebida' end;
          update public.obs_archive_unit_attachments set received_at = coalesce(received_at, now()), nas_attested_at = now(), nas_withdrawn_at = null, nas_withdrawn_reason = null where id = an.id;
        end if;
      end if;
    end if;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resultado', v_res));
  end loop;
  for v_t in select distinct x from unnest(v_tocados) x loop
    perform public.obs_archive_recompute_nas(p_site, split_part(v_t, '|', 1), split_part(v_t, '|', 2)::date);
  end loop;
  return jsonb_build_object('itens', v_itens, 'selados', (select coalesce(jsonb_agg(distinct e), '[]'::jsonb) from jsonb_array_elements(v_selados) e));
end $$;
revoke all on function public.obs_archive_receive(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_receive(uuid, jsonb) to service_role;

-- ===== recálculo, resumo e manifesto =====
create or replace function public.obs_archive_unit_rehash(p_unit uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u record; h record;
begin
  select * into u from public.obs_archive_units x where x.id = p_unit for update;
  if not found then raise exception 'unidade_desconhecida' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.competitor_channels c where c.site_id = u.site_id and c.id::text = u.channel_ref)
     or exists (select 1 from public.obs_archive_channel_removals r where r.site_id = u.site_id and r.channel_ref = u.channel_ref)
     or u.dropped_at is not null or u.lost_at is not null or u.purged_at is not null or u.superseded_at is not null
     or exists (select 1 from public.obs_archive_months m where m.site_id = u.site_id and m.class = u.class and m.table_name = u.table_name and m.month = u.month
                  and (m.detached_at is not null or m.dropped_at is not null)) then
    return jsonb_build_object('igual', true, 'pulada', true);
  end if;
  select * into h from public.obs_archive_content_hash(u.site_id, u.class, u.table_name, u.channel_ref::uuid, u.month);
  if h.row_count = u.row_count and h.control_sum::numeric is not distinct from u.control_sum and h.hash_conteudo = u.hash_conteudo then
    return jsonb_build_object('igual', true);
  end if;
  update public.obs_archive_units set redo_reason = 'conteudo_mudou' where id = u.id;
  update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'conteudo_mudou'
   where site_id = u.site_id and class = u.class and month = u.month and sealed_at is not null and unsealed_at is null;
  return jsonb_build_object('igual', false);
end $$;
revoke all on function public.obs_archive_unit_rehash(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_unit_rehash(uuid) to service_role;

create or replace function public.obs_archive_channel_units(p_site uuid, p_class text, p_channel uuid, p_month date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg('u:' || c.id order by c.table_name), '[]'::jsonb)
    from public.obs_archive_current_units(p_site, p_class, p_month) c
   where c.channel_ref = p_channel::text and c.purged_at is null and c.lost_at is null
$$;
revoke all on function public.obs_archive_channel_units(uuid, text, uuid, date) from public, anon, authenticated;
grant execute on function public.obs_archive_channel_units(uuid, text, uuid, date) to service_role;

-- O cálculo do resumo de UMA unidade (canal x tabela x mês), único bloco execute format dele (pedido da M7, TRAVA M7-0b).
-- Os cinco set são os de obs_archive_summary_rows: o texto sai igual por quem chamar. Interna: ninguém chama de fora.
create or replace function public.obs_archive_summary_calc(p_site uuid, p_class text, p_channel uuid, p_table text, p_month date, p_hash text, p_ver text)
returns jsonb language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  v_ch text := p_channel::text; x record; v_src record; v_c jsonb; v_v jsonb; v_mes text := to_char(p_month, 'YYYY-MM');
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
  v_seg date := (p_month + interval '1 month')::date;
begin
  select * into x from public.obs_archive_table_exprs(p_table);
  select * into v_src from public.obs_archive_unit_source(p_class, p_table);
  execute format($q$
    with s as (select %1$s as v, %2$s as ts, %3$s as d, %4$s as a, %5$s as b, %6$s as c %7$s),
    pv as (select v, count(*) as n, count(distinct d) as nd, min(ts) as t1, max(ts) as t2,
                  (array_agg(a order by ts asc))[1] as a1, (array_agg(a order by ts desc))[1] as a2,
                  (array_agg(b order by ts asc))[1] as b1, (array_agg(b order by ts desc))[1] as b2,
                  (array_agg(c order by ts asc))[1] as c1, (array_agg(c order by ts desc))[1] as c2
             from s group by v)
    select to_jsonb(array[ $8, $9, $10, (select count(*) from pv)::text, (select count(*) from s)::text, (select count(distinct d) from s)::text, $7,
                          (select min(t1) from pv)::text, (select max(t2) from pv)::text,
                          (select case when count(*) filter (where a1 is null or a2 is null) > 0 then null else sum(a2 - a1)::text end from pv),
                          (select case when count(*) filter (where b1 is null or b2 is null) > 0 then null else sum(b2 - b1)::text end from pv),
                          (select case when count(*) filter (where c1 is null or c2 is null) > 0 then null else sum(c2 - c1)::text end from pv),
                          $11, $12 ]::text[]),
           (select coalesce(jsonb_agg(to_jsonb(array[ pv.v::text, $8, $9, $10, pv.n::text, pv.nd::text, pv.a1::text, pv.a2::text, pv.b1::text, pv.b2::text, pv.c1::text, pv.c2::text, $11, $12 ]::text[]) order by pv.v), '[]'::jsonb) from pv)
  $q$, x.video_expr, x.ts_expr, x.day_expr,
       case when x.measured then 't.views' else 'null::bigint' end, case when x.measured then 't.likes' else 'null::bigint' end, case when x.measured then 't.comments' else 'null::bigint' end,
       v_src.from_where)
    into v_c, v_v using p_site, p_channel, p_month, v_ini, v_fim, v_seg, (v_seg - p_month)::text, v_ch, p_table, v_mes, p_hash, p_ver;
  return jsonb_build_object('canal', v_c, 'video', v_v);
end $$;
revoke all on function public.obs_archive_summary_calc(uuid, text, uuid, text, date, text, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_summary_rows(p_site uuid, p_class text, p_channel uuid, p_month date)
returns jsonb language plpgsql security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  v_ch text := p_channel::text; v_pend text; v_hashes jsonb; v_last record; v_ver integer; v_vazio boolean;
  u record; v_canal jsonb := '[]'; v_video jsonb := '[]'; v_c jsonb; v_v jsonb; v_c_v jsonb;
begin
  if p_class = 'video_antigo' then raise exception 'resumo_da_m10b' using errcode = 'P0001'; end if;
  if p_month is null or p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel and c.site_id = p_site)
     or exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = v_ch) then
    raise exception 'canal_removido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month and (m.detached_at is not null or m.dropped_at is not null)) then
    raise exception 'ja_no_arquivo' using errcode = 'P0001';
  end if;
  -- o canal tem de ser devido no mês (a mesma definição do plano) ou já ter unidade nele
  if not exists (select 1 from public.obs_archive_expected_units(p_site, p_class, p_month) e where e.channel_ref = v_ch)
     and not exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = v_ch) then
    raise exception 'canal_fora_do_mes' using errcode = 'P0001';
  end if;
  select string_agg(coalesce(regexp_replace(q.faltando, ':[^:]+$', ''), q.unidade), ',' order by coalesce(q.faltando, q.unidade)) into v_pend
    from public.obs_archive_pending_units(p_site, p_class, p_month, v_ch) q;
  if v_pend is not null then raise exception 'unidades_pendentes' using errcode = 'P0001', detail = v_pend; end if;
  v_hashes := public.obs_archive_channel_unit_hashes(p_site, p_class, v_ch, p_month);
  select * into v_last from public.obs_archive_summaries s where s.site_id = p_site and s.class = p_class and s.channel_ref = v_ch and s.month = p_month order by s.version desc limit 1;
  v_ver := case when found and v_last.unit_hashes = v_hashes and v_last.superseded_at is null and v_last.nas_withdrawn_at is null then v_last.version else coalesce(v_last.version, 0) + 1 end;
  select coalesce(bool_and(c.row_count = 0), false) into v_vazio from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = v_ch and c.purged_at is null;
  if not v_vazio then
    for u in select c.* from public.obs_archive_current_units(p_site, p_class, p_month) c
              where c.channel_ref = v_ch and c.purged_at is null and c.lost_at is null order by c.table_name loop
      v_c_v := public.obs_archive_summary_calc(p_site, p_class, p_channel, u.table_name, p_month, u.hash_conteudo, v_ver::text);
      v_c := v_c_v -> 'canal'; v_v := v_c_v -> 'video';
      v_canal := v_canal || jsonb_build_array(v_c);
      v_video := v_video || (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(v_v) e);
    end loop;
  end if;
  return jsonb_build_object('versao', v_ver, 'vazio', v_vazio, 'unit_hashes', v_hashes,
    'colunas_canal', jsonb_build_array('canal','tabela','mes','videos_com_linha','linhas','dias_medidos','dias_do_mes','primeira_leitura','ultima_leitura','var_views','var_likes','var_comments','hash_conteudo_unidade','versao_resumo'),
    'colunas_video', jsonb_build_array('video','canal','tabela','mes','linhas','dias_medidos','views_primeira','views_ultima','likes_primeira','likes_ultima','comments_primeira','comments_ultima','hash_conteudo_unidade','versao_resumo'),
    'canal', case when v_vazio then '[]'::jsonb else v_canal end, 'video', case when v_vazio then '[]'::jsonb else v_video end);
end $$;
revoke all on function public.obs_archive_summary_rows(uuid, text, uuid, date) from public, anon, authenticated;
grant execute on function public.obs_archive_summary_rows(uuid, text, uuid, date) to service_role;

create or replace function public.obs_archive_manifest_rows(p_site uuid, p_class text, p_month date)
returns jsonb language plpgsql security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  v_pend text; v_res text; v_mv integer; v_mrec timestamptz; v_mcr timestamptz; v_ver integer; v_dia date; v_arq jsonb; v_ch text;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.obs_archive_policy() p where p.class = p_class) then raise exception 'classe_tabela_invalida' using errcode = 'P0001'; end if;
  -- um par esperado sem unidade, ou com unidade ainda não terminal, é pendente (zero unidade nunca é terminal; Phil C1)
  select string_agg(coalesce(q.faltando, q.unidade), ',' order by coalesce(q.faltando, q.unidade)) into v_pend from public.obs_archive_pending_units(p_site, p_class, p_month, null) q;
  if v_pend is not null then raise exception 'unidades_pendentes' using errcode = 'P0001', detail = v_pend; end if;
  -- todo canal esperado, com unidade viva, tem o resumo corrente recebido (ou vazio)
  for v_ch in select distinct e.channel_ref from public.obs_archive_expected_units(p_site, p_class, p_month) e order by 1 loop
    if exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) c where c.channel_ref = v_ch and c.purged_at is null)
       and not exists (select 1 from (select * from public.obs_archive_summaries s where s.site_id = p_site and s.class = p_class and s.channel_ref = v_ch and s.month = p_month
                                       order by s.version desc limit 1) s
                        where s.received_at is not null and s.purged_at is null and s.unit_hashes = public.obs_archive_channel_unit_hashes(p_site, p_class, v_ch, p_month)) then
      v_res := coalesce(v_res || ',', '') || v_ch;
    end if;
  end loop;
  if v_res is not null then raise exception 'resumos_pendentes' using errcode = 'P0001', detail = v_res; end if;
  -- a versão: a do manifesto ainda não recebido, ou a seguinte; o dia de geração é o de criação da versão (o JSON sai igual em toda repetição)
  select m.manifest_version, m.manifest_received_at, m.manifest_created_at into v_mv, v_mrec, v_mcr
    from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month and m.manifest_version is not null order by m.manifest_version desc limit 1;
  if v_mv is not null and v_mrec is null then
    v_ver := v_mv; v_dia := (v_mcr at time zone 'America/Sao_Paulo')::date;
  else
    v_ver := coalesce(v_mv, 0) + 1; v_dia := public.obs_archive_hoje_sp();
  end if;
  with cur as (select * from public.obs_archive_current_units(p_site, p_class, p_month)),
  f as (select * from public.obs_archive_month_files(p_site, p_class, p_month) where tipo in ('unidade', 'parte', 'resumo')),
  feitos as (
    select f.arquivo_id, f.tipo, f.caminho, f.channel_ref, f.table_name,
           coalesce(u.row_count, pt.row_count, case sp.papel when 'canal' then s.canal_rows when 'video' then s.video_rows else s.ficha_rows end)::bigint as linhas,
           coalesce(u.control_sum, pt.control_sum)::text as soma,
           coalesce(u.sha256_bytes, pt.sha256_bytes, case sp.papel when 'canal' then s.canal_sha256 when 'video' then s.video_sha256 else s.ficha_sha256 end) as sha,
           coalesce(u.csv_sha256, pt.csv_sha256) as csv
      from f
      left join public.obs_archive_units u on f.tipo = 'unidade' and f.arquivo_id = 'u:' || u.id
      left join public.obs_archive_unit_parts pt on f.tipo = 'parte' and f.arquivo_id = 'p:' || pt.unit_id || ':' || lpad(pt.part::text, 2, '0')
      left join public.obs_archive_summaries s on f.tipo = 'resumo' and f.arquivo_id like 's:' || s.id || ':%'
      left join lateral (select split_part(f.arquivo_id, ':', 3) as papel) sp on true
  ), sem_arquivo as (
    select 'u:' || cur.id as arquivo_id, 'unidade'::text as tipo, null::text as caminho, cur.channel_ref, cur.table_name, cur.row_count as linhas, cur.control_sum::text as soma,
           null::text as sha, null::text as csv,
           case when cur.purged_at is not null then 'expurgada' when cur.lost_at is not null then 'perdida' else 'vazia' end as estado
      from cur where cur.purged_at is not null or cur.lost_at is not null or cur.row_count = 0
  )
  select coalesce(jsonb_agg(e.j order by e.arquivo_id), '[]'::jsonb) into v_arq from (
    select feitos.arquivo_id, jsonb_build_object('arquivo_id', feitos.arquivo_id, 'tipo', feitos.tipo, 'caminho', feitos.caminho, 'canal', feitos.channel_ref, 'tabela', feitos.table_name,
             'linhas', feitos.linhas, 'soma', feitos.soma, 'sha256', feitos.sha, 'csv_sha256', feitos.csv, 'estado', 'normal') as j from feitos
    union all
    select sa.arquivo_id, jsonb_build_object('arquivo_id', sa.arquivo_id, 'tipo', sa.tipo, 'caminho', sa.caminho, 'canal', sa.channel_ref, 'tabela', sa.table_name,
             'linhas', sa.linhas, 'soma', sa.soma, 'sha256', sa.sha, 'csv_sha256', sa.csv, 'estado', sa.estado) from sem_arquivo sa
  ) e;
  return jsonb_build_object('classe', p_class, 'mes', to_char(p_month, 'YYYY-MM'), 'versao', v_ver,
    'gerado_em', to_char(v_dia, 'YYYY-MM-DD') || 'T00:00:00-03:00', 'arquivos', v_arq,
    'contagens', jsonb_build_object(
      'unidades_canal_removido', (select count(*) from public.obs_archive_current_units(p_site, p_class, p_month) c
                                   where not exists (select 1 from public.competitor_channels ch where ch.site_id = p_site and ch.id::text = c.channel_ref)),
      'unidades_perdidas', (select count(*) from public.obs_archive_current_units(p_site, p_class, p_month) c where c.lost_at is not null and c.purged_at is null),
      'unidades_expurgadas', (select count(*) from public.obs_archive_current_units(p_site, p_class, p_month) c where c.purged_at is not null)));
end $$;
revoke all on function public.obs_archive_manifest_rows(uuid, text, date) from public, anon, authenticated;
grant execute on function public.obs_archive_manifest_rows(uuid, text, date) to service_role;

create or replace function public.obs_archive_record_manifest(p_site uuid, p_class text, p_month date, p_versao integer, p_json_sha256 text, p_json_bytes bigint, p_list_sha256 text, p_list_bytes bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_atual integer;
begin
  if p_json_sha256 !~ '^[0-9a-f]{64}$' or p_list_sha256 !~ '^[0-9a-f]{64}$' or p_versao < 1 then raise exception 'forma' using errcode = 'P0001'; end if;
  perform 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month order by m.table_name for update;
  if not found then raise exception 'mes_desconhecido' using errcode = 'P0001'; end if;
  select max(m.manifest_version) into v_atual from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month;
  if v_atual is not null and p_versao < v_atual then raise exception 'versao_antiga' using errcode = 'P0001'; end if;
  if v_atual is distinct from p_versao then
    update public.obs_archive_months
       set manifest_version = p_versao, manifest_sha256 = p_json_sha256, manifest_list_sha256 = p_list_sha256, manifest_bytes = p_json_bytes, manifest_list_bytes = p_list_bytes,
           manifest_created_at = (public.obs_archive_hoje_sp()::text || ' 00:00:00-03')::timestamptz,
           manifest_received_papers = '{}', manifest_received_at = null, manifest_nas_attested_at = null, manifest_nas_withdrawn_at = null, manifest_nas_reported_at = null
     where site_id = p_site and class = p_class and month = p_month;
  else
    update public.obs_archive_months
       set manifest_sha256 = p_json_sha256, manifest_list_sha256 = p_list_sha256, manifest_bytes = p_json_bytes, manifest_list_bytes = p_list_bytes,
           manifest_received_papers = case when manifest_sha256 is distinct from p_json_sha256 or manifest_list_sha256 is distinct from p_list_sha256 then '{}' else manifest_received_papers end,
           manifest_received_at = case when manifest_sha256 is distinct from p_json_sha256 or manifest_list_sha256 is distinct from p_list_sha256 then null else manifest_received_at end
     where site_id = p_site and class = p_class and month = p_month;
  end if;
  return jsonb_build_object('versao', p_versao);
end $$;
revoke all on function public.obs_archive_record_manifest(uuid, text, date, integer, text, bigint, text, bigint) from public, anon, authenticated;
grant execute on function public.obs_archive_record_manifest(uuid, text, date, integer, text, bigint, text, bigint) to service_role;

create or replace function public.obs_archive_mark_redo(p_unit uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_reason not in ('parte_mudou', 'mudou_durante_a_leitura') then raise exception 'motivo_invalido' using errcode = 'P0001'; end if;
  update public.obs_archive_units set redo_reason = p_reason where id = p_unit and received_at is null and purged_at is null;
end $$;
revoke all on function public.obs_archive_mark_redo(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_mark_redo(uuid, text) to service_role;

create or replace function public.obs_archive_unit_part_info(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date, p_part integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u record; pt record;
begin
  if exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.table_name = p_table and m.month = p_month
              and (m.detached_at is not null or m.dropped_at is not null)) then
    return jsonb_build_object('status', 'mes_fora_do_banco');
  end if;
  select * into u from public.obs_archive_units x where x.site_id = p_site and x.class = p_class and x.table_name = p_table and x.channel_ref = p_channel::text and x.month = p_month
   order by x.version desc limit 1;
  if not exists (select 1 from public.competitor_channels c where c.site_id = p_site and c.id = p_channel)
     or exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = p_channel::text)
     or (found and u.purged_at is not null) then
    return jsonb_build_object('status', 'canal_removido');
  end if;
  if not found or u.received_at is not null or u.lost_at is not null then return jsonb_build_object('status', 'nao_devida'); end if;
  select * into pt from public.obs_archive_unit_parts x where x.unit_id = u.id and x.part = p_part;
  if not found or pt.received_at is not null then return jsonb_build_object('status', 'nao_devida'); end if;
  return jsonb_build_object('status', 'ok', 'unidade_id', u.id, 'versao', u.version, 'partes', u.parts, 'de', pt.row_offset, 'ate', pt.row_offset + pt.row_count,
                            'sha256', pt.sha256_bytes, 'recebida', false);
end $$;
revoke all on function public.obs_archive_unit_part_info(uuid, text, text, uuid, date, integer) from public, anon, authenticated;
grant execute on function public.obs_archive_unit_part_info(uuid, text, text, uuid, date, integer) to service_role;

-- ===== a conferência do NAS (rota attest, fonte nas; contrato C7.1) =====
create or replace function public.obs_archive_attest_nas(p_site uuid, p_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := public.obs_archive_hoje_sp();
  k jsonb; it jsonb; v_filho text; v_dia text; v_sha text; v_ex text; v_res text; v_mot text; v_itens jsonb := '[]'; v_can jsonb := '[]';
  v_id text; v_r text; v_lin bigint; v_soma numeric; v_class text; v_arq text; v_ok boolean; v_mon boolean; v_razao text; v_podeduzir boolean;
  u record; pt record; s record; mr record; an record; m text[]; v_papel text; v_esp text; v_lin_esp bigint; v_soma_esp numeric; v_cmp_soma boolean := false; v_tocados text[] := '{}'; v_t text; v_achou boolean;
begin
  if p_body is null or p_body->>'fonte' is distinct from 'nas' then raise exception 'forma' using errcode = 'P0001'; end if;
  -- os canários do dia: o primeiro do dia e do filho vale; outro sha256 no mesmo dia é recusado e acende o vermelho (Phil I4)
  for k in select * from jsonb_array_elements(coalesce(p_body->'canarios', '[]'::jsonb)) loop
    v_filho := k->>'filho'; v_dia := k->>'dia'; v_sha := k->>'sha256'; v_mot := null;
    if v_filho not in ('numerico', 'texto') or v_dia !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or v_sha !~ '^[0-9a-f]{64}$' then
      v_res := 'recusado'; v_mot := 'dia_invalido';
    elsif v_dia::date not between v_hoje - 1 and v_hoje + 1 then
      v_res := 'recusado'; v_mot := 'dia_invalido';
    else
      select c.sha256 into v_ex from public.obs_archive_canaries c where c.site_id = p_site and c.filho = v_filho and c.dia = v_dia::date for update;
      if not found then
        insert into public.obs_archive_canaries (site_id, filho, dia, sha256) values (p_site, v_filho, v_dia::date, v_sha);
        v_res := 'aceito';
      elsif v_ex = v_sha then
        update public.obs_archive_canaries set informed_at = now() where site_id = p_site and filho = v_filho and dia = v_dia::date;
        v_res := 'aceito';
      else
        update public.obs_archive_canaries set regravado_at = coalesce(regravado_at, now()) where site_id = p_site and filho = v_filho and dia = v_dia::date;
        v_res := 'recusado'; v_mot := 'sha256_diferente_no_dia';
      end if;
    end if;
    v_can := v_can || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('filho', v_filho, 'dia', v_dia, 'resposta', v_res, 'motivo', v_mot)));
  end loop;

  for it in select * from jsonb_array_elements(coalesce(p_body->'itens', '[]'::jsonb)) loop
    v_id := it->>'arquivo_id'; v_r := it->>'resultado'; v_sha := it->>'sha256'; v_lin := (it->>'linhas')::bigint; v_soma := (it->>'soma')::numeric;
    v_res := 'aceito'; v_mot := null; v_class := null; v_achou := false; v_lin_esp := null; v_soma_esp := null; v_cmp_soma := false;
    -- 1) o arquivo: classe e registro. Unidade vazia, perdida ou expurgada não se reconfere: desconhecido.
    if v_id ~ '^u:[0-9a-f-]{36}$' then
      select * into u from public.obs_archive_units x where x.id = substr(v_id, 3)::uuid and x.site_id = p_site for update;
      if found and u.row_count > 0 and u.parts = 1 and u.lost_at is null and u.purged_at is null then v_achou := true; v_class := u.class; v_esp := u.sha256_bytes; v_lin_esp := u.row_count; v_soma_esp := u.control_sum; v_cmp_soma := true; end if;
    elsif v_id ~ '^p:[0-9a-f-]{36}:[0-9]{2}$' then
      select * into u from public.obs_archive_units x where x.id = split_part(v_id, ':', 2)::uuid and x.site_id = p_site for update;
      if found and u.row_count > 0 and u.parts > 1 and u.lost_at is null and u.purged_at is null then
        select * into pt from public.obs_archive_unit_parts x where x.unit_id = u.id and x.part = split_part(v_id, ':', 3)::smallint;
        if found then v_achou := true; v_class := u.class; v_esp := pt.sha256_bytes; v_lin_esp := pt.row_count; end if;
      end if;
    elsif v_id ~ '^s:[0-9a-f-]{36}:(canal|video|ficha)$' then
      v_papel := split_part(v_id, ':', 3);
      select * into s from public.obs_archive_summaries x where x.id = split_part(v_id, ':', 2)::uuid and x.site_id = p_site for update;
      if found and not s.empty and s.lost_at is null and s.purged_at is null then
        v_esp := case v_papel when 'canal' then s.canal_sha256 when 'video' then s.video_sha256 else s.ficha_sha256 end;
        v_lin_esp := case v_papel when 'canal' then s.canal_rows when 'video' then s.video_rows else s.ficha_rows end;
        if v_esp is not null then v_achou := true; v_class := s.class; end if;
      end if;
    elsif v_id ~ '^m:[a-z_]+:20[0-9]{2}-[0-9]{2}:v[0-9]+:(json|sha256)$' then
      m := regexp_match(v_id, '^m:([a-z_]+):(20[0-9]{2}-[0-9]{2}):v([0-9]+):(json|sha256)$');
      select * into mr from public.obs_archive_months x where x.site_id = p_site and x.class = m[1] and x.month = (m[2] || '-01')::date and x.manifest_version = m[3]::int limit 1;
      if found then v_achou := true; v_class := m[1]; v_esp := case m[4] when 'json' then mr.manifest_sha256 else mr.manifest_list_sha256 end; end if;
    elsif v_id ~ '^a:[0-9a-f-]{36}$' then
      select * into an from public.obs_archive_unit_attachments x where x.id = substr(v_id, 3)::uuid and x.site_id = p_site for update;
      if found and an.sha256 is not null then v_achou := true; v_class := an.class; v_esp := an.sha256; end if;
    end if;
    if not v_achou then
      v_itens := v_itens || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'desconhecido'));
      continue;
    end if;
    if v_r not in ('presente', 'ausente', 'nas_fora', 'ilegivel') then
      v_itens := v_itens || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'forma'));
      continue;
    end if;
    if v_r = 'nas_fora' then
      v_itens := v_itens || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'aceito'));       -- nada gravado
      continue;
    end if;
    -- 2) o filho do arquivo tem de estar montado e com a sentinela (senão "ausente" seria mentira)
    select p.filho into v_filho from public.obs_archive_policy() p where p.class = v_class limit 1;
    if coalesce((p_body->'filhos'->v_filho->>'montado')::boolean, false) is not true or coalesce((p_body->'filhos'->v_filho->>'sentinela')::boolean, false) is not true then
      v_itens := v_itens || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'filho_fora'));
      continue;
    end if;
    -- 3) o resultado. razao = por que o arquivo não vale (nulo = vale)
    v_razao := null;
    if v_r = 'presente' then
      if v_sha is distinct from v_esp then v_razao := 'divergente';
      elsif v_lin is not null and (v_lin is distinct from v_lin_esp or (v_cmp_soma and v_soma is distinct from v_soma_esp)) then v_razao := 'conteudo_divergente';
      end if;
    elsif v_r = 'ilegivel' then v_razao := 'divergente';
    end if;

    if v_id ~ '^u:' or v_id ~ '^p:' then
      v_podeduzir := public.obs_archive_can_redo(p_site, u.class, u.table_name, u.channel_ref, u.month, u.dropped_at);
      v_tocados := v_tocados || (u.class || '|' || u.month::text);
      if v_r = 'ausente' then
        if u.received_at is not null then
          if v_id ~ '^p:' then
            update public.obs_archive_unit_parts set nas_withdrawn_at = coalesce(nas_withdrawn_at, now()), nas_withdrawn_reason = 'ausente', nas_reported_at = now() where unit_id = u.id and part = pt.part;
          end if;
          update public.obs_archive_units
             set nas_withdrawn_at = case when v_id ~ '^u:' then coalesce(nas_withdrawn_at, now()) else nas_withdrawn_at end,
                 nas_withdrawn_reason = case when v_id ~ '^u:' then 'ausente' else nas_withdrawn_reason end,
                 nas_reported_at = now(), absent_first_at = coalesce(absent_first_at, now()), absent_last_at = now(),
                 redo_reason = case when v_podeduzir then 'arquivo_ausente' else redo_reason end
           where id = u.id;
        else
          update public.obs_archive_units set absent_first_at = coalesce(absent_first_at, now()), absent_last_at = now() where id = u.id;      -- não recebida (canal removido, P14): só absent_*
        end if;
      elsif v_razao is not null then
        if v_id ~ '^p:' then
          update public.obs_archive_unit_parts set nas_withdrawn_at = coalesce(nas_withdrawn_at, now()), nas_withdrawn_reason = v_razao, nas_reported_at = now(),
                 nas_unreadable_at = case when v_r = 'ilegivel' then now() else null end where unit_id = u.id and part = pt.part;
        end if;
        update public.obs_archive_units
           set nas_withdrawn_at = case when v_id ~ '^u:' then coalesce(nas_withdrawn_at, now()) else nas_withdrawn_at end,
               nas_withdrawn_reason = case when v_id ~ '^u:' then v_razao else nas_withdrawn_reason end,
               nas_reported_at = now(), nas_unreadable_at = case when v_r = 'ilegivel' and v_id ~ '^u:' then now() else nas_unreadable_at end,
               redo_reason = case when v_podeduzir then v_razao else redo_reason end
         where id = u.id;
      elsif u.received_at is not null then            -- presente igual ao registro
        if v_id ~ '^p:' then
          update public.obs_archive_unit_parts set nas_attested_at = now(), nas_reported_at = now(), nas_withdrawn_at = null, nas_withdrawn_reason = null, nas_unreadable_at = null where unit_id = u.id and part = pt.part;
        end if;
        update public.obs_archive_units
           set nas_attested_at = now(), nas_reported_at = now(), absent_first_at = null, absent_last_at = null,
               nas_withdrawn_at = case when v_id ~ '^u:' then null else nas_withdrawn_at end,
               nas_withdrawn_reason = case when v_id ~ '^u:' then null else nas_withdrawn_reason end,
               nas_unreadable_at = case when v_id ~ '^u:' then null else nas_unreadable_at end,
               redo_reason = case when redo_reason in ('arquivo_ausente', 'divergente', 'conteudo_divergente') then null else redo_reason end
         where id = u.id;
      end if;
    elsif v_id ~ '^s:' then
      v_tocados := v_tocados || (s.class || '|' || s.month::text);
      if v_r = 'ausente' then
        if s.received_at is not null then update public.obs_archive_summaries set nas_withdrawn_at = coalesce(nas_withdrawn_at, now()), nas_withdrawn_reason = 'ausente', nas_reported_at = now() where id = s.id; end if;
      elsif v_razao is not null then
        update public.obs_archive_summaries set nas_withdrawn_at = coalesce(nas_withdrawn_at, now()), nas_withdrawn_reason = v_razao, nas_reported_at = now(),
               nas_unreadable_at = case when v_r = 'ilegivel' then now() else nas_unreadable_at end where id = s.id;
      elsif s.received_at is not null and s.nas_withdrawn_at is null then      -- resumo retirado é trocado por versão nova, nunca reabilitado
        update public.obs_archive_summaries set nas_attested_at = now(), nas_reported_at = now(), nas_unreadable_at = null where id = s.id;
      end if;
    elsif v_id ~ '^m:' then
      v_tocados := v_tocados || (m[1] || '|' || (m[2] || '-01'));
      if mr.manifest_received_at is not null then
        if v_r = 'ausente' or v_razao is not null then
          update public.obs_archive_months set manifest_nas_withdrawn_at = coalesce(manifest_nas_withdrawn_at, now()), manifest_nas_reported_at = now()
           where site_id = p_site and class = m[1] and month = (m[2] || '-01')::date and manifest_version = m[3]::int;
        else
          update public.obs_archive_months set manifest_nas_attested_at = now(), manifest_nas_reported_at = now(), manifest_nas_withdrawn_at = null
           where site_id = p_site and class = m[1] and month = (m[2] || '-01')::date and manifest_version = m[3]::int;
        end if;
      end if;
    elsif v_id ~ '^a:' then
      if v_r = 'ausente' or v_razao is not null then
        update public.obs_archive_unit_attachments set nas_withdrawn_at = coalesce(nas_withdrawn_at, now()), nas_withdrawn_reason = case when v_r = 'ausente' then 'ausente' else 'divergente' end where id = an.id;
      elsif an.received_at is not null then
        update public.obs_archive_unit_attachments set nas_attested_at = now(), nas_withdrawn_at = null, nas_withdrawn_reason = null where id = an.id;
      end if;
    end if;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'aceito'));
  end loop;
  for v_t in select distinct x from unnest(v_tocados) x loop
    perform public.obs_archive_recompute_nas(p_site, split_part(v_t, '|', 1), split_part(v_t, '|', 2)::date);
  end loop;
  return jsonb_build_object('itens', v_itens, 'canarios', v_can);
end $$;
revoke all on function public.obs_archive_attest_nas(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_nas(uuid, jsonb) to service_role;


-- M3B PARTE 4: a conferência do B2 pela forja (02 §10.9)

-- Desvio de 14/10 (ledger): onde guardar os vermelhos b2_ilegivel:<arquivo_id> e "B2 recusou o fileId em 3 execuções seguidas".
alter table public.obs_archive_b2_files add column if not exists ilegivel_at timestamptz;
alter table public.obs_archive_b2_runs add column if not exists file_id_recusado boolean not null default false;

create or replace function public.obs_archive_agora() returns timestamptz language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('obs_archive.agora', true), '')::timestamptz, now())
$$;
revoke all on function public.obs_archive_agora() from public, anon, authenticated, service_role;   -- Yannis M6; gancho de teste declarado

-- CP24 (lida em 14/10 em backblaze.com/cloud-storage/pricing): "free egress up to 3x their average monthly storage", média em byte-horas do ciclo
-- de cobrança. A página não diz se é por conta ou por bucket: tratado como CONTA (o caso conservador). O valor é 3 x 814,8 GB (a guarda média
-- projetada do P59); a média real da conta só sobe com os outros buckets, então o número só erra para menos (mais cedo no teto, nunca depois).
create or replace function public.obs_archive_b2_franquia_mes() returns bigint language sql immutable set search_path = '' as $$
  select 2444400000000::bigint
$$;
revoke all on function public.obs_archive_b2_franquia_mes() from public, anon, authenticated;
grant execute on function public.obs_archive_b2_franquia_mes() to service_role;

-- O piso de bytes lidos por dia (P59): 2 x a soma de file_bytes do registro (unidades, resumos e anexos), recalculado a cada plano; vazio: 1 MiB.
create or replace function public.obs_archive_b2_teto_dia(p_site uuid) returns bigint language sql stable security definer set search_path = '' as $$
  select greatest(2 * (
    (select coalesce(sum(u.file_bytes), 0) from public.obs_archive_units u where u.site_id = p_site)
  + (select coalesce(sum(coalesce(s.canal_bytes, 0) + coalesce(s.video_bytes, 0) + coalesce(s.ficha_bytes, 0)), 0) from public.obs_archive_summaries s where s.site_id = p_site)
  + (select coalesce(sum(a.file_bytes), 0) from public.obs_archive_unit_attachments a where a.site_id = p_site)), 1048576)::bigint
$$;
revoke all on function public.obs_archive_b2_teto_dia(uuid) from public, anon, authenticated, service_role;

-- O filho de um arquivo pela classe do registro (u, p, s, a: a linha; m: a classe no id). Nulo = desconhecido.
create or replace function public.obs_archive_filho_do_arquivo(p_site uuid, p_id text) returns text
language sql stable security definer set search_path = '' as $$
  select p.filho from public.obs_archive_policy() p
   where p.class = coalesce(
     (select u.class from public.obs_archive_units u where u.site_id = p_site and p_id ~ '^[up]:' and u.id::text = split_part(p_id, ':', 2)),
     (select s.class from public.obs_archive_summaries s where s.site_id = p_site and p_id ~ '^s:' and s.id::text = split_part(p_id, ':', 2)),
     (select 'video_antigo' where p_id ~ '^a:'),
     (select split_part(p_id, ':', 2) where p_id ~ '^m:'))
   limit 1
$$;
revoke all on function public.obs_archive_filho_do_arquivo(uuid, text) from public, anon, authenticated, service_role;

-- O que o registro espera de um arquivo (para comparar o informe do B2) e onde ele mora (classe e mês).
create or replace function public.obs_archive_b2_file_info(p_site uuid, p_id text)
returns table (class text, month date, exp_sha text, exp_rows bigint, exp_soma numeric, cmp_soma boolean, received_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.class, u.month, u.sha256_bytes, u.row_count, u.control_sum, true, u.received_at
    from public.obs_archive_units u where u.site_id = p_site and p_id ~ '^u:' and u.id::text = split_part(p_id, ':', 2)
  union all
  select u.class, u.month, pt.sha256_bytes, pt.row_count, pt.control_sum, false, pt.received_at
    from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id
   where u.site_id = p_site and p_id ~ '^p:[0-9a-f-]{36}:[0-9]{2}$' and u.id::text = split_part(p_id, ':', 2)
     and pt.part = case when p_id ~ '^p:[0-9a-f-]{36}:[0-9]{2}$' then split_part(p_id, ':', 3)::smallint end
  union all
  select s.class, s.month,
         case split_part(p_id, ':', 3) when 'canal' then s.canal_sha256 when 'video' then s.video_sha256 else s.ficha_sha256 end,
         case split_part(p_id, ':', 3) when 'canal' then s.canal_rows when 'video' then s.video_rows else s.ficha_rows end,
         null::numeric, false, s.received_at
    from public.obs_archive_summaries s where s.site_id = p_site and p_id ~ '^s:[0-9a-f-]{36}:(canal|video|ficha)$' and s.id::text = split_part(p_id, ':', 2)
  union all
  select m.class, m.month, case split_part(p_id, ':', 5) when 'json' then m.manifest_sha256 else m.manifest_list_sha256 end, null::bigint, null::numeric, false, m.manifest_received_at
    from public.obs_archive_months m
   where m.site_id = p_site and p_id ~ '^m:[a-z_]+:20[0-9]{2}-[0-9]{2}:v[0-9]+:(json|sha256)$' and m.class = split_part(p_id, ':', 2)
     and to_char(m.month, 'YYYY-MM') = split_part(p_id, ':', 3) and 'v' || m.manifest_version = split_part(p_id, ':', 4)
$$;
revoke all on function public.obs_archive_b2_file_info(uuid, text) from public, anon, authenticated, service_role;

-- B2 exigido a todo o mês: há mês que saiu do banco com a atestação do B2 de mais de 7 dias (ou nunca)? Então o plano devolve tudo (pede o pode-desligar).
create or replace function public.obs_archive_b2_pede_completo(p_site uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.obs_archive_months m
                  where m.site_id = p_site and (m.detached_at is not null or m.dropped_at is not null)
                    and coalesce(m.b2_attested_at, '-infinity'::timestamptz) < public.obs_archive_agora() - interval '7 days')
$$;
revoke all on function public.obs_archive_b2_pede_completo(uuid) from public, anon, authenticated, service_role;

-- Recalcula o estado do B2 de um mês: b2_forja_ok_at (a conferência mais antiga do conjunto, só com todos conferidos e dentro de 7 dias entre si,
-- 30 no rodízio), a limpeza da retirada e os b2_attested_* derivados das duas origens (vence a que vence mais tarde: forja + 7 dias, dono + 35).
create or replace function public.obs_archive_b2_recompute_month(p_site uuid, p_class text, p_month date, p_via text, p_result text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_min timestamptz; v_max timestamptz; v_n integer; v_nulos integer; v_desc boolean; v_ok timestamptz; m record; v_forja_fim timestamptz; v_dono_fim timestamptz;
  v_man text;
begin
  select count(*), count(*) filter (where f.b2_ok_at is null), min(f.b2_ok_at), max(f.b2_ok_at) into v_n, v_nulos, v_min, v_max
    from public.obs_archive_month_files(p_site, p_class, p_month) f;
  select bool_or(x.dropped_at is not null), max(x.manifest_sha256) into v_desc, v_man from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.month = p_month;
  v_ok := case when v_n > 0 and v_nulos = 0 and exists (select 1 from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.month = p_month and x.sealed_at is not null)
                    and v_max - v_min <= case when coalesce(v_desc, false) then interval '30 days' else interval '7 days' end then v_min end;
  if p_via = 'forja' then
    update public.obs_archive_months
       set b2_forja_ok_at = v_ok, b2_forja_manifest_sha256 = case when v_ok is null then null else manifest_sha256 end,
           b2_last_attempt_at = public.obs_archive_agora(), b2_last_attempt_result = p_result, b2_last_attempt_via = 'forja'
     where site_id = p_site and class = p_class and month = p_month;
  else
    update public.obs_archive_months
       set b2_last_attempt_at = public.obs_archive_agora(), b2_last_attempt_result = p_result, b2_last_attempt_via = 'dono'
     where site_id = p_site and class = p_class and month = p_month;
  end if;
  for m in select * from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.month = p_month loop
    -- a retirada da forja é limpa por conferência boa depois dela; a do dono só por ok do dono
    if m.b2_withdrawn_at is not null and ((m.b2_withdrawn_via = 'forja' and m.b2_forja_ok_at is not null and m.b2_forja_ok_at > m.b2_withdrawn_at)
                                        or (m.b2_withdrawn_via = 'dono' and m.b2_dono_ok_at is not null and m.b2_dono_ok_at > m.b2_withdrawn_at)) then
      update public.obs_archive_months set b2_withdrawn_at = null, b2_withdrawn_reason = null, b2_withdrawn_via = null where id = m.id;
      m.b2_withdrawn_at := null;
    end if;
    v_forja_fim := m.b2_forja_ok_at + interval '7 days'; v_dono_fim := m.b2_dono_ok_at + interval '35 days';
    update public.obs_archive_months
       set b2_attested_at = case when m.b2_withdrawn_at is not null then null
                                 when v_dono_fim is not null and (v_forja_fim is null or v_dono_fim >= v_forja_fim) then m.b2_dono_ok_at
                                 else m.b2_forja_ok_at end,
           b2_attested_via = case when m.b2_withdrawn_at is not null then null
                                  when v_dono_fim is not null and (v_forja_fim is null or v_dono_fim >= v_forja_fim) then 'dono'
                                  when m.b2_forja_ok_at is not null then 'forja' end,
           b2_attested_by = case when m.b2_withdrawn_at is not null then null
                                 when v_dono_fim is not null and (v_forja_fim is null or v_dono_fim >= v_forja_fim) then m.b2_dono_by
                                 when m.b2_forja_ok_at is not null then 'forja' end,
           b2_manifest_sha256 = case when m.b2_withdrawn_at is not null then null
                                     when v_dono_fim is not null and (v_forja_fim is null or v_dono_fim >= v_forja_fim) then m.b2_dono_manifest_sha256
                                     else m.b2_forja_manifest_sha256 end
     where id = m.id;
  end loop;
end $$;
revoke all on function public.obs_archive_b2_recompute_month(uuid, text, date, text, text) from public, anon, authenticated, service_role;

-- Retira a atestação do B2 de um mês por um arquivo (divergente, arquivo_ausente, nao_decifra) e registra a tentativa.
create or replace function public.obs_archive_b2_retirar(p_site uuid, p_id text, p_result text, p_via text)
returns void language plpgsql security definer set search_path = '' as $$
declare i record;
begin
  select * into i from public.obs_archive_b2_file_info(p_site, p_id) limit 1;
  if not found then return; end if;
  insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month, last_attempt_at, last_attempt_result)
  values (p_site, p_id, i.class, i.month, public.obs_archive_agora(), p_result)
  on conflict (site_id, arquivo_id) do update set last_attempt_at = excluded.last_attempt_at, last_attempt_result = excluded.last_attempt_result, pending_mismatch = null, pending_since = null, pending_run = null;
  update public.obs_archive_months
     set b2_withdrawn_at = public.obs_archive_agora(), b2_withdrawn_reason = p_result, b2_withdrawn_via = p_via, b2_attested_at = null, b2_attested_via = null, b2_attested_by = null, b2_manifest_sha256 = null
   where site_id = p_site and class = i.class and month = i.month;
end $$;
revoke all on function public.obs_archive_b2_retirar(uuid, text, text, text) from public, anon, authenticated, service_role;
-- r2.2 (I3 do Phil): aceita as páginas do completo em ordem. Página aceita = todo arquivo dela tem informe conclusivo
-- desde o início do completo em aberto (vale o que outra execução da mesma cadeia já aceitou: X1). A primeira página
-- não aceita para a conta e segura o cursor; sem_acesso e repetir pendente nunca cobrem (não falha em verde).
create or replace function public.obs_archive_b2_aceitar_paginas(p_site uuid, p_run uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_run public.obs_archive_b2_runs; v_pag jsonb; v_i integer; v_novas jsonb; v_n integer := 0; v_ate text; v_ultima boolean := false;
begin
  select * into v_run from public.obs_archive_b2_runs where id = p_run and site_id = p_site for update;
  if not found or v_run.modo <> 'completo' or v_run.estado <> 'controle_ok' or v_run.completo_desde is null then return; end if;
  v_novas := v_run.paginas;
  for v_i in 0 .. jsonb_array_length(v_run.paginas) - 1 loop
    v_pag := v_run.paginas -> v_i;
    continue when (v_pag->>'aceita')::boolean;
    exit when exists (
      select 1 from jsonb_array_elements_text(v_pag->'ids') x(id)
        left join public.obs_archive_b2_files b on b.site_id = p_site and b.arquivo_id = x.id
       where b.arquivo_id is null or b.last_attempt_at is null or b.last_attempt_at < v_run.completo_desde
          or b.last_attempt_result not in ('ok', 'divergente', 'arquivo_ausente', 'aguardando_b2'));
    v_novas := jsonb_set(v_novas, array[v_i::text, 'aceita'], 'true'::jsonb);
    v_n := v_n + 1; v_ate := v_pag->>'ate'; v_ultima := (v_pag->>'ultima')::boolean;
  end loop;
  if v_n = 0 then return; end if;
  update public.obs_archive_b2_runs
     set paginas = v_novas, paginas_aceitas = paginas_aceitas + v_n,
         cursor_aceito = coalesce(p_run::text || '|' || v_ate, cursor_aceito),       -- página vazia (sem `ate`) não move o cursor
         completo_fechado_em = case when v_ultima then public.obs_archive_agora() else completo_fechado_em end
   where id = p_run;
end $$;
revoke all on function public.obs_archive_b2_aceitar_paginas(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_b2_run_gate(p_site uuid, p_run uuid, p_item jsonb)
returns text language plpgsql security definer set search_path = '' as $$
-- Aplica um informe de controle (negativo ou canário) e devolve a resposta; para arquivo comum, devolve 'seguir' ou o motivo da recusa.
declare v_run public.obs_archive_b2_runs; v_id text := p_item->>'arquivo_id'; v_filho text; v_can public.obs_archive_canaries;
begin
  select * into v_run from public.obs_archive_b2_runs where id = p_run and site_id = p_site for update;
  if not found then return 'desconhecido'; end if;
  if v_run.expires_at < public.obs_archive_agora() then return 'execucao_vencida'; end if;
  if v_id = 'controle_negativo' then
    if p_item->>'resultado' = 'ausente' then
      update public.obs_archive_b2_runs set negative_ok = true where id = p_run;
    elsif p_item->>'resultado' in ('sem_acesso', 'chave_ausente') then
      return 'aceito';                       -- sem acesso o negativo fica pendente e nada atesta; não é "o controle falhou" (Phil I3)
    else
      update public.obs_archive_b2_runs set negative_ok = false, estado = 'controle_falhou' where id = p_run;
    end if;
  elsif v_id in ('canario:numerico', 'canario:texto') then
    v_filho := split_part(v_id, ':', 2);
    select * into v_can from public.obs_archive_canaries c
     where c.site_id = p_site and c.filho = v_filho and c.dia = (v_run.canary_days->>v_filho)::date;
    if found and p_item->>'resultado' = 'presente' and p_item->>'sha256' = v_can.sha256
       and coalesce(p_item->>'file_id', '') ~ '^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$' then
      update public.obs_archive_b2_runs set canary_ok = canary_ok || jsonb_build_object(v_filho, true) where id = p_run;
      update public.obs_archive_canaries set b2_ok_at = now(), b2_file_id = p_item->>'file_id' where site_id = p_site and filho = v_filho and dia = v_can.dia;
    else
      update public.obs_archive_b2_runs set canary_ok = canary_ok || jsonb_build_object(v_filho, false), estado = 'controle_falhou' where id = p_run;
      update public.obs_archive_canaries set b2_failed_at = now() where site_id = p_site and filho = v_filho and dia = v_can.dia;
    end if;
  else
    if v_run.estado = 'controle_falhou' then return 'controle_falhou'; end if;
    v_filho := public.obs_archive_filho_do_arquivo(p_site, v_id);       -- pela classe do registro; nulo = desconhecido
    if v_filho is null then return 'desconhecido'; end if;
    -- o arquivo só passa depois do negativo ausente E do canário do mesmo filho (C2; Phil I3)
    if not coalesce(v_run.negative_ok, false) or not coalesce((v_run.canary_ok->>v_filho)::boolean, false) then
      return 'controle_pendente';
    end if;
    return 'seguir';
  end if;
  update public.obs_archive_b2_runs set estado = 'controle_ok'
   where id = p_run and estado = 'aguardando_controle' and negative_ok
     and coalesce((canary_ok->>'numerico')::boolean, false) and coalesce((canary_ok->>'texto')::boolean, false);
  return 'aceito';
end $$;
revoke all on function public.obs_archive_b2_run_gate(uuid, uuid, jsonb) from public, anon, authenticated, service_role;

-- O plano do B2 (contrato C2): sem hash esperado, com execução, controle negativo, canários, estado por filho, páginas de 500 e retomada do completo.
create or replace function public.obs_archive_b2_plan(p_site uuid, p_completo boolean, p_cursor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_run public.obs_archive_b2_runs; v_src public.obs_archive_b2_runs; v_prev public.obs_archive_b2_runs;
  v_completo boolean; v_start text; v_all jsonb; v_page jsonb; v_depois integer; v_mais boolean; v_ultimo text; v_i record;
  v_desde timestamptz; v_aceitas integer := 0; v_cur_ac text; v_retomado text; v_total integer; v_dias jsonb; v_verm jsonb := '[]'::jsonb;
  v_n_num integer; v_n_tex integer; v_tem_num boolean; v_tem_tex boolean; v_prim text; v_cob jsonb; v_cursor_seg text; v_neg_filho text;
begin
  -- uma rodada pendente sem segundo informe em 48 h vira divergente na leitura seguinte do plano
  for v_i in select b.arquivo_id from public.obs_archive_b2_files b where b.site_id = p_site and b.pending_mismatch is not null and b.pending_since < v_agora - interval '48 hours' loop
    perform public.obs_archive_b2_retirar(p_site, v_i.arquivo_id, 'divergente', 'forja');
    perform public.obs_archive_b2_recompute_month(p_site, (select class from public.obs_archive_b2_files where site_id = p_site and arquivo_id = v_i.arquivo_id),
                                                  (select month from public.obs_archive_b2_files where site_id = p_site and arquivo_id = v_i.arquivo_id), 'forja', 'divergente');
  end loop;
  if p_cursor is not null then
    if p_cursor !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\|.{0,200}$' then return jsonb_build_object('erro', 'cursor_invalido'); end if;
    select * into v_src from public.obs_archive_b2_runs r where r.id = split_part(p_cursor, '|', 1)::uuid and r.site_id = p_site;
    if not found then return jsonb_build_object('erro', 'cursor_invalido'); end if;
    v_completo := v_src.modo = 'completo';
    v_start := substr(p_cursor, 38);
  else
    v_completo := coalesce(p_completo, false) or public.obs_archive_b2_pede_completo(p_site);
  end if;
  -- o purgo de 90 dias nunca apaga o completo mais recente do site (ele guarda o ponto da retomada)
  delete from public.obs_archive_b2_runs r
   where r.site_id = p_site and r.started_at < v_agora - interval '90 days'
     and r.id is distinct from (select x.id from public.obs_archive_b2_runs x where x.site_id = p_site and x.modo = 'completo' order by x.started_at desc limit 1);
  -- a herança do completo (r2.2)
  if v_completo then
    if p_cursor is not null then
      v_desde := v_src.completo_desde; v_aceitas := v_src.paginas_aceitas; v_cur_ac := v_src.cursor_aceito; v_retomado := p_cursor;
    else
      select * into v_prev from public.obs_archive_b2_runs r where r.site_id = p_site and r.modo = 'completo' order by r.started_at desc limit 1;
      if not found or v_prev.completo_fechado_em is not null then
        v_desde := v_agora; v_aceitas := 0; v_cur_ac := null; v_retomado := null; v_start := null;
      else
        v_desde := v_prev.completo_desde; v_aceitas := v_prev.paginas_aceitas; v_cur_ac := v_prev.cursor_aceito; v_retomado := v_prev.cursor_aceito;
        v_start := case when v_cur_ac is null then null else substr(v_cur_ac, 38) end;
      end if;
    end if;
  end if;
  -- os arquivos: de obs_archive_month_files (D23), sem hash esperado
  with ms as (
    select m.class, m.month, bool_or(m.dropped_at is not null) as descartado
      from public.obs_archive_months m where m.site_id = p_site and m.sealed_at is not null group by 1, 2
  ), todos as (
    select ms.descartado, ms.class as classe, ms.month as mes, f.* from ms cross join lateral public.obs_archive_month_files(p_site, ms.class, ms.month) f
  ), normais as (
    select * from todos where not descartado and (b2_ok_at is null or b2_ok_at < v_agora - interval '5 days')
  ), rodizio as (
    select t.*, sum(coalesce(t.file_bytes, 0)) over (order by t.b2_ok_at nulls first, t.arquivo_id) as acum
      from todos t where t.descartado and (t.b2_ok_at is null or t.b2_ok_at < v_agora - interval '30 days')
  ), escolha as (
    select t.arquivo_id, t.tipo, t.filho, t.caminho, t.classe, t.table_name, t.channel_ref, t.mes, t.version, t.control_column from todos t where v_completo
    union all select n.arquivo_id, n.tipo, n.filho, n.caminho, n.classe, n.table_name, n.channel_ref, n.mes, n.version, n.control_column from normais n where not v_completo
    union all select r.arquivo_id, r.tipo, r.filho, r.caminho, r.classe, r.table_name, r.channel_ref, r.mes, r.version, r.control_column
                from rodizio r where not v_completo and r.acum <= (select coalesce(sum(coalesce(t.file_bytes, 0)), 0) / 30.0 * 1.2 from todos t)
  )
  select coalesce(jsonb_agg(jsonb_build_object('arquivo_id', e.arquivo_id, 'tipo', e.tipo, 'filho', e.filho, 'caminho', e.caminho, 'classe', e.classe, 'tabela', e.table_name,
           'canal', e.channel_ref, 'mes', to_char(e.mes, 'YYYY-MM'), 'versao', e.version, 'coluna_controle', e.control_column) order by e.arquivo_id collate "C"), '[]'::jsonb)
    into v_all from escolha e;
  select count(*) filter (where e->>'filho' = 'numerico'), count(*) filter (where e->>'filho' = 'texto') into v_n_num, v_n_tex from jsonb_array_elements(v_all) e;
  select count(*) into v_depois from jsonb_array_elements(v_all) e where v_start is null or (e->>'arquivo_id') collate "C" > v_start collate "C";
  select coalesce(jsonb_agg(q.e order by (q.e->>'arquivo_id') collate "C"), '[]'::jsonb) into v_page
    from (select e from jsonb_array_elements(v_all) e where v_start is null or (e->>'arquivo_id') collate "C" > v_start collate "C"
           order by (e->>'arquivo_id') collate "C" limit 500) q(e);
  v_mais := v_depois > 500;
  v_ultimo := case when jsonb_array_length(v_page) = 0 then null else (v_page -> (jsonb_array_length(v_page) - 1))->>'arquivo_id' end;
  v_total := greatest(1, v_aceitas + ceil(v_depois / 500.0)::int);
  -- a execução: a mesma dentro da validade (renova 2 h), ou uma nova (sem cursor ou com cursor vencido)
  if p_cursor is not null and v_src.expires_at >= v_agora then
    update public.obs_archive_b2_runs set expires_at = v_agora + interval '2 hours' where id = v_src.id returning * into v_run;
  else
    -- alterna pelo filho da execução ANTERIOR (Phil M5): contar as linhas muda de paridade quando o expurgo de 90 dias apaga execuções
    select case coalesce((select r.negative_filho from public.obs_archive_b2_runs r where r.site_id = p_site order by r.started_at desc limit 1), 'texto')
                when 'numerico' then 'texto' else 'numerico' end into v_neg_filho;
    select jsonb_build_object(
             'numerico', (select max(c.dia)::text from public.obs_archive_canaries c where c.site_id = p_site and c.filho = 'numerico' and c.informed_at <= v_agora - interval '6 hours'),
             'texto', (select max(c.dia)::text from public.obs_archive_canaries c where c.site_id = p_site and c.filho = 'texto' and c.informed_at <= v_agora - interval '6 hours')) into v_dias;
    insert into public.obs_archive_b2_runs (site_id, started_at, expires_at, modo, negative_name, negative_filho, canary_days, completo_desde, retomado_de, paginas_aceitas, paginas_total, cursor_aceito)
    values (p_site, v_agora, v_agora + interval '2 hours', case when v_completo then 'completo' else 'normal' end, '_controle/' || gen_random_uuid(), v_neg_filho, v_dias,
            case when v_completo then v_desde end, case when v_completo then v_retomado end, case when v_completo then v_aceitas else 0 end,
            case when v_completo then v_total end, case when v_completo then v_cur_ac end)
    returning * into v_run;
  end if;
  if v_run.modo = 'completo' and not exists (select 1 from jsonb_array_elements(v_run.paginas) p where p->>'ate' is not distinct from v_ultimo and (p->>'ultima')::boolean = not v_mais) then
    update public.obs_archive_b2_runs
       set paginas = paginas || jsonb_build_array(jsonb_build_object('ate', v_ultimo, 'ids', (select coalesce(jsonb_agg(e->'arquivo_id'), '[]'::jsonb) from jsonb_array_elements(v_page) e), 'ultima', not v_mais, 'aceita', false))
     where id = v_run.id returning * into v_run;
  end if;
  v_cursor_seg := case when v_mais then v_run.id::text || '|' || v_ultimo end;
  select to_char(min(m.month), 'YYYY-MM') into v_prim from public.obs_archive_months m where m.site_id = p_site and m.sealed_at is not null;
  select exists (select 1 from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name where m.site_id = p_site and m.sealed_at is not null and p.filho = 'numerico'),
         exists (select 1 from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name where m.site_id = p_site and m.sealed_at is not null and p.filho = 'texto')
    into v_tem_num, v_tem_tex;
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos(uuid)') is not null then
    execute 'select to_jsonb(public.obs_archive_vermelhos($1))' into v_verm using p_site;
  end if;
  v_cob := case when v_run.modo = 'completo' then jsonb_build_object('paginas_aceitas', v_run.paginas_aceitas, 'paginas_total', v_run.paginas_total) end;
  return jsonb_build_object(
    'execucao_id', v_run.id, 'gerado_em', v_agora, 'modo', v_run.modo, 'cursor_seguinte', v_cursor_seg, 'primeira_selagem', v_prim, 'vermelhos', v_verm,
    'retomado_de', case when v_run.modo = 'completo' then v_run.retomado_de end, 'cobertura', v_cob,
    'estado', jsonb_build_object(
      'numerico', case when not v_tem_num then 'aguardando_primeira_selagem' when v_n_num = 0 then 'nada_devido' else 'com_pedidos' end,
      'texto', case when not v_tem_tex then 'aguardando_primeira_selagem' when v_n_tex = 0 then 'nada_devido' else 'com_pedidos' end),
    'teto_bytes_dia', public.obs_archive_b2_teto_dia(p_site), 'teto_bytes_mes', public.obs_archive_b2_franquia_mes() / 2,
    'controle_negativo', jsonb_build_object('arquivo_id', 'controle_negativo', 'filho', v_run.negative_filho, 'caminho', v_run.negative_name),
    'canarios', jsonb_build_array(
      jsonb_build_object('arquivo_id', 'canario:numerico', 'filho', 'numerico', 'caminho', case when v_run.canary_days->>'numerico' is null then null else '_canario/' || (v_run.canary_days->>'numerico') end),
      jsonb_build_object('arquivo_id', 'canario:texto', 'filho', 'texto', 'caminho', case when v_run.canary_days->>'texto' is null then null else '_canario/' || (v_run.canary_days->>'texto') end)),
    'arquivos', v_page, 'prefixos_ausentes', '[]'::jsonb);
end $$;
revoke all on function public.obs_archive_b2_plan(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.obs_archive_b2_plan(uuid, boolean, text) to service_role;

-- O informe do B2 (contrato C7.2). Cada item passa pelo portão do controle; só então vira conferência do arquivo.
create or replace function public.obs_archive_attest_b2(p_site uuid, p_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora();
  v_run uuid; r public.obs_archive_b2_runs; it jsonb; v_id text; v_res text; v_gate text; v_out jsonb := '[]'::jsonb; v_mot text; v_resp text;
  i record; b public.obs_archive_b2_files; v_fid text; v_ts bigint; v_igual boolean; v_novo jsonb; v_tocados jsonb := '{}'::jsonb; v_k text; v_t text; v_ult text := 'ok'; v_n integer := 0; v_tent integer;
  v_lin bigint; v_soma numeric; v_sha text;
begin
  if p_body is null or p_body->>'fonte' is distinct from 'b2' or coalesce(p_body->>'execucao_id', '') !~ '^[0-9a-f-]{36}$' then raise exception 'forma' using errcode = 'P0001'; end if;
  v_run := (p_body->>'execucao_id')::uuid;
  for it in select * from jsonb_array_elements(coalesce(p_body->'itens', '[]'::jsonb)) loop
    v_id := it->>'arquivo_id'; v_res := it->>'resultado'; v_resp := 'aceito'; v_mot := null; v_n := v_n + 1;
    v_fid := it->>'file_id'; v_ts := (it->>'upload_timestamp')::bigint; v_tent := coalesce((it->>'tentativa')::int, 1);
    v_sha := it->>'sha256'; v_lin := (it->>'linhas')::bigint; v_soma := (it->>'soma')::numeric;
    if v_res is null or v_res not in ('presente', 'ausente', 'sem_acesso', 'chave_ausente', 'nao_decifra') then
      v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'forma')); continue;
    end if;
    v_gate := public.obs_archive_b2_run_gate(p_site, v_run, it);
    if v_gate <> 'seguir' then
      if v_gate = 'aceito' then v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'aceito'));
      else v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', v_gate)); end if;
      continue;
    end if;
    select * into i from public.obs_archive_b2_file_info(p_site, v_id) limit 1;
    if not found then v_out := v_out || jsonb_build_array(jsonb_build_object('arquivo_id', v_id, 'resposta', 'recusado', 'motivo', 'desconhecido')); continue; end if;
    insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month) values (p_site, v_id, i.class, i.month) on conflict (site_id, arquivo_id) do nothing;
    select * into b from public.obs_archive_b2_files x where x.site_id = p_site and x.arquivo_id = v_id for update;
    if v_res in ('presente', 'nao_decifra') and (v_fid is null or v_ts is null) then
      v_resp := 'recusado'; v_mot := 'sem_file_id'; v_res := 'sem_acesso';
      update public.obs_archive_b2_runs set file_id_recusado = true where id = v_run;
    elsif v_res in ('presente', 'nao_decifra') and v_fid !~ '^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$' then
      v_resp := 'recusado'; v_mot := 'file_id_invalido'; v_res := 'sem_acesso';
      update public.obs_archive_b2_runs set file_id_recusado = true where id = v_run;
    elsif v_res = 'presente' and (v_sha is null or i.exp_sha is null) then
      -- Phil M2: nulo contra nulo não é "igual". Informe presente sem sha256 é forma errada; arquivo sem sha256 esperado não se atesta
      v_resp := 'recusado'; v_mot := case when i.exp_sha is null then 'desconhecido' else 'forma' end; v_res := 'sem_acesso';
    end if;

    if v_res = 'nao_decifra' then
      -- K4: divergente já no primeiro informe, sem repetir; o file_id nunca vira o "bom"
      perform public.obs_archive_b2_retirar(p_site, v_id, 'divergente', 'forja');
      update public.obs_archive_b2_files set ilegivel_at = v_agora, last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
      v_ult := 'divergente';
    elsif v_res = 'presente' then
      -- compara com o registro: unidade com linhas e soma; parte e resumo com linhas; manifesto só o sha256
      v_igual := v_sha is not distinct from i.exp_sha and (v_lin is null or i.exp_rows is null or v_lin = i.exp_rows)
                 and (not i.cmp_soma or v_soma is not distinct from i.exp_soma);
      if v_igual then
        update public.obs_archive_b2_files
           set last_ok_at = v_agora, last_ok_via = 'forja', last_ok_file_id = v_fid, last_ok_upload_ts = v_ts, last_attempt_at = v_agora, last_attempt_result = 'ok',
               last_attempt_run = v_run, pending_mismatch = null, pending_since = null, pending_run = null
         where site_id = p_site and arquivo_id = v_id;
        v_ult := 'ok';
      else
        v_novo := jsonb_build_object('sha256', v_sha, 'linhas', v_lin, 'soma', v_soma::text);
        if b.pending_mismatch is null then
          update public.obs_archive_b2_files set pending_mismatch = v_novo, pending_since = v_agora, pending_run = v_run, last_attempt_at = v_agora,
                 last_attempt_result = 'divergencia_a_confirmar', last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
          v_resp := 'repetir'; v_ult := 'divergencia_a_confirmar';
        elsif b.pending_mismatch = v_novo or b.pending_since < v_agora - interval '48 hours' then
          perform public.obs_archive_b2_retirar(p_site, v_id, 'divergente', 'forja');
          update public.obs_archive_b2_files set last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
          v_ult := 'divergente';
        else
          update public.obs_archive_b2_files set pending_mismatch = null, pending_since = null, pending_run = null, last_attempt_at = v_agora,
                 last_attempt_result = 'sem_acesso', last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
          v_ult := 'sem_acesso';
        end if;
      end if;
    elsif v_res = 'ausente' then
      if i.received_at is not null and i.received_at < v_agora - interval '48 hours' then
        perform public.obs_archive_b2_retirar(p_site, v_id, 'arquivo_ausente', 'forja');
        update public.obs_archive_b2_files set last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
        v_ult := 'arquivo_ausente';
      else
        update public.obs_archive_b2_files set last_attempt_at = v_agora, last_attempt_result = 'aguardando_b2', last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
        v_ult := 'aguardando_b2';
      end if;
    else   -- sem_acesso e chave_ausente: a tentativa fica registrada, nada retira
      update public.obs_archive_b2_files set last_attempt_at = v_agora, last_attempt_result = v_res, last_attempt_run = v_run where site_id = p_site and arquivo_id = v_id;
      v_ult := v_res;
    end if;
    v_tocados := v_tocados || jsonb_build_object(i.class || '|' || i.month::text, v_ult);
    v_out := v_out || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('arquivo_id', v_id, 'resposta', v_resp, 'motivo', v_mot)));
  end loop;
  for v_k in select jsonb_object_keys(v_tocados) loop
    perform public.obs_archive_b2_recompute_month(p_site, split_part(v_k, '|', 1), split_part(v_k, '|', 2)::date, 'forja', v_tocados->>v_k);
  end loop;
  update public.obs_archive_b2_runs set files_reported = files_reported + v_n where id = v_run and site_id = p_site;
  select * into r from public.obs_archive_b2_runs where id = v_run and site_id = p_site;
  if found and r.modo = 'completo' then perform public.obs_archive_b2_aceitar_paginas(p_site, v_run); end if;
  select * into r from public.obs_archive_b2_runs where id = v_run and site_id = p_site;
  return jsonb_build_object('execucao', jsonb_build_object('estado', coalesce(r.estado, 'aguardando_controle'), 'negativo_ok', coalesce(r.negative_ok, false),
           'canario_ok', jsonb_build_object('numerico', coalesce((r.canary_ok->>'numerico')::boolean, false), 'texto', coalesce((r.canary_ok->>'texto')::boolean, false))),
         'itens', v_out);
end $$;
revoke all on function public.obs_archive_attest_b2(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_b2(uuid, jsonb) to service_role;

-- A mesma conferência feita pelo dono (atestar-b2 e ensaiar-restauracao, M8): a origem 'dono', com a validade de 35 dias. Itens {arquivo_id, resultado:
-- 'ok' | 'divergente' | 'ausente'}. O ok do dono só vale para o mês se cobre TODOS os arquivos do conjunto (obs_archive_month_files).
create or replace function public.obs_archive_attest_b2_dono(p_site uuid, p_class text, p_month date, p_by text, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_agora timestamptz := public.obs_archive_agora(); it jsonb; v_id text; v_res text; i record; v_faltam text[]; v_mal boolean := false; m record; v_fid text;
begin
  if p_by is null or length(p_by) < 1 then raise exception 'forma' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_id := it->>'arquivo_id'; v_res := it->>'resultado'; v_fid := it->>'file_id';
    select * into i from public.obs_archive_b2_file_info(p_site, v_id) limit 1;
    if not found or i.class <> p_class or i.month <> p_month then continue; end if;
    insert into public.obs_archive_b2_files (site_id, arquivo_id, class, month) values (p_site, v_id, i.class, i.month) on conflict (site_id, arquivo_id) do nothing;
    if v_res = 'ok' then
      update public.obs_archive_b2_files set last_ok_at = v_agora, last_ok_via = 'dono', last_ok_file_id = coalesce(v_fid, last_ok_file_id), last_attempt_at = v_agora,
             last_attempt_result = 'ok', pending_mismatch = null, pending_since = null, pending_run = null where site_id = p_site and arquivo_id = v_id;
    elsif v_res in ('divergente', 'ausente') then
      v_mal := true;
      perform public.obs_archive_b2_retirar(p_site, v_id, case when v_res = 'ausente' then 'arquivo_ausente' else 'divergente' end, 'dono');
    end if;
  end loop;
  if not v_mal then
    select array_agg(f.arquivo_id order by f.arquivo_id) into v_faltam
      from public.obs_archive_month_files(p_site, p_class, p_month) f
     where not exists (select 1 from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x where x->>'arquivo_id' = f.arquivo_id and x->>'resultado' = 'ok');
    if v_faltam is null and exists (select 1 from public.obs_archive_month_files(p_site, p_class, p_month)) then
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.month = p_month and x.sealed_at is not null limit 1;
      if found then
        -- ok do dono que limpa a retirada da forja registra a divergência (a M6 desarma o interruptor por ela)
        update public.obs_archive_months
           set b2_dono_ok_at = v_agora, b2_dono_manifest_sha256 = manifest_sha256, b2_dono_by = p_by,
               b2_forja_diverged_at = case when b2_withdrawn_at is not null and b2_withdrawn_via = 'forja' then v_agora else b2_forja_diverged_at end,
               b2_withdrawn_at = case when b2_withdrawn_via = 'forja' or b2_withdrawn_via = 'dono' then null else b2_withdrawn_at end,
               b2_withdrawn_reason = case when b2_withdrawn_via = 'forja' or b2_withdrawn_via = 'dono' then null else b2_withdrawn_reason end,
               b2_withdrawn_via = case when b2_withdrawn_via = 'forja' or b2_withdrawn_via = 'dono' then null else b2_withdrawn_via end
         where site_id = p_site and class = p_class and month = p_month;
      end if;
    end if;
  end if;
  perform public.obs_archive_b2_recompute_month(p_site, p_class, p_month, 'dono', case when v_mal then 'divergente' else 'ok' end);
  return jsonb_build_object('ok', not v_mal and v_faltam is null, 'faltam', coalesce(to_jsonb(v_faltam), '[]'::jsonb));
end $$;
revoke all on function public.obs_archive_attest_b2_dono(uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_b2_dono(uuid, text, date, text, jsonb) to service_role;

-- O estado do B2 de um mês, para o plano e a página.
create or replace function public.obs_archive_b2_month_state(p_site uuid, p_class text, p_month date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month)
         then jsonb_build_object('atestada_em', null, 'retirada', null) else (select jsonb_build_object(
           'atestada_em', max(m.b2_attested_at), 'via', max(m.b2_attested_via), 'por', max(m.b2_attested_by),
           'forja_ok_at', max(m.b2_forja_ok_at), 'dono_ok_at', max(m.b2_dono_ok_at), 'forja_divergiu_em', max(m.b2_forja_diverged_at),
           'retirada', case when bool_or(m.b2_withdrawn_at is not null)
                         then (select jsonb_build_object('em', x.b2_withdrawn_at, 'motivo', x.b2_withdrawn_reason, 'via', x.b2_withdrawn_via)
                                 from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.month = p_month and x.b2_withdrawn_at is not null limit 1) end,
           'ultima_tentativa', jsonb_build_object('em', max(m.b2_last_attempt_at), 'resultado', max(m.b2_last_attempt_result), 'via', max(m.b2_last_attempt_via)),
           'idade_dias', case when max(m.b2_attested_at) is null then null else floor(extract(epoch from (public.obs_archive_agora() - max(m.b2_attested_at))) / 86400)::int end)
         from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month) end
$$;
revoke all on function public.obs_archive_b2_month_state(uuid, text, date) from public, anon, authenticated;
grant execute on function public.obs_archive_b2_month_state(uuid, text, date) to service_role;

-- M3B PARTE 5: o plano do copiador, o atraso, os vermelhos, a varredura completa, o batimento e o pode-desligar (02 §10.10, C1, C8, C11)

-- Cor do teto de bytes (r2.2, M6 do Phil): âmbar no primeiro dia em que o teto estoura, vermelho no segundo dia seguido; quem conta é o site, pelo
-- histórico das execuções marcadas pelo batimento do conferir_b2 (o pulso só lê a cor). Dia de São Paulo do batimento.
create or replace function public.obs_archive_b2_teto_cor(p_site uuid) returns text
language sql stable security definer set search_path = '' as $$
  with dias as (
    select (r.batimento_em at time zone 'America/Sao_Paulo')::date as dia, bool_or(r.parou_no_teto is not null) as estourou
      from public.obs_archive_b2_runs r
     where r.site_id = p_site and r.batimento_em is not null
     group by 1
  ), ultimo as (select dia, estourou from dias order by dia desc limit 1)
  select case
    when not coalesce((select estourou from ultimo), false) then 'verde'
    when exists (select 1 from dias d, ultimo u where d.dia = u.dia - 1 and d.estourou) then 'vermelho'
    else 'ambar' end
$$;
revoke all on function public.obs_archive_b2_teto_cor(uuid) from public, anon, authenticated, service_role;

-- O início da classe (D13), calculado uma vez e gravado (Phil M7): o mês mais antigo com dado na classe, com o piso de outubro de 2026 fora do ensaio.
-- Classe sem nenhuma linha: fora do ensaio vale o piso (grava); no ensaio fica nulo e não grava (sem rol e sem linha não há mês devido).
create or replace function public.obs_archive_first_month(p_site uuid, p_class text) returns date
language plpgsql security definer set search_path = '' as $$
declare v date; v_min timestamptz; v_dia date; t record; v_ts timestamptz;
begin
  select s.first_month into v from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class;
  if v is not null then return v; end if;
  for t in select p.table_name from public.obs_archive_policy() p where p.class = p_class order by p.table_name loop
    continue when pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(t.table_name)) is null;
    v_ts := null;
    if t.table_name = 'competitor_video_hourly' then
      select min(h.hour_slot) into v_ts from public.competitor_video_hourly h join public.competitor_videos cv on cv.id = h.video_id
        join public.competitor_channels ch on ch.id = cv.competitor_channel_id where ch.site_id = p_site;
    elsif t.table_name = 'competitor_video_daily' then
      select (min(d.snap_date)::text || ' 00:00:00-03')::timestamptz into v_ts from public.competitor_video_daily d join public.competitor_videos cv on cv.id = d.video_id
        join public.competitor_channels ch on ch.id = cv.competitor_channel_id where ch.site_id = p_site;
    elsif t.table_name = 'competitor_video_early' then
      select min(e.taken_at) into v_ts from public.competitor_video_early e join public.competitor_videos cv on cv.id = e.video_id
        join public.competitor_channels ch on ch.id = cv.competitor_channel_id where ch.site_id = p_site;
    elsif t.table_name = 'competitor_video_comments' then
      select min(k.first_seen_at) into v_ts from public.competitor_video_comments k where k.site_id = p_site;
    elsif t.table_name = 'competitor_raw' and p_class = 'texto' then
      select min(r.last_seen_at) into v_ts from public.competitor_raw r where r.site_id = p_site and not r.is_current;
    elsif t.table_name = 'obs_archive_rehearsal' then
      select min(r.hour_slot) into v_ts from public.obs_archive_rehearsal r where r.site_id = p_site;
    end if;
    if v_ts is not null and (v_min is null or v_ts < v_min) then v_min := v_ts; end if;
  end loop;
  v_dia := case when v_min is null then null else date_trunc('month', (v_min at time zone 'America/Sao_Paulo'))::date end;
  if p_class <> 'ensaio' then v_dia := greatest(coalesce(v_dia, date '2026-10-01'), date '2026-10-01'); end if;
  if v_dia is null then return null; end if;
  insert into public.obs_archive_switch (site_id, class, first_month, first_month_at) values (p_site, p_class, v_dia, now())
  on conflict (site_id, class) do update set first_month = coalesce(public.obs_archive_switch.first_month, excluded.first_month),
                                              first_month_at = coalesce(public.obs_archive_switch.first_month_at, excluded.first_month_at)
  returning first_month into v;
  return v;
end $$;
revoke all on function public.obs_archive_first_month(uuid, text) from public, anon, authenticated, service_role;

-- Os (classe, mês) devidos: do início da classe até o último mês cujo dia devido (obs_archive_due_on) já chegou. p_gravar: o plano calcula e grava o
-- início da classe; a leitura (atraso, vermelhos) usa o gravado ou o piso, nunca grava.
create or replace function public.obs_archive_meses_devidos(p_site uuid, p_gravar boolean)
returns table (classe text, mes date, margem integer) language plpgsql security definer set search_path = '' as $$
declare c record; v_ini date; v_m date; v_hoje date := public.obs_archive_hoje_sp(); n integer;
begin
  for c in select p.class as cl, min(p.seal_margin_days) as mg from public.obs_archive_policy() p where p.class <> 'video_antigo' group by p.class order by p.class loop
    if p_gravar then v_ini := public.obs_archive_first_month(p_site, c.cl);
    else select s.first_month into v_ini from public.obs_archive_switch s where s.site_id = p_site and s.class = c.cl; end if;
    if c.cl <> 'ensaio' then v_ini := greatest(coalesce(v_ini, date '2026-10-01'), date '2026-10-01'); end if;
    continue when v_ini is null;
    v_m := v_ini; n := 0;
    while public.obs_archive_due_on(v_m, c.mg) <= v_hoje and n < 240 loop
      classe := c.cl; mes := v_m; margem := c.mg; return next;
      v_m := (v_m + interval '1 month')::date; n := n + 1;
    end loop;
  end loop;
end $$;
revoke all on function public.obs_archive_meses_devidos(uuid, boolean) from public, anon, authenticated, service_role;

-- O resumo de um canal é devido quando todas as unidades dele são terminais, nem todas expurgadas, e não há resumo da versão atual (recebido ou vazio).
create or replace function public.obs_archive_resumo_devido(p_site uuid, p_class text, p_month date, p_channel text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_class <> 'video_antigo'
     and not exists (select 1 from public.obs_archive_pending_units(p_site, p_class, p_month, p_channel))
     and not (exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) cu where cu.channel_ref = p_channel)
              and not exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) cu where cu.channel_ref = p_channel and cu.purged_at is null))
     and not exists (
       select 1 from (select s.* from public.obs_archive_summaries s
                       where s.site_id = p_site and s.class = p_class and s.channel_ref = p_channel and s.month = p_month order by s.version desc limit 1) l
        where l.superseded_at is null and l.nas_withdrawn_at is null and (l.empty or l.received_at is not null)
          and l.unit_hashes = public.obs_archive_channel_unit_hashes(p_site, p_class, p_channel, p_month))
$$;
revoke all on function public.obs_archive_resumo_devido(uuid, text, date, text) from public, anon, authenticated, service_role;

-- Os arquivos do mês selado com a hora do último informe do NAS (a base da reconferência e da varredura).
create or replace function public.obs_archive_nas_cobertura(p_site uuid)
returns table (arquivo_id text, tipo text, filho text, caminho text, classe text, tabela text, canal text, mes date, versao integer, coluna_controle text,
               descartado boolean, received_at timestamptz, b2_ok_at timestamptz, reported_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with ms as (
    select m.class, m.month, bool_or(m.dropped_at is not null) as descartado
      from public.obs_archive_months m where m.site_id = p_site and m.sealed_at is not null group by 1, 2
  )
  select f.arquivo_id, f.tipo, f.filho, f.caminho, ms.class, f.table_name, f.channel_ref, ms.month, f.version, f.control_column, ms.descartado, f.received_at, f.b2_ok_at,
         case split_part(f.arquivo_id, ':', 1)
           when 'u' then (select u.nas_reported_at from public.obs_archive_units u where u.id = split_part(f.arquivo_id, ':', 2)::uuid)
           when 'p' then (select pt.nas_reported_at from public.obs_archive_unit_parts pt where pt.unit_id = split_part(f.arquivo_id, ':', 2)::uuid and pt.part = ltrim(split_part(f.arquivo_id, ':', 3), '0')::int)
           when 's' then (select s.nas_reported_at from public.obs_archive_summaries s where s.id = split_part(f.arquivo_id, ':', 2)::uuid)
           when 'm' then (select o.manifest_nas_reported_at from public.obs_archive_months o where o.site_id = p_site and o.class = ms.class and o.month = ms.month and o.manifest_nas_reported_at is not null order by o.manifest_version desc limit 1)
         end
    from ms cross join lateral public.obs_archive_month_files(p_site, ms.class, ms.month) f
$$;
revoke all on function public.obs_archive_nas_cobertura(uuid) from public, anon, authenticated, service_role;

-- Os itens em atraso, sobre obs_archive_expected_units (nunca só sobre as linhas que existem; Phil I6): o par esperado sem unidade terminal, exista a
-- linha ou não, e o (classe, mês) devido sem selo. "Devida desde" = obs_archive_due_on(mês, margem). Base de obs_archive_atraso e dos vermelhos.
create or replace function public.obs_archive_atraso_itens(p_site uuid)
returns table (tipo text, classe text, tabela text, canal text, mes date, desde date)
language sql stable security definer set search_path = '' as $$
  select 'unidade'::text, r.classe, e.table_name, e.channel_ref, r.mes, public.obs_archive_due_on(r.mes, r.margem)
    from public.obs_archive_meses_devidos(p_site, false) r
    cross join lateral public.obs_archive_expected_units(p_site, r.classe, r.mes) e
   where not exists (select 1 from public.obs_archive_current_units(p_site, r.classe, r.mes) cu
                      where cu.table_name = e.table_name and cu.channel_ref = e.channel_ref
                        and public.obs_archive_is_terminal(cu.received_at, cu.redo_reason, cu.row_count, cu.lost_at, cu.purged_at))
  union all
  select 'mes'::text, r.classe, null::text, null::text, r.mes, public.obs_archive_due_on(r.mes, r.margem)
    from public.obs_archive_meses_devidos(p_site, false) r
   where exists (select 1 from public.obs_archive_expected_units(p_site, r.classe, r.mes))
     and not exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = r.classe and m.month = r.mes and m.sealed_at is not null and m.unsealed_at is null)
$$;
revoke all on function public.obs_archive_atraso_itens(uuid) from public, anon, authenticated, service_role;

-- {amarelos, vermelhos, mais_antiga, meses_sem_selo}: amarelo acima de 5 dias, vermelho acima de 30 (constantes do plano da M3b).
create or replace function public.obs_archive_atraso(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'amarelos', count(*) filter (where i.tipo = 'unidade' and public.obs_archive_hoje_sp() - i.desde > 5 and public.obs_archive_hoje_sp() - i.desde <= 30),
    'vermelhos', count(*) filter (where i.tipo = 'unidade' and public.obs_archive_hoje_sp() - i.desde > 30),
    'mais_antiga', min(i.desde) filter (where i.tipo = 'unidade'),
    'meses_sem_selo', count(*) filter (where i.tipo = 'mes'))
    from public.obs_archive_atraso_itens(p_site) i
$$;
revoke all on function public.obs_archive_atraso(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_atraso(uuid) to service_role;

-- Mês descartado sem releitura há mais de p_dias, pelos dois lados (NAS pelo nas_reported_at, B2 pelo b2_ok_at de obs_archive_month_files):
-- o mês entra se qualquer arquivo dele passar do limite em qualquer lado; sem informe, vale a data do descarte. 21 amarelo, 45 vermelho.
create or replace function public.obs_archive_descartados_sem_releitura(p_site uuid, p_dias integer) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from (
    select x.classe, x.mes from (
      select c.*, (select min(m.dropped_at) from public.obs_archive_months m where m.site_id = p_site and m.class = c.classe and m.month = c.mes) as d
        from public.obs_archive_nas_cobertura(p_site) c where c.descartado) x
     group by x.classe, x.mes
    having bool_or(coalesce(x.reported_at, x.d) < public.obs_archive_agora() - make_interval(days => p_dias)
                or coalesce(x.b2_ok_at, x.d) < public.obs_archive_agora() - make_interval(days => p_dias))
  ) y
$$;
revoke all on function public.obs_archive_descartados_sem_releitura(uuid, integer) from public, anon, authenticated, service_role;

-- b2_atrasado: mês selado não descartado com algum arquivo sem conferência do B2 há mais de p_dias (sem conferência nenhuma, conta do recebimento). 5 amarelo, 7 vermelho.
create or replace function public.obs_archive_b2_atrasados(p_site uuid, p_dias integer) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from (
    select c.classe, c.mes from public.obs_archive_nas_cobertura(p_site) c
     where not c.descartado and coalesce(c.b2_ok_at, c.received_at) < public.obs_archive_agora() - make_interval(days => p_dias)
     group by c.classe, c.mes
  ) x
$$;
revoke all on function public.obs_archive_b2_atrasados(uuid, integer) from public, anon, authenticated, service_role;

-- Os vermelhos do site (C1): uma frase curta por item, texto fixo mais números, nunca nome de canal; nunca nulo. Âmbar não entra.
create or replace function public.obs_archive_vermelhos(p_site uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v text[] := '{}'; n integer; i record; v_hoje date := public.obs_archive_hoje_sp(); v_agora timestamptz := public.obs_archive_agora(); v_cor text; v_h public.obs_archive_heartbeat;
  v_run public.obs_archive_b2_runs; f text;
begin
  select count(*) into n from public.obs_archive_atraso_itens(p_site) a where a.tipo = 'unidade' and v_hoje - a.desde > 30;
  if n > 0 then v := v || format('atraso de cópia: %s unidades há mais de 30 dias', n); end if;
  select count(*) into n from public.obs_archive_atraso_itens(p_site) a where a.tipo = 'mes' and v_hoje - a.desde > 30;
  if n > 0 then v := v || format('mês sem selo há mais de 30 dias: %s', n); end if;
  select (select count(*) from public.obs_archive_units u where u.site_id = p_site and u.nas_withdrawn_at is not null and u.nas_withdrawn_reason in ('ausente', 'divergente') and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id where u.site_id = p_site and pt.nas_withdrawn_at is not null and pt.nas_withdrawn_reason in ('ausente', 'divergente') and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_summaries s where s.site_id = p_site and s.nas_withdrawn_at is not null and s.nas_withdrawn_reason in ('ausente', 'divergente') and s.purged_at is null and s.lost_at is null and s.superseded_at is null)
       + (select count(*) from public.obs_archive_months m where m.site_id = p_site and m.manifest_nas_withdrawn_at is not null) into n;
  if n > 0 then v := v || format('NAS: %s arquivos ausentes ou diferentes', n); end if;
  select count(distinct (m.class, m.month)) into n from public.obs_archive_months m where m.site_id = p_site and m.b2_withdrawn_at is not null;
  if n > 0 then v := v || format('B2: %s meses com a conferência retirada', n); end if;
  select (select count(*) from public.obs_archive_units u where u.site_id = p_site and u.nas_withdrawn_reason = 'conteudo_divergente' and u.nas_withdrawn_at is not null and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id where u.site_id = p_site and pt.nas_withdrawn_reason = 'conteudo_divergente' and pt.nas_withdrawn_at is not null and u.purged_at is null and u.lost_at is null and u.superseded_at is null)
       + (select count(*) from public.obs_archive_summaries s where s.site_id = p_site and s.nas_withdrawn_reason = 'conteudo_divergente' and s.nas_withdrawn_at is not null and s.purged_at is null and s.lost_at is null and s.superseded_at is null) into n;
  if n > 0 then v := v || format('conteúdo divergente em %s arquivos', n); end if;
  n := public.obs_archive_descartados_sem_releitura(p_site, 45);
  if n > 0 then v := v || format('mês descartado sem releitura há mais de 45 dias: %s', n); end if;
  n := public.obs_archive_b2_atrasados(p_site, 7);
  if n > 0 then v := v || format('b2_atrasado: %s meses selados não descartados com algum arquivo sem b2_ok_at há mais de 7 dias', n); end if;
  -- a mesma recusa de fileId em 3 execuções seguidas (as 3 mais recentes do site)
  if (select count(*) filter (where q.file_id_recusado) from (select r.file_id_recusado from public.obs_archive_b2_runs r where r.site_id = p_site order by r.started_at desc limit 3) q) = 3 then
    v := pg_catalog.array_append(v, 'B2 recusou o fileId em 3 execuções seguidas');
  end if;
  -- canário de um filho sem chegar ao B2 (>= 5 dias): o mais antigo informado depois do último que o B2 achou
  for i in select fl.filho,
                  (select min(c.informed_at) from public.obs_archive_canaries c where c.site_id = p_site and c.filho = fl.filho and c.b2_ok_at is null
                      and c.informed_at > coalesce((select max(k.informed_at) from public.obs_archive_canaries k where k.site_id = p_site and k.filho = fl.filho and k.b2_ok_at is not null), '-infinity'::timestamptz)) as desde
             from (values ('numerico'), ('texto')) fl(filho) loop
    if i.desde is not null and i.desde <= v_agora - interval '5 days' then
      v := v || format('canário do filho %s sem chegar ao B2 há %s dias', i.filho, floor(extract(epoch from (v_agora - i.desde)) / 86400)::int);
    end if;
  end loop;
  -- Phil M3: o alarme dura 30 dias E vai até um canário NOVO do mesmo filho chegar ao B2 (termina por evidência, não só pelo relógio; o dono pode estar fora)
  for i in select distinct c.filho from public.obs_archive_canaries c
            where c.site_id = p_site and c.regravado_at is not null
              and (c.regravado_at > v_agora - interval '30 days'
                   or not exists (select 1 from public.obs_archive_canaries k where k.site_id = p_site and k.filho = c.filho and k.b2_ok_at is not null and k.b2_ok_at > c.regravado_at))
            order by 1 loop
    v := v || ('canario_regravado:' || i.filho);
  end loop;
  for i in select 'u:' || u.id as id from public.obs_archive_units u where u.site_id = p_site and u.nas_unreadable_at is not null and u.purged_at is null and u.lost_at is null
           union all select 'p:' || pt.unit_id || ':' || lpad(pt.part::text, 2, '0') from public.obs_archive_unit_parts pt join public.obs_archive_units u on u.id = pt.unit_id where u.site_id = p_site and pt.nas_unreadable_at is not null
           union all select 's:' || s.id from public.obs_archive_summaries s where s.site_id = p_site and s.nas_unreadable_at is not null
           order by 1 loop
    v := v || ('nas_ilegivel:' || i.id);
  end loop;
  for i in select b.arquivo_id from public.obs_archive_b2_files b where b.site_id = p_site and b.ilegivel_at is not null and (b.last_ok_at is null or b.last_ok_at < b.ilegivel_at) order by 1 loop
    v := v || ('b2_ilegivel:' || i.arquivo_id);
  end loop;
  select * into v_h from public.obs_archive_heartbeat h where h.site_id = p_site and h.worker = 'copiador';
  if found then
    foreach f in array array['numerico', 'texto'] loop
      if coalesce((v_h.total_bytes->>f)::numeric, 0) > 0 and (v_h.free_bytes->>f) is not null
         and ((v_h.total_bytes->>f)::numeric - (v_h.free_bytes->>f)::numeric) / (v_h.total_bytes->>f)::numeric >= 0.8 then
        v := v || ('nas_80:' || f);
      end if;
    end loop;
  end if;
  for i in select p.table_name from public.obs_archive_policy() p where p.class in ('horaria', 'serie', 'texto') and pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p.table_name)) is null order by 1 loop
    v := v || ('tabela_ausente:' || i.table_name);
  end loop;
  if public.obs_archive_b2_teto_dia(p_site) > public.obs_archive_b2_franquia_mes() / 2 then v := pg_catalog.array_append(v, 'b2_piso_acima_do_teto'); end if;
  select * into v_run from public.obs_archive_b2_runs r where r.site_id = p_site and r.modo = 'completo' order by r.started_at desc limit 1;
  if found and v_run.completo_fechado_em is null and v_run.completo_desde < v_agora - interval '35 days' then
    v := v || format('b2_completo_atrasado: conferência completa do B2 aberta há %s dias: rode conferir-b2 --completo até fechar', floor(extract(epoch from (v_agora - v_run.completo_desde)) / 86400)::int);
  end if;
  v_cor := public.obs_archive_b2_teto_cor(p_site);
  if v_cor = 'vermelho' then v := pg_catalog.array_append(v, 'b2_teto_2_dias'); end if;
  -- da fatia 12a (Tarefa 8): canais removidos sem destino e a vigia da remoção; a função nasce lá
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_remocao(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_remocao($2)' into v using v, p_site;
  end if;
  return coalesce(v, '{}'::text[]);
end $$;
revoke all on function public.obs_archive_vermelhos(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_vermelhos(uuid) to service_role;

-- O batimento (C8). O trabalhador vem da permissão da chave. Uma gravação por 30 s do mesmo trabalhador, hora do banco. Silêncio e varredura são só do
-- copiador: o nas_checked_at anterior é lido ANTES de gravar o novo. A marca da execução do conferir_b2 (r2.2, M6 do Phil) vale com ou sem gravação.
create or replace function public.obs_archive_heartbeat_write(p_site uuid, p_worker text, p_body jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prev public.obs_archive_heartbeat; v_gravado boolean := true; v_ant timestamptz; v_ok boolean := coalesce((p_body->>'nas_ok')::boolean, false);
  v_teto text := null; v_agora timestamptz := public.obs_archive_agora(); v_cap text := nullif(p_body->>'parado_no_teto', ''); v_mt timestamptz;
begin
  if p_worker is null or p_worker not in ('copiador', 'respondedor', 'conferir_b2') or p_body is null then raise exception 'forma' using errcode = 'P0001'; end if;
  begin v_mt := (p_body->>'hora_maquina')::timestamptz; exception when others then v_mt := null; end;
  insert into public.obs_archive_heartbeat (site_id, worker) values (p_site, p_worker) on conflict (site_id, worker) do nothing;
  select * into v_prev from public.obs_archive_heartbeat h where h.site_id = p_site and h.worker = p_worker for update;
  if p_worker = 'conferir_b2' then
    update public.obs_archive_b2_runs set batimento_em = v_agora, parou_no_teto = v_cap
     where id = (select r.id from public.obs_archive_b2_runs r where r.site_id = p_site and r.batimento_em is null and r.started_at > v_agora - interval '3 hours' order by r.started_at desc limit 1);
  end if;
  if v_prev.updated_at is not null and v_prev.updated_at > now() - interval '30 seconds' then
    v_gravado := false;
  else
    v_ant := v_prev.nas_checked_at;
    if p_worker = 'copiador' and v_ok then
      if (v_ant is not null and v_ant < now() - interval '24 hours')
         or (v_ant is null and exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.received_at is not null)) then
        insert into public.obs_archive_sweeps (site_id, due_since, nas_back_at, motivo)
        values (p_site, coalesce(v_ant, (select min(u.exported_at) from public.obs_archive_units u where u.site_id = p_site)), now(), 'silencio_nas')
        on conflict do nothing;
      end if;
      update public.obs_archive_sweeps set nas_back_at = coalesce(nas_back_at, now()) where site_id = p_site and finished_at is null;
    end if;
    update public.obs_archive_heartbeat
       set version = left(p_body->>'versao', 80), nas_ok = v_ok, sentinel_ok = p_body->'sentinela_ok', mounts_ok = p_body->'montagens_ok', machine_time = v_mt,
           free_bytes = p_body->'livre_bytes', total_bytes = p_body->'total_bytes',
           stopped_at_cap = case when p_worker = 'conferir_b2' then v_cap else stopped_at_cap end,
           last_error = left(p_body->>'ultimo_erro', 200), updated_at = now(),
           nas_checked_at = case when p_worker = 'copiador' and v_ok then now() else nas_checked_at end
     where site_id = p_site and worker = p_worker;
  end if;
  if p_worker = 'conferir_b2' then v_teto := public.obs_archive_b2_teto_cor(p_site); end if;
  return jsonb_build_object('gravado', v_gravado, 'teto', v_teto);
end $$;
revoke all on function public.obs_archive_heartbeat_write(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_heartbeat_write(uuid, text, jsonb) to service_role;

-- C11: o que falta para desligar o banco (leitura só; erro lança, nunca "pode"). Também para o dono pela conexão direta (postgres).
create or replace function public.obs_archive_pode_desligar(p_site uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_f jsonb := '[]'::jsonb; r record;
begin
  for r in select s.class from public.obs_archive_switch s where s.site_id = p_site and s.armed_at is not null and s.disarmed_at is null and (s.expires_at is null or s.expires_at > now()) order by s.class loop
    v_f := v_f || jsonb_build_array(jsonb_build_object('motivo', 'automatico_armado', 'classe', r.class, 'tabela', null, 'mes', null, 'detalhe', 'interruptor armado'));
  end loop;
  for r in select c.classe, c.mes, count(*) as n, min(c.tabela) as tabela from public.obs_archive_nas_cobertura(p_site) c where c.received_at is null group by c.classe, c.mes order by c.classe, c.mes loop
    v_f := v_f || jsonb_build_array(jsonb_build_object('motivo', 'mes_nao_recebido', 'classe', r.classe, 'tabela', r.tabela, 'mes', to_char(r.mes, 'YYYY-MM'), 'detalhe', r.n || ' arquivos sem recebimento'));
  end loop;
  for r in select c.classe, c.mes, count(*) as n, min(c.tabela) as tabela from public.obs_archive_nas_cobertura(p_site) c
            where c.descartado and (c.b2_ok_at is null or c.b2_ok_at < public.obs_archive_agora() - interval '7 days') group by c.classe, c.mes order by c.classe, c.mes loop
    v_f := v_f || jsonb_build_array(jsonb_build_object('motivo', 'b2_vencido_mes_fora', 'classe', r.classe, 'tabela', r.tabela, 'mes', to_char(r.mes, 'YYYY-MM'), 'detalhe', r.n || ' arquivos com a conferência do B2 vencida'));
  end loop;
  return jsonb_build_object('pode', jsonb_array_length(v_f) = 0, 'faltam', v_f);
end $$;
revoke all on function public.obs_archive_pode_desligar(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_pode_desligar(uuid) to service_role, postgres;

-- O plano do copiador (contrato C1). O site decide sozinho se a execução é completa (varredura aberta, silêncio do NAS ou pedido) e nunca devolve hash.
create or replace function public.obs_archive_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := public.obs_archive_hoje_sp(); v_agora timestamptz := public.obs_archive_agora();
  v_sweep public.obs_archive_sweeps; v_hb public.obs_archive_heartbeat; v_completo boolean; v_varredura boolean := false; v_so_faltam boolean := false;
  v_exp jsonb := '[]'::jsonb; v_res jsonb := '[]'::jsonb; v_man jsonb := '[]'::jsonb; v_dono jsonb := '[]'::jsonb; v_apagar jsonb := '[]'::jsonb;
  v_rec jsonb := '[]'::jsonb; v_page jsonb; v_depois integer; v_ultimo text; v_prim text; v_pend integer; v_verm text[] := '{}';
begin
  if p_cursor is not null and length(p_cursor) > 200 then return jsonb_build_object('erro', 'cursor_invalido'); end if;
  if p_cursor is null then
    insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at) values (p_site, 'copiador', now())
    on conflict (site_id, worker) do update set last_poll_at = now();
  end if;
  -- a varredura aberta termina quando nenhum arquivo coberto tem informe do NAS posterior à volta faltando (o NAS voltou: nas_back_at preenchido)
  select * into v_sweep from public.obs_archive_sweeps s where s.site_id = p_site and s.finished_at is null;
  if found and v_sweep.nas_back_at is not null then
    select count(*) into v_pend from public.obs_archive_nas_cobertura(p_site) c where c.reported_at is null or c.reported_at < v_sweep.nas_back_at;
    if v_pend = 0 then
      update public.obs_archive_sweeps set finished_at = now() where id = v_sweep.id;
      v_sweep := null;
    end if;
  end if;
  -- o silêncio do copiador (nas_ok verdadeiro, hora do banco) há mais de 24 h abre a varredura (uma só: Yannis M12)
  if v_sweep.id is null and p_cursor is null and not coalesce(p_completo, false) then
    select * into v_hb from public.obs_archive_heartbeat h where h.site_id = p_site and h.worker = 'copiador';
    if found and v_hb.nas_checked_at is not null and v_hb.nas_checked_at < now() - interval '24 hours' then
      insert into public.obs_archive_sweeps (site_id, due_since, motivo) values (p_site, v_hb.nas_checked_at, 'silencio_nas') on conflict do nothing;
    end if;
    select * into v_sweep from public.obs_archive_sweeps s where s.site_id = p_site and s.finished_at is null;
  end if;
  v_varredura := v_sweep.id is not null;
  v_completo := coalesce(p_completo, false) or v_varredura;
  if v_varredura and p_cursor is null then
    update public.obs_archive_sweeps set started_at = coalesce(started_at, now()) where id = v_sweep.id;
  end if;
  v_so_faltam := v_varredura and v_sweep.nas_back_at is not null and not coalesce(p_completo, false);

  if p_cursor is null then
    -- exportar: o par esperado sem unidade, com refazer pedido, ou exportado e não recebido há mais de 2 h; nunca de mês fora do banco
    select coalesce(jsonb_agg(jsonb_build_object('classe', r.classe, 'tabela', e.table_name, 'canal', e.channel_ref, 'mes', to_char(r.mes, 'YYYY-MM'), 'motivo', x.motivo)
                            order by r.classe, r.mes, e.table_name, e.channel_ref), '[]'::jsonb) into v_exp
      from public.obs_archive_meses_devidos(p_site, true) r
      cross join lateral public.obs_archive_expected_units(p_site, r.classe, r.mes) e
      left join lateral (select u.* from public.obs_archive_units u where u.site_id = p_site and u.class = r.classe and u.table_name = e.table_name
                            and u.channel_ref = e.channel_ref and u.month = r.mes order by u.version desc limit 1) cur on true
      cross join lateral (select case
          when cur.id is null then 'nova'
          when cur.redo_reason is not null and cur.purged_at is null and cur.lost_at is null
               and public.obs_archive_can_redo(p_site, r.classe, e.table_name, e.channel_ref, r.mes, cur.dropped_at) then cur.redo_reason
          when cur.received_at is null and cur.row_count > 0 and cur.lost_at is null and cur.purged_at is null and cur.dropped_at is null
               and cur.exported_at < now() - interval '2 hours' then 'nova'
        end as motivo) x
     where x.motivo is not null
       and not exists (select 1 from public.obs_archive_months mo where mo.site_id = p_site and mo.class = r.classe and mo.table_name = e.table_name and mo.month = r.mes
                         and (mo.detached_at is not null or mo.dropped_at is not null));
    -- resumos: as mesmas condições de obs_archive_summary_rows, lidas de obs_archive_expected_units (zero unidade é pendente)
    select coalesce(jsonb_agg(jsonb_build_object('classe', r.classe, 'canal', ch.channel_ref, 'mes', to_char(r.mes, 'YYYY-MM')) order by r.classe, r.mes, ch.channel_ref), '[]'::jsonb) into v_res
      from public.obs_archive_meses_devidos(p_site, true) r
      cross join lateral (select distinct e.channel_ref from public.obs_archive_expected_units(p_site, r.classe, r.mes) e) ch
     where not exists (select 1 from public.obs_archive_months mo where mo.site_id = p_site and mo.class = r.classe and mo.month = r.mes and (mo.detached_at is not null or mo.dropped_at is not null))
       and public.obs_archive_resumo_devido(p_site, r.classe, r.mes, ch.channel_ref);
    -- manifestos: unidades terminais, nenhum resumo devido e o mês sem selo (ou reaberto por unidade nova)
    select coalesce(jsonb_agg(jsonb_build_object('classe', r.classe, 'mes', to_char(r.mes, 'YYYY-MM')) order by r.classe, r.mes), '[]'::jsonb) into v_man
      from public.obs_archive_meses_devidos(p_site, true) r
     where exists (select 1 from public.obs_archive_months mo where mo.site_id = p_site and mo.class = r.classe and mo.month = r.mes and (mo.sealed_at is null or mo.unsealed_at is not null))
       and not exists (select 1 from public.obs_archive_months mo where mo.site_id = p_site and mo.class = r.classe and mo.month = r.mes and (mo.detached_at is not null or mo.dropped_at is not null))
       and not exists (select 1 from public.obs_archive_pending_units(p_site, r.classe, r.mes))
       and not exists (select 1 from public.obs_archive_expected_units(p_site, r.classe, r.mes) e where public.obs_archive_resumo_devido(p_site, r.classe, r.mes, e.channel_ref));
    -- aguardando_dono: unidade de canal removido ausente ou nunca recebida; unidade de mês fora do banco retirada do NAS. Com o b2_file_id_bom.
    select coalesce(jsonb_agg(q.item order by q.item->>'arquivo_id'), '[]'::jsonb) into v_dono from (
      select jsonb_build_object('arquivo_id', 'u:' || u.id, 'tipo', 'unidade', 'filho', pol.filho,
               'caminho', u.class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || to_char(u.month, 'YYYY-MM') || '.v' || u.version || '.csv.gz',
               'classe', u.class, 'tabela', u.table_name, 'canal', u.channel_ref, 'mes', to_char(u.month, 'YYYY-MM'), 'versao', u.version, 'coluna_controle', pol.control_column,
               'b2_file_id_bom', (select b.last_ok_file_id from public.obs_archive_b2_files b where b.site_id = p_site and b.arquivo_id = 'u:' || u.id)) as item
        from public.obs_archive_units u join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.parts = 1 and u.row_count > 0 and u.purged_at is null and u.lost_at is null and u.superseded_at is null
         and ((( exists (select 1 from public.obs_archive_channel_removals cr where cr.site_id = p_site and cr.channel_ref = u.channel_ref)
                 or not exists (select 1 from public.competitor_channels cc where cc.site_id = p_site and cc.id::text = u.channel_ref))
               and (u.nas_withdrawn_at is not null or u.received_at is null))
              or (u.nas_withdrawn_at is not null and exists (select 1 from public.obs_archive_months mo where mo.site_id = p_site and mo.class = u.class and mo.table_name = u.table_name and mo.month = u.month
                                                                and (mo.detached_at is not null or mo.dropped_at is not null))))
      union all
      select jsonb_build_object('arquivo_id', 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0'), 'tipo', 'parte', 'filho', pol.filho,
               'caminho', u.class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || to_char(u.month, 'YYYY-MM') || '.v' || u.version || '.p' || lpad(pt.part::text, 2, '0') || '.csv.gz',
               'classe', u.class, 'tabela', u.table_name, 'canal', u.channel_ref, 'mes', to_char(u.month, 'YYYY-MM'), 'versao', u.version, 'coluna_controle', pol.control_column,
               'b2_file_id_bom', (select b.last_ok_file_id from public.obs_archive_b2_files b where b.site_id = p_site and b.arquivo_id = 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0')))
        from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.parts > 1 and u.row_count > 0 and u.purged_at is null and u.lost_at is null and u.superseded_at is null
         and ((( exists (select 1 from public.obs_archive_channel_removals cr where cr.site_id = p_site and cr.channel_ref = u.channel_ref)
                 or not exists (select 1 from public.competitor_channels cc where cc.site_id = p_site and cc.id::text = u.channel_ref))
               and (pt.nas_withdrawn_at is not null or pt.received_at is null))
              or (pt.nas_withdrawn_at is not null and exists (select 1 from public.obs_archive_months mo where mo.site_id = p_site and mo.class = u.class and mo.table_name = u.table_name and mo.month = u.month
                                                                and (mo.detached_at is not null or mo.dropped_at is not null))))
    ) q(item);
    -- a_apagar: sobra em _recebendo/ de unidade expurgada nos últimos 30 dias e nunca recebida (Phil M4)
    select coalesce(jsonb_agg(q.item order by q.item->>'caminho'), '[]'::jsonb) into v_apagar from (
      select jsonb_build_object('filho', pol.filho, 'caminho', '_recebendo/' || u.class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || to_char(u.month, 'YYYY-MM') || '.v' || u.version || '.csv.gz') as item
        from public.obs_archive_units u join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.parts = 1 and u.purged_at is not null and u.purged_at > now() - interval '30 days' and u.received_at is null and u.row_count > 0
      union all
      select jsonb_build_object('filho', pol.filho, 'caminho', '_recebendo/' || u.class || '/canais/' || u.channel_ref || '/' || u.table_name || '/' || to_char(u.month, 'YYYY-MM') || '.v' || u.version || '.p' || lpad(pt.part::text, 2, '0') || '.csv.gz')
        from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.parts > 1 and u.purged_at is not null and u.purged_at > now() - interval '30 days' and pt.received_at is null
    ) q(item);
    v_verm := public.obs_archive_vermelhos(p_site);
  end if;

  -- reconferir: em qualquer modo, em páginas de 1.000 por arquivo_id; os demais campos só na primeira página
  select coalesce(jsonb_agg(q.item order by q.id collate "C"), '[]'::jsonb), count(*) filter (where q.rn > 1000), max(q.id collate "C") filter (where q.rn <= 1000)
    into v_page, v_depois, v_ultimo
    from (
      select c.arquivo_id as id, row_number() over (order by c.arquivo_id collate "C") as rn,
             jsonb_build_object('arquivo_id', c.arquivo_id, 'tipo', c.tipo, 'filho', c.filho, 'caminho', c.caminho, 'classe', c.classe, 'tabela', c.tabela, 'canal', c.canal,
                                'mes', to_char(c.mes, 'YYYY-MM'), 'versao', c.versao, 'coluna_controle', c.coluna_controle) as item
        from public.obs_archive_nas_cobertura(p_site) c
       where (p_cursor is null or c.arquivo_id collate "C" > p_cursor collate "C")
         and case
               when v_so_faltam then c.reported_at is null or c.reported_at < v_sweep.nas_back_at
               when v_completo then true
               else (not c.descartado) or c.reported_at is null or c.reported_at < now() - interval '14 days' end
    ) q where q.rn <= 1001;
  -- v_page acima contém até 1001 itens: corta no 1000 e devolve o cursor quando há mais
  select coalesce(jsonb_agg(e order by (e->>'arquivo_id') collate "C"), '[]'::jsonb) into v_rec
    from (select e from jsonb_array_elements(v_page) e order by (e->>'arquivo_id') collate "C" limit 1000) z(e);
  select to_char(min(m.month), 'YYYY-MM') into v_prim from public.obs_archive_months m where m.site_id = p_site and m.sealed_at is not null;
  return jsonb_build_object(
    'plano_id', gen_random_uuid(), 'gerado_em', now(), 'modo', case when v_completo then 'completo' else 'normal' end,
    'cursor_seguinte', case when jsonb_array_length(v_page) > 1000 then (v_rec -> 999)->>'arquivo_id' end,
    'primeira_selagem', v_prim, 'vermelhos', to_jsonb(v_verm), 'canario', jsonb_build_object('dia', v_hoje::text),
    'exportar', v_exp, 'resumos', v_res, 'manifestos', v_man, 'aguardando_dono', v_dono, 'a_apagar', v_apagar, 'reconferir', v_rec, 'prefixos_ausentes', '[]'::jsonb);
end $$;
revoke all on function public.obs_archive_plan(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.obs_archive_plan(uuid, boolean, text) to service_role;

-- M3B PARTE 6: a fatia 12a (02 §10.5, "O destino do arquivo na remoção de canal"; 02 §11.3)

create or replace function public.obs_archive_mark_purged(p_site uuid, p_ref text, p_actor uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.obs_archive_units set purged_at = now(), purged_by = p_actor, purge_ref = 'remocao:' || p_ref
   where site_id = p_site and channel_ref = p_ref and purged_at is null;
  get diagnostics n = row_count;
  update public.obs_archive_summaries set purged_at = now(), purged_by = p_actor, purge_ref = 'remocao:' || p_ref
   where site_id = p_site and channel_ref = p_ref and purged_at is null;
  -- itens da E9 de vídeo e de comentário do canal (D15): concluídos com a anotação; a condição 10 deixa de contá-los
  update public.competitor_removed_items set archive_pending = false, archive_note = 'canal apagado inteiro'
   where site_id = p_site and competitor_channel_id::text = p_ref and kind in ('video', 'comentario') and archive_pending;
  return n;
end $$;
revoke all on function public.obs_archive_mark_purged(uuid, text, uuid) from public, anon, authenticated, service_role;

-- 02 §10.5: o mês video_antigo em que só sobra unidade retirada (dropped_at) de canal que continua ganha dropped_at.
create or replace function public.obs_archive_video_antigo_months(p_site uuid, p_ref_removido text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with corrente as (
    select distinct on (u.table_name, u.channel_ref, u.month) u.*
      from public.obs_archive_units u
     where u.site_id = p_site and u.class = 'video_antigo'
     order by u.table_name, u.channel_ref, u.month, u.version desc
  ), vivas as (
    select c.* from corrente c
     where c.purged_at is null and c.channel_ref <> coalesce(p_ref_removido, '')
       and exists (select 1 from public.competitor_channels k where k.id::text = c.channel_ref and k.site_id = p_site)
       and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = c.channel_ref)
  ), meses as (
    select v.month from vivas v group by v.month having count(*) > 0 and bool_and(v.dropped_at is not null)
  )
  update public.obs_archive_months m set dropped_at = now()
    from meses x where m.site_id = p_site and m.class = 'video_antigo' and m.month = x.month and m.dropped_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.obs_archive_video_antigo_months(uuid, text) from public, anon, authenticated, service_role;

-- As imagens no Blob de um canal: as online (versões de vídeo) e as dos anexos do registro. Uma só conta para a remoção, a decisão e o diálogo.
create or replace function public.obs_archive_channel_blobs(p_site uuid, p_ref text)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.url), '{}'::text[]) from (
    select vv.thumb_blob_url as url from public.competitor_video_versions vv
      join public.competitor_videos v on v.id = vv.video_id
      join public.competitor_channels ch on ch.id = v.competitor_channel_id
     where ch.id::text = p_ref and ch.site_id = p_site and vv.thumb_blob_url is not null
    union
    select a.blob_url from public.obs_archive_unit_attachments a where a.site_id = p_site and a.channel_ref = p_ref and a.blob_url is not null
  ) x
$$;
revoke all on function public.obs_archive_channel_blobs(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.competitor_channel_remove(p_site uuid, p_channel uuid, p_decision text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ch record; v_ref text := p_channel::text; v_units integer; v_bytes bigint; v_first date; v_last date; v_blobs text[];
begin
  if p_decision is null or p_decision not in ('apagar', 'guardar') then raise exception 'decisao_invalida' using errcode = 'P0001'; end if;
  if p_via is null or p_via not in ('botao', 'fila', 'e10_export') then raise exception 'decisao_invalida' using errcode = 'P0001'; end if;   -- Yannis M9
  if p_decision = 'guardar' and p_via <> 'e10_export' then raise exception 'guardar_so_pela_e10' using errcode = 'P0001'; end if;
  if not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_direito' using errcode = 'P0001'; end if;
  select c.id, c.channel_id, c.channel_name into v_ch from public.competitor_channels c where c.id = p_channel and c.site_id = p_site for update;
  if not found then raise exception 'canal_nao_encontrado' using errcode = 'P0001'; end if;
  -- unidades do conjunto corrente (a maior versão por classe, tabela e mês; Phil I8); bytes de todas as versões (o que está no disco)
  select count(*) filter (where u.version = (select max(x.version) from public.obs_archive_units x where x.site_id = u.site_id and x.class = u.class
                                               and x.table_name = u.table_name and x.channel_ref = u.channel_ref and x.month = u.month)),
         coalesce(sum(u.file_bytes), 0), min(u.month), max(u.month)
    into v_units, v_bytes, v_first, v_last
    from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = v_ref and u.purged_at is null;
  v_blobs := public.obs_archive_channel_blobs(p_site, v_ref);
  insert into public.obs_archive_channel_removals (site_id, channel_ref, youtube_channel_id, name_at_removal, removed_at, removed_by, removed_via,
         archive_decision, decided_at, decided_by, units_at_removal, bytes_at_removal, first_month, last_month, blobs_pending, online_thumbs_known, declared_xid)
  values (p_site, v_ref, v_ch.channel_id, v_ch.channel_name, now(), p_actor, p_via, p_decision, now(), p_actor, v_units, v_bytes, v_first, v_last,
          v_blobs, true, pg_current_xact_id());
  if p_decision = 'apagar' then perform public.obs_archive_mark_purged(p_site, v_ref, p_actor); end if;
  perform public.obs_archive_video_antigo_months(p_site, v_ref);
  delete from public.competitor_channels where id = p_channel and site_id = p_site;   -- o gatilho da M6 (mês destacado) e o abaixo disparam aqui
  return jsonb_build_object('status', 'ok', 'decisao', p_decision, 'unidades', v_units, 'blobs_pendentes', coalesce(array_length(v_blobs, 1), 0));
end $$;
revoke all on function public.competitor_channel_remove(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.competitor_channel_remove(uuid, uuid, text, text, uuid) to service_role;

create or replace function public.obs_archive_destino_declarado() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Phil I1: a declaração é exigida SEMPRE, com ou sem unidade no registro. Antes da primeira unidade (28/11) nenhum canal tem uma, e um
  -- delete sem declaração apagaria as linhas do mês corrente sem rastro: o mês selaria sem o canal e nenhum vermelho apareceria.
  if tg_op = 'TRUNCATE' then
    if exists (select 1 from public.competitor_channels) then
      raise exception 'destino_do_arquivo_nao_declarado' using errcode = 'P0001', detail = 'truncate com canal cadastrado';
    end if;
    return null;
  end if;
  if not exists (select 1 from public.obs_archive_channel_removals r
                  where r.site_id = old.site_id and r.channel_ref = old.id::text and r.declared_xid = pg_current_xact_id()) then
    raise exception 'destino_do_arquivo_nao_declarado' using errcode = 'P0001', detail = old.id::text;
  end if;
  return old;
end $$;
revoke all on function public.obs_archive_destino_declarado() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_z_destino_declarado on public.competitor_channels;
create trigger obs_archive_z_destino_declarado before delete on public.competitor_channels for each row execute function public.obs_archive_destino_declarado();
drop trigger if exists obs_archive_z_truncate on public.competitor_channels;
create trigger obs_archive_z_truncate before truncate on public.competitor_channels for each statement execute function public.obs_archive_destino_declarado();

-- 02 l.206-207: purged_* só com remoção 'apagar' e lost_* só em canal removido, por gatilho, e não só por check (Phil I5, K3).
create or replace function public.obs_archive_mark_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.purged_at is not null and old.purged_at is null and not exists (select 1 from public.obs_archive_channel_removals r
       where r.site_id = new.site_id and r.channel_ref = new.channel_ref and r.archive_decision = 'apagar') then
    raise exception 'purga_sem_decisao_apagar' using errcode = 'P0001', detail = new.channel_ref;
  end if;
  if tg_table_name = 'obs_archive_units' and new.lost_at is not null and old.lost_at is null then
    if exists (select 1 from public.competitor_channels c where c.id::text = new.channel_ref) then
      raise exception 'perda_de_canal_que_existe' using errcode = 'P0001', detail = new.channel_ref;
    end if;
    if (new.lost_reason = 'nunca_recebida') <> (new.received_at is null) then
      raise exception 'perda_incoerente' using errcode = 'P0001', detail = new.lost_reason;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_mark_guard() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_mark_guard on public.obs_archive_units;
create trigger obs_archive_mark_guard before update of purged_at, lost_at on public.obs_archive_units for each row execute function public.obs_archive_mark_guard();
drop trigger if exists obs_archive_mark_guard on public.obs_archive_summaries;
create trigger obs_archive_mark_guard before update of purged_at on public.obs_archive_summaries for each row execute function public.obs_archive_mark_guard();

-- A decisão de apagar de um canal já removido: troca o `guardar` por `apagar`, ou cria a linha da vigia para o canal ausente sem destino (a UI é da M9).
-- Dois cliques ao mesmo tempo: um `ok`, o outro `ja_pedido`. A trava da linha da remoção pelo expurgo é `for share` (record_core).
create or replace function public.obs_archive_channel_removal_decide(p_site uuid, p_channel_ref text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_blobs text[];
begin
  if not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_direito' using errcode = 'P0001'; end if;
  if exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = p_channel_ref) then
    update public.obs_archive_channel_removals set archive_decision = 'apagar', decided_at = now(), decided_by = p_actor
     where site_id = p_site and channel_ref = p_channel_ref and archive_decision = 'guardar';
    get diagnostics v_n = row_count;
    if v_n = 0 then return jsonb_build_object('status', 'ja_pedido'); end if;
  else
    if not exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = p_channel_ref)
       or exists (select 1 from public.competitor_channels c where c.id::text = p_channel_ref) then
      raise exception 'canal_nao_encontrado' using errcode = 'P0001';
    end if;
    v_blobs := public.obs_archive_channel_blobs(p_site, p_channel_ref);
    insert into public.obs_archive_channel_removals (site_id, channel_ref, removed_via, archive_decision, decided_at, decided_by, blobs_pending, online_thumbs_known, thumbs_unknown_ack_at)
    values (p_site, p_channel_ref, 'vigia', 'apagar', now(), p_actor, v_blobs, false, now())
    on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n = 0 then return jsonb_build_object('status', 'ja_pedido'); end if;
  end if;
  perform public.obs_archive_mark_purged(p_site, p_channel_ref, p_actor);
  perform public.obs_archive_video_antigo_months(p_site, null);
  insert into public.audit_log (actor_user_id, action, resource_type, site_id, after_data)
  values (p_actor, 'obs_archive_channel_removal_decide', 'obs_archive_channel_removal', p_site, jsonb_build_object('channel_ref', p_channel_ref, 'decisao', 'apagar'));
  return jsonb_build_object('status', 'ok');
end $$;
revoke all on function public.obs_archive_channel_removal_decide(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_channel_removal_decide(uuid, text, uuid) to service_role;

-- A lista derivada dos canais removidos (02 §10.5): as remoções mais as unidades de canal ausente sem remoção (sem_destino). Nunca o nome do canal.
create or replace function public.obs_archive_removed_channel_list(p_site uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with ausentes as (
    select u.channel_ref from public.obs_archive_units u
     where u.site_id = p_site and not exists (select 1 from public.competitor_channels k where k.id::text = u.channel_ref and k.site_id = p_site)
     group by u.channel_ref
  ), refs as (
    select r.channel_ref from public.obs_archive_channel_removals r where r.site_id = p_site
    union select a.channel_ref from ausentes a
  ), cur as (
    select distinct on (u.class, u.table_name, u.month, u.channel_ref) u.channel_ref, u.class, u.month, u.row_count
      from public.obs_archive_units u
     where u.site_id = p_site and u.channel_ref in (select channel_ref from refs)
     order by u.class, u.table_name, u.month, u.channel_ref, u.version desc
  ), agg as (
    select c.channel_ref, min(c.month) filter (where c.row_count > 0) as primeiro, max(c.month) filter (where c.row_count > 0) as ultimo,
           count(distinct c.month) filter (where c.row_count > 0) as meses, coalesce(sum(c.row_count), 0) as registros, array_agg(distinct c.class order by c.class) as classes
      from cur c group by c.channel_ref
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'channel_ref', f.channel_ref,
      'estado', case when r.channel_ref is null then 'sem_destino'
                     when not exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = f.channel_ref)
                          and not exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = f.channel_ref) then 'sem_arquivo'
                     when r.archive_decision = 'guardar' then 'guardado'
                     else 'pedido' end,
      'decided_at', r.decided_at, 'nas_absent_at', r.nas_absent_at, 'b2_absent_at', r.b2_absent_at, 'snapshots_clear_on', r.snapshots_clear_on,
      'reappeared_at', r.reappeared_at, 'reappeared_count', coalesce(r.reappeared_count, 0), 'online_thumbs_known', r.online_thumbs_known,
      'thumbs_unknown_ack_at', r.thumbs_unknown_ack_at, 'blobs_pendentes', coalesce(array_length(r.blobs_pending, 1), 0), 'youtube_channel_id', r.youtube_channel_id,
      'primeiro_mes', case when r.channel_ref is null then to_char(a.primeiro, 'YYYY-MM') end, 'ultimo_mes', case when r.channel_ref is null then to_char(a.ultimo, 'YYYY-MM') end,
      'meses', case when r.channel_ref is null then coalesce(a.meses, 0) end, 'registros', case when r.channel_ref is null then coalesce(a.registros, 0) end,
      'classes', case when r.channel_ref is null then to_jsonb(coalesce(a.classes, '{}'::text[])) end
    ) order by f.channel_ref), '[]'::jsonb)
    from refs f
    left join public.obs_archive_channel_removals r on r.site_id = p_site and r.channel_ref = f.channel_ref
    left join agg a on a.channel_ref = f.channel_ref
$$;
revoke all on function public.obs_archive_removed_channel_list(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_removed_channel_list(uuid) to service_role;

-- P55: o que a restauração pergunta de um canal. Existe: não removido. Ausente com remoção: a decisão. Ausente sem remoção: sem destino.
create or replace function public.obs_archive_channel_is_removed(p_site uuid, p_channel_ref text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_dec text;
begin
  if exists (select 1 from public.competitor_channels c where c.id::text = p_channel_ref and c.site_id = p_site) then
    return jsonb_build_object('removido', false, 'decisao', null, 'sem_destino', false);
  end if;
  select r.archive_decision into v_dec from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = p_channel_ref;
  if found then return jsonb_build_object('removido', true, 'decisao', v_dec, 'sem_destino', false); end if;
  return jsonb_build_object('removido', true, 'decisao', null, 'sem_destino', true);
end $$;
revoke all on function public.obs_archive_channel_is_removed(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_channel_is_removed(uuid, text) to service_role;

-- A vigia da remoção (item 160): c1 órfãos sem remoção, c2 remoção com canal ainda existente, c3 apagar com unidade ou resumo sem purged_at, c4 concluído com o prefixo de volta.
create or replace function public.obs_archive_vigia_remocao(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'c1', (select count(distinct u.channel_ref) from public.obs_archive_units u
            where u.site_id = p_site and not exists (select 1 from public.competitor_channels k where k.id::text = u.channel_ref and k.site_id = p_site)
              and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = u.channel_ref)),
    'c2', (select count(*) from public.obs_archive_channel_removals r where r.site_id = p_site and exists (select 1 from public.competitor_channels k where k.id::text = r.channel_ref and k.site_id = p_site)),
    'c3', (select count(*) from public.obs_archive_channel_removals r where r.site_id = p_site and r.archive_decision = 'apagar'
            and (exists (select 1 from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = r.channel_ref and u.purged_at is null)
                 or exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = r.channel_ref and s.purged_at is null))),
    'c4', (select count(*) from public.obs_archive_channel_removals r where r.site_id = p_site and r.completed_at is not null and r.reappeared_at > r.completed_at))
$$;
revoke all on function public.obs_archive_vigia_remocao(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_vigia_remocao(uuid) to service_role;

-- Os vermelhos da remoção, lidos por obs_archive_vermelhos (parte 5): canais sem destino e cada consulta da vigia com valor.
create or replace function public.obs_archive_vermelhos_remocao(p_site uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb := public.obs_archive_vigia_remocao(p_site); r text[] := '{}';
begin
  if (v->>'c1')::int > 0 then r := array_append(r, format('%s canais removidos sem destino do arquivo', v->>'c1')); end if;
  if (v->>'c2')::int > 0 then r := array_append(r, format('vigia da remoção: consulta 2 com %s', v->>'c2')); end if;
  if (v->>'c3')::int > 0 then r := array_append(r, format('vigia da remoção: consulta 3 com %s', v->>'c3')); end if;
  if (v->>'c4')::int > 0 then r := array_append(r, format('vigia da remoção: consulta 4 com %s', v->>'c4')); end if;
  return r;
end $$;
revoke all on function public.obs_archive_vermelhos_remocao(uuid) from public, anon, authenticated, service_role;

-- O que o diálogo de remover diz (Tarefa 12): o conjunto corrente do canal, o que já está fora do banco, os vídeos retirados e as imagens do Blob.
create or replace function public.obs_archive_channel_archive_impact(p_site uuid, p_channel uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ref text := p_channel::text; j jsonb;
begin
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel and c.site_id = p_site) then
    return jsonb_build_object('status', 'nao_encontrado');
  end if;
  with cur as (
    select distinct on (u.class, u.table_name, u.month) u.class, u.table_name, u.month, u.row_count
      from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = v_ref and u.purged_at is null
     order by u.class, u.table_name, u.month, u.version desc
  ), cheios as (select * from cur where row_count > 0),
  fora as (
    select c.month from cheios c where exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = c.class and m.table_name = c.table_name and m.month = c.month
                                                 and (m.dropped_at is not null or m.detached_at is not null))
  ), vr as (
    select v.published_at from public.competitor_videos v where v.competitor_channel_id = p_channel and v.archive_dropped_at is not null
  )
  select jsonb_build_object('status', 'ok',
      'meses', (select count(distinct month) from cheios), 'de', (select to_char(min(month), 'YYYY-MM') from cheios), 'ate', (select to_char(max(month), 'YYYY-MM') from cheios),
      'registros', (select coalesce(sum(row_count), 0) from cheios),
      'fora_do_banco', jsonb_build_object('meses', (select count(distinct month) from fora), 'de', (select to_char(min(month), 'YYYY-MM') from fora), 'ate', (select to_char(max(month), 'YYYY-MM') from fora)),
      'videos_retirados', jsonb_build_object('n', (select count(*) from vr), 'de', (select min(published_at)::date::text from vr), 'ate', (select max(published_at)::date::text from vr)),
      'imagens_blob', coalesce(array_length(public.obs_archive_channel_blobs(p_site, v_ref), 1), 0))
    into j;
  return j;
end $$;
revoke all on function public.obs_archive_channel_archive_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_channel_archive_impact(uuid, uuid) to service_role;

-- Yannis 3 (14/10): a E10 apaga canal com competitor_channel_remove_archived, que faz o delete sem declarar. Com o gatilho exigindo a
-- declaração SEMPRE (Phil I1), ela quebraria no dia da migration. Aqui ela passa a declarar ('guardar', 'e10_export', xid desta transação)
-- antes do delete. Parte do corpo instalado DEPOIS da M2 (bloco 11b: pg_partition_tree; a regra 71 de migrations-leitura o exige e este
-- bloco o mantém), com a guarda de md5 do corpo conhecido, no molde do 11b. Ausente: nada (a E10 não está neste banco). Já com a
-- declaração: nada. Sem a M2 (sem pg_partition_tree) ou corpo diferente do conhecido: recusa, nunca troca às cegas.
-- Função da A5: o aviso está em .superpowers/sdd/manutencao-nas/aviso-a5-remove-archived-m3b.md.
do $$
declare
  v_oid  oid := pg_catalog.to_regprocedure('public.competitor_channel_remove_archived(uuid,uuid,uuid)');
  v_src  text;
  v_def  text;
  v_anc  text := 'delete from public.competitor_channels c where c.id = p_channel and c.site_id = p_site;';
  v_decl text;
begin
  if v_oid is null then return; end if;
  select p.prosrc into v_src from pg_catalog.pg_proc p where p.oid = v_oid;
  if v_src ~ 'obs_archive_channel_removals' then return; end if;
  if v_src !~ 'pg_partition_tree' then
    raise exception 'M3b:competitor_channel_remove_archived_sem_m2' using errcode = 'P0001',
      detail = 'o corpo instalado não tem a guarda por folhas do bloco 11b: aplicar a M2 antes da M3b';
  end if;
  if pg_catalog.md5(v_src) <> '96fccc5423bdf22ef680692adb5f99cd' then
    raise exception 'M3b:competitor_channel_remove_archived_divergente' using errcode = 'P0001',
      detail = 'o corpo instalado não é o do bloco 11b da M2: copiar o corpo instalado com a declaração para esta migration';
  end if;
  v_def := pg_catalog.pg_get_functiondef(v_oid);
  if (pg_catalog.length(v_def) - pg_catalog.length(pg_catalog.replace(v_def, v_anc, ''))) <> pg_catalog.length(v_anc) then
    raise exception 'M3b:competitor_channel_remove_archived_ancora' using errcode = 'P0001', detail = 'o delete do canal não aparece exatamente uma vez';
  end if;
  v_decl := $d$
  declare v_u integer; v_by bigint; v_f date; v_l date;
  begin
    -- M3b (Yannis 3): declara o destino do arquivo na mesma transação do delete; o gatilho obs_archive_z_destino_declarado confere o xid
    select count(*) filter (where u.version = (select max(x.version) from public.obs_archive_units x where x.site_id = u.site_id and x.class = u.class
                                                 and x.table_name = u.table_name and x.channel_ref = u.channel_ref and x.month = u.month)),
           coalesce(sum(u.file_bytes), 0), min(u.month), max(u.month)
      into v_u, v_by, v_f, v_l
      from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = p_channel::text and u.purged_at is null;
    insert into public.obs_archive_channel_removals (site_id, channel_ref, youtube_channel_id, name_at_removal, removed_at, removed_by, removed_via,
           archive_decision, decided_at, decided_by, units_at_removal, bytes_at_removal, first_month, last_month, blobs_pending, online_thumbs_known, declared_xid)
    values (p_site, p_channel::text, v_c.channel_id, v_c.channel_name, now(), p_actor, 'e10_export', 'guardar', now(), p_actor, v_u, v_by, v_f, v_l,
            public.obs_archive_channel_blobs(p_site, p_channel::text), true, pg_current_xact_id());
  end;
  $d$;
  execute pg_catalog.replace(v_def, v_anc, v_decl || v_anc);
end $$;

-- M3B PARTE 7: pendências do dono (emenda de 14/10, peça 7; contrato C12). Na M3b só emite tempo 'sem_comando';
-- a M9 recria esta função com os outros tempos (copiar, conferir_b2, apagar_antigas, bloqueado) e versao 2.
create or replace function public.obs_archive_owner_pending(p_site uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_site  uuid := p_site;
  v_lista jsonb;
  v_itens jsonb;
begin
  if v_site is null then   -- o comando do Mac não sabe o site: o ÚNICO site que tem canal, remoção ou unidade arquivada no observatório, ou erro (nunca "lista vazia"). Phil I2: o hub é multi-site, linhas em `sites` não contam.
    -- Phil N2 (2ª rodada): o site vem de canal, de remoção ou de unidade arquivada: com todos os canais removidos, a pendência de um canal removido continua achando o site.
    if (select count(*) from (select c.site_id from public.competitor_channels c union select r.site_id from public.obs_archive_channel_removals r
                              union select u.site_id from public.obs_archive_units u) x) <> 1 then raise exception 'site_ambiguo' using errcode = 'P0001'; end if;
    select c.site_id into v_site from (select c0.site_id from public.competitor_channels c0 union select r.site_id from public.obs_archive_channel_removals r
                                       union select u.site_id from public.obs_archive_units u) c;
  end if;
  v_lista := public.obs_archive_removed_channel_list(v_site);   -- erro sobe (nunca lista vazia)
  if v_lista is null or jsonb_typeof(v_lista) <> 'array' then raise exception 'lista_de_remocao_ilegivel' using errcode = 'P0001'; end if;
  with canal as (
    select 'canal:' || (r->>'channel_ref') as item_id, 'canal'::text as kind,
           greatest((r->>'decided_at')::timestamptz, (r->>'reappeared_at')::timestamptz) as desde,
           nullif(r->>'channel_ref', '') as channel_ref, nullif(r->>'youtube_channel_id', '') as youtube_id
      from jsonb_array_elements(v_lista) r
     where r->>'estado' = 'pedido'
  ), item as (
    select 'item:' || i.id::text, i.kind, i.decided_at, i.competitor_channel_id::text, i.youtube_id
      from public.competitor_removed_items i
     where i.site_id = v_site and i.archive_pending and i.kind in ('video', 'comentario')
  ), tudo as (select * from canal union all select * from item)
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', item_id, 'kind', kind, 'tempo', 'sem_comando', 'desde', desde, 'mes', null,
           'channel_ref', channel_ref, 'youtube_id', youtube_id, 'marcado_rodado_em', null,
           'apagar', '[]'::jsonb, 'b2_nomes', '[]'::jsonb) order by desde, item_id), '[]'::jsonb)
    into v_itens from tudo;
  return jsonb_build_object('versao', 1, 'lido_em', now(), 'total', jsonb_array_length(v_itens), 'itens', v_itens);
end $$;
revoke all on function public.obs_archive_owner_pending(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_owner_pending(uuid) to service_role, postgres;

-- Sem papel de banco (emenda 14/10 noite: rota com chave): o Mac lê esta função por GET /api/pipeline/archive/pending (chave archive_owner).
