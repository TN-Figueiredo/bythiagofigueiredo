-- Newsletter CMS Overhaul — Migration 3: TipTap document model storage
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS content_json jsonb;
