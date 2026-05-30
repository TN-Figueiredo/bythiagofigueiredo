-- =============================================================================
-- MIGRATION: Multi QR Cards per Link
-- Allows N QR card designs per tracked link (different channels/formats)
-- =============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.link_qr_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'QR Card',
  composition jsonb,
  config jsonb NOT NULL DEFAULT '{}',
  storage_path text,
  preview_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_link_qr_cards_link ON link_qr_cards (link_id);
CREATE INDEX IF NOT EXISTS idx_link_qr_cards_site ON link_qr_cards (site_id);

-- 3. updated_at trigger
DROP TRIGGER IF EXISTS set_link_qr_cards_updated_at ON public.link_qr_cards;
CREATE TRIGGER set_link_qr_cards_updated_at
  BEFORE UPDATE ON public.link_qr_cards
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. RLS
ALTER TABLE public.link_qr_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "link_qr_cards_staff_read" ON public.link_qr_cards;
CREATE POLICY "link_qr_cards_staff_read"
  ON public.link_qr_cards
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "link_qr_cards_staff_write" ON public.link_qr_cards;
CREATE POLICY "link_qr_cards_staff_write"
  ON public.link_qr_cards
  FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- 5. Migrate existing QR data from tracked_links
INSERT INTO link_qr_cards (link_id, site_id, name, composition, config, storage_path)
SELECT id, site_id, COALESCE(NULLIF(title, ''), '/' || code),
       qr_card_composition,
       COALESCE(qr_config, '{}'),
       qr_storage_path
FROM tracked_links t
WHERE (qr_card_composition IS NOT NULL OR (has_qr = true AND qr_config IS NOT NULL))
  AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM link_qr_cards c WHERE c.link_id = t.id);

COMMENT ON TABLE public.link_qr_cards IS 'Multiple QR card designs per tracked link (channels: YouTube, newsletter, print, etc.)';
