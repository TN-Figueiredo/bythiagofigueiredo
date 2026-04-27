-- Newsletter CMS Overhaul — Migration 2: RLS for newsletter_types + site_id

-- Enable RLS (idempotent)
ALTER TABLE newsletter_types ENABLE ROW LEVEL SECURITY;

-- Staff can manage types
DROP POLICY IF EXISTS "staff_manage_types" ON newsletter_types;
CREATE POLICY "staff_manage_types" ON newsletter_types
  FOR ALL USING (public.is_member_staff())
  WITH CHECK (public.is_member_staff());

-- Public can read active types (for subscription pages)
DROP POLICY IF EXISTS "public_read_active_types" ON newsletter_types;
CREATE POLICY "public_read_active_types" ON newsletter_types
  FOR SELECT USING (active = true);

-- Add site_id for multi-site scoping
ALTER TABLE newsletter_types ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id);

-- Backfill existing types with master site
UPDATE newsletter_types
SET site_id = (SELECT id FROM sites WHERE slug = 'bythiagofigueiredo')
WHERE site_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE newsletter_types ALTER COLUMN site_id SET NOT NULL;
