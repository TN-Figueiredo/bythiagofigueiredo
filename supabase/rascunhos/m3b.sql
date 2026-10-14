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
  for v_row in select m.table_name from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.month = p_month order by m.table_name loop
    select count(*), count(*) filter (where c.row_count = 0), coalesce(sum(c.row_count), 0) into v_total, v_vazias, v_linhas
      from public.obs_archive_current_units(p_site, p_class, p_month) c where c.table_name = v_row.table_name and c.purged_at is null;
    v_kind := case when v_total = 0 then 'sem_dado_a_guardar' when v_vazias = v_total then 'vazio_conferido' else 'com_dado' end;
    -- dias de São Paulo com linha, contados na tabela online pela mesma regra do leitor, na hora do selo
    v_dias := '{}'; v_dm := 0;
    if v_kind = 'com_dado' and exists (select 1 from pg_catalog.pg_class where oid = pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(v_row.table_name))) then
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
           days_measured = v_dm, days_in_month = (v_seg - p_month), sealed_kind = v_kind, unsealed_at = null, unsealed_reason = null
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

create or replace function public.obs_archive_summary_rows(p_site uuid, p_class text, p_channel uuid, p_month date)
returns jsonb language plpgsql security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  v_ch text := p_channel::text; v_pend text; v_hashes jsonb; v_last record; v_ver integer; v_vazio boolean;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
  v_seg date := (p_month + interval '1 month')::date;
  u record; x record; v_src record; v_canal jsonb := '[]'; v_video jsonb := '[]'; v_c jsonb; v_v jsonb; v_mes text := to_char(p_month, 'YYYY-MM');
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
      select * into x from public.obs_archive_table_exprs(u.table_name);
      select * into v_src from public.obs_archive_unit_source(p_class, u.table_name);
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
        into v_c, v_v using p_site, p_channel, p_month, v_ini, v_fim, v_seg, (v_seg - p_month)::text, v_ch, u.table_name, v_mes, u.hash_conteudo, v_ver::text;
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
