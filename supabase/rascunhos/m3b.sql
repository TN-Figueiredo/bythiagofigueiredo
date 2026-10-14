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
  unsealed_at timestamptz, unsealed_reason text check (unsealed_reason in ('conteudo_mudou', 'mudou_no_destaque', 'unidade_nova')),
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
