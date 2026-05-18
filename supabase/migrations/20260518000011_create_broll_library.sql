-- ============================================================
-- B-Roll Library: broll_library, broll_library_usage, broll_import_log
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. broll_library
-- ────────────────────────────────────────────────────────────
create table if not exists public.broll_library (
  id                uuid        primary key default gen_random_uuid(),
  site_id           uuid        not null references public.sites(id) on delete cascade,
  asset_id          text        not null,
  original_filename text        not null,
  renamed_to        text,
  sha256            text,
  file_size_bytes   bigint,
  type              text        not null default 'footage'
                                check (type in ('footage','photo','screen_recording','stock','graphic','animation')),
  source            text        not null default 'local',
  source_type       text        not null default 'pessoal'
                                check (source_type in ('pessoal', 'generico')),
  category          text,
  subcategory       text,
  location          text,
  description       text,
  tags              text[]      not null default '{}',
  codec             text,
  fps               smallint,
  resolution        text        not null default '1080p',
  width             int,
  height            int,
  duration_seconds  real,
  bitrate_kbps      int,
  has_audio         boolean     not null default false,
  color_profile     text,
  storage_url       text,
  thumbnail_url     text,
  proxy_url         text,
  reusable          boolean     not null default true,
  status            text        not null default 'available'
                                check (status in ('available', 'pending', 'retired')),
  captured_at       timestamptz,
  metadata          jsonb       not null default '{}',
  search_vector     tsvector,
  version           int         not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_broll_library_site_asset unique (site_id, asset_id),
  constraint uq_broll_library_site_sha   unique (site_id, sha256)
);

-- Indexes
create index if not exists idx_broll_library_site       on public.broll_library (site_id);
create index if not exists idx_broll_library_type       on public.broll_library (site_id, type);
create index if not exists idx_broll_library_status     on public.broll_library (site_id, status);
create index if not exists idx_broll_library_source     on public.broll_library (site_id, source_type);
create index if not exists idx_broll_library_resolution on public.broll_library (site_id, resolution);
create index if not exists idx_broll_library_tags       on public.broll_library using gin (tags);
create index if not exists idx_broll_library_search     on public.broll_library using gin (search_vector);
create index if not exists idx_broll_library_metadata   on public.broll_library using gin (metadata jsonb_path_ops);
create index if not exists idx_broll_library_captured   on public.broll_library (site_id, captured_at desc nulls last);

-- Search vector trigger
CREATE OR REPLACE FUNCTION public.broll_library_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.original_filename, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.location, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_broll_library_search_vector ON public.broll_library;
CREATE TRIGGER tg_broll_library_search_vector
  BEFORE INSERT OR UPDATE ON public.broll_library
  FOR EACH ROW EXECUTE FUNCTION public.broll_library_search_vector_update();

-- Version increment trigger
CREATE OR REPLACE FUNCTION public.broll_library_version_increment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version THEN
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_broll_library_version ON public.broll_library;
CREATE TRIGGER tg_broll_library_version
  BEFORE UPDATE ON public.broll_library
  FOR EACH ROW EXECUTE FUNCTION public.broll_library_version_increment();

-- updated_at trigger (reuses shared function)
DROP TRIGGER IF EXISTS tg_broll_library_updated_at ON public.broll_library;
CREATE TRIGGER tg_broll_library_updated_at
  BEFORE UPDATE ON public.broll_library
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
alter table public.broll_library enable row level security;

DROP POLICY IF EXISTS "broll_library: read via can_view_site" ON public.broll_library;
CREATE POLICY "broll_library: read via can_view_site"
  ON public.broll_library FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "broll_library: write via can_edit_site" ON public.broll_library;
CREATE POLICY "broll_library: write via can_edit_site"
  ON public.broll_library FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 2. broll_library_usage (join table: broll <-> pipeline item)
-- ────────────────────────────────────────────────────────────
create table if not exists public.broll_library_usage (
  id               uuid        primary key default gen_random_uuid(),
  broll_asset_id   uuid        not null references public.broll_library(id) on delete cascade,
  pipeline_item_id uuid        not null references public.content_pipeline(id) on delete cascade,
  site_id          uuid        not null references public.sites(id),
  beat_index       integer,
  timecode_in      text,
  timecode_out     text,
  usage_type       text        not null default 'cutaway'
                               check (usage_type in ('cutaway','overlay','background','transition','intro','outro')),
  notes            text,
  created_at       timestamptz not null default now(),
  constraint uq_broll_usage unique (broll_asset_id, pipeline_item_id, beat_index)
);

create index if not exists idx_broll_usage_asset    on public.broll_library_usage (broll_asset_id);
create index if not exists idx_broll_usage_pipeline on public.broll_library_usage (pipeline_item_id);
create index if not exists idx_broll_usage_site     on public.broll_library_usage (site_id);

alter table public.broll_library_usage enable row level security;

DROP POLICY IF EXISTS "broll_library_usage: read via can_view_site" ON public.broll_library_usage;
CREATE POLICY "broll_library_usage: read via can_view_site"
  ON public.broll_library_usage FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "broll_library_usage: write via can_edit_site" ON public.broll_library_usage;
CREATE POLICY "broll_library_usage: write via can_edit_site"
  ON public.broll_library_usage FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 3. broll_import_log
-- ────────────────────────────────────────────────────────────
create table if not exists public.broll_import_log (
  id             uuid        primary key default gen_random_uuid(),
  site_id        uuid        not null references public.sites(id),
  source         text        not null,
  status         text        not null,
  total_items    integer     not null,
  created_count  integer     not null default 0,
  updated_count  integer     not null default 0,
  skipped_count  integer     not null default 0,
  error_count    integer     not null default 0,
  errors         jsonb       default '[]',
  diff_log       jsonb       default '[]',
  schema_version text,
  imported_by    text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_broll_import_site on public.broll_import_log (site_id);

alter table public.broll_import_log enable row level security;

DROP POLICY IF EXISTS "broll_import_log: read via can_view_site" ON public.broll_import_log;
CREATE POLICY "broll_import_log: read via can_view_site"
  ON public.broll_import_log FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "broll_import_log: write via can_edit_site" ON public.broll_import_log;
CREATE POLICY "broll_import_log: write via can_edit_site"
  ON public.broll_import_log FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
