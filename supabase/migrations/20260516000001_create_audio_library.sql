-- ============================================================
-- Audio Library: audio_assets, audio_asset_usage, audio_import_log
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. audio_assets
-- ────────────────────────────────────────────────────────────
create table if not exists public.audio_assets (
  id                uuid        primary key default gen_random_uuid(),
  site_id           uuid        not null references public.sites(id),
  asset_id          text        not null,
  original_filename text        not null,
  renamed_to        text,
  sha256            text,
  type              text        not null check (type in ('music', 'sfx')),
  source            text        not null default 'artlist',
  category          text,
  subcategory       text,
  genre             text,
  artist            text,
  track_name        text,
  artlist_url       text,
  duration_seconds  numeric,
  bpm               integer,
  music_key         text,
  time_signature    text        default '4/4',
  energy            integer     check (energy between 1 and 5),
  tempo_feel        text,
  tags              text[]      not null default '{}',
  mood              text[]      not null default '{}',
  instruments       text[]      not null default '{}',
  use_cases         text[]      not null default '{}',
  reuse_scenarios   text[]      not null default '{}',
  reusable          boolean     not null default true,
  status            text        not null default 'downloaded'
                                check (status in ('downloaded', 'pending', 'retired')),
  priority          text        check (priority in ('essential', 'nice_to_have', 'optional')),
  metadata          jsonb       not null default '{}',
  search_vector     tsvector,
  version           integer     not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_audio_assets_site_asset unique (site_id, asset_id),
  constraint uq_audio_assets_site_sha   unique (site_id, sha256)
);

-- Indexes
create index if not exists idx_audio_assets_site    on public.audio_assets (site_id);
create index if not exists idx_audio_assets_type    on public.audio_assets (site_id, type);
create index if not exists idx_audio_assets_status  on public.audio_assets (site_id, status);
create index if not exists idx_audio_assets_energy  on public.audio_assets (site_id, energy);
create index if not exists idx_audio_assets_bpm     on public.audio_assets (site_id, bpm);
create index if not exists idx_audio_assets_tags    on public.audio_assets using gin (tags);
create index if not exists idx_audio_assets_mood    on public.audio_assets using gin (mood);
create index if not exists idx_audio_assets_instruments on public.audio_assets using gin (instruments);
create index if not exists idx_audio_assets_use_cases   on public.audio_assets using gin (use_cases);
create index if not exists idx_audio_assets_reuse   on public.audio_assets using gin (reuse_scenarios);
create index if not exists idx_audio_assets_search  on public.audio_assets using gin (search_vector);
create index if not exists idx_audio_assets_metadata on public.audio_assets using gin (metadata jsonb_path_ops);

-- Search vector trigger (trigger-based, not generated column)
CREATE OR REPLACE FUNCTION public.audio_asset_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.track_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.artist, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.genre, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_audio_assets_search_vector ON public.audio_assets;
CREATE TRIGGER tg_audio_assets_search_vector
  BEFORE INSERT OR UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.audio_asset_search_vector_update();

-- Version increment trigger
CREATE OR REPLACE FUNCTION public.audio_asset_version_increment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version THEN
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_audio_assets_version ON public.audio_assets;
CREATE TRIGGER tg_audio_assets_version
  BEFORE UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.audio_asset_version_increment();

-- updated_at trigger (reuses shared function)
DROP TRIGGER IF EXISTS tg_audio_assets_updated_at ON public.audio_assets;
CREATE TRIGGER tg_audio_assets_updated_at
  BEFORE UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
alter table public.audio_assets enable row level security;

DROP POLICY IF EXISTS "audio_assets: read via can_view_site" ON public.audio_assets;
CREATE POLICY "audio_assets: read via can_view_site"
  ON public.audio_assets FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "audio_assets: write via can_edit_site" ON public.audio_assets;
CREATE POLICY "audio_assets: write via can_edit_site"
  ON public.audio_assets FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 2. audio_asset_usage
-- ────────────────────────────────────────────────────────────
create table if not exists public.audio_asset_usage (
  id               uuid        primary key default gen_random_uuid(),
  audio_asset_id   uuid        not null references public.audio_assets(id) on delete cascade,
  pipeline_item_id uuid        not null references public.content_pipeline(id) on delete cascade,
  site_id          uuid        not null references public.sites(id),
  scene_number     integer,
  usage_type       text        not null default 'background'
                               check (usage_type in ('background', 'sfx', 'transition', 'intro', 'outro')),
  notes            text,
  created_at       timestamptz not null default now(),
  constraint uq_audio_usage unique (audio_asset_id, pipeline_item_id, scene_number)
);

create index if not exists idx_audio_usage_asset    on public.audio_asset_usage (audio_asset_id);
create index if not exists idx_audio_usage_pipeline on public.audio_asset_usage (pipeline_item_id);
create index if not exists idx_audio_usage_site     on public.audio_asset_usage (site_id);

alter table public.audio_asset_usage enable row level security;

DROP POLICY IF EXISTS "audio_asset_usage: read via can_view_site" ON public.audio_asset_usage;
CREATE POLICY "audio_asset_usage: read via can_view_site"
  ON public.audio_asset_usage FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "audio_asset_usage: write via can_edit_site" ON public.audio_asset_usage;
CREATE POLICY "audio_asset_usage: write via can_edit_site"
  ON public.audio_asset_usage FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 3. audio_import_log
-- ────────────────────────────────────────────────────────────
create table if not exists public.audio_import_log (
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

create index if not exists idx_audio_import_site on public.audio_import_log (site_id);

alter table public.audio_import_log enable row level security;

DROP POLICY IF EXISTS "audio_import_log: read via can_view_site" ON public.audio_import_log;
CREATE POLICY "audio_import_log: read via can_view_site"
  ON public.audio_import_log FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "audio_import_log: write via can_edit_site" ON public.audio_import_log;
CREATE POLICY "audio_import_log: write via can_edit_site"
  ON public.audio_import_log FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
