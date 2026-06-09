-- =============================================================================
-- MIGRATION: video_recording_status
-- Durable per-beat, per-language recording ledger for the video pipeline.
-- Status anchored on stable beat ids (NOT roteiro JSONB) so the Cowork's
-- wholesale roteiro overwrites can never leave a silent stale "gravada".
-- Keyed on (pipeline_id, lang, beat_id); last-write-wins per row.
-- =============================================================================

-- ── Table ──────────────────────────────────────────────────────────
create table if not exists public.video_recording_status (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites(id) on delete cascade,
  pipeline_id  uuid not null references public.content_pipeline(id) on delete cascade,
  lang         text not null check (lang in ('pt','en')),
  beat_id      text not null,
  status       text not null default 'pendente' check (status in ('pendente','gravada','refazer')),
  retake_note  text check (retake_note is null or length(retake_note) <= 500),
  beat_name    text,
  content_hash text,
  source       text check (source is null or source in ('user','cowork','cron')),
  updated_at   timestamptz not null default now(),
  modified_by  uuid references auth.users(id) on delete set null,
  unique (pipeline_id, lang, beat_id)
);

create index if not exists idx_vrs_lookup
  on public.video_recording_status (site_id, pipeline_id, lang);

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.video_recording_status enable row level security;

drop policy if exists video_recording_status_select on public.video_recording_status;
create policy video_recording_status_select
  on public.video_recording_status for select to authenticated
  using (public.can_view_site(site_id));

drop policy if exists video_recording_status_insert on public.video_recording_status;
create policy video_recording_status_insert
  on public.video_recording_status for insert to authenticated
  with check (public.can_edit_site(site_id));

drop policy if exists video_recording_status_update on public.video_recording_status;
create policy video_recording_status_update
  on public.video_recording_status for update to authenticated
  using (public.can_edit_site(site_id))
  with check (public.can_edit_site(site_id));

drop policy if exists video_recording_status_delete on public.video_recording_status;
create policy video_recording_status_delete
  on public.video_recording_status for delete to authenticated
  using (public.can_edit_site(site_id));

-- ── Trigger (auto-update updated_at) ───────────────────────────────
drop trigger if exists tg_video_recording_status_updated_at on public.video_recording_status;
create trigger tg_video_recording_status_updated_at
  before update on public.video_recording_status
  for each row execute function public.tg_set_updated_at();
