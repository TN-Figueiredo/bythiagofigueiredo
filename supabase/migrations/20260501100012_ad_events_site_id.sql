-- Migration: ad_events_site_id
ALTER TABLE public.ad_events
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

UPDATE public.ad_events ae
SET site_id = s.id
FROM public.sites s
WHERE s.slug = ae.app_id
  AND ae.site_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ad_events_site_id_created
  ON public.ad_events (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_events_site_slot
  ON public.ad_events (site_id, slot_id, event_type, created_at DESC);

COMMENT ON COLUMN public.ad_events.site_id IS
  'Site UUID (FK → sites.id). Backfilled from app_id on migration. Preferred over app_id for new queries.';
