-- Newsletter CMS Overhaul — add columns referenced by CMS pages
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS max_retries int NOT NULL DEFAULT 3;
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS total_subscribers int NOT NULL DEFAULT 0;
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS web_archive_enabled boolean NOT NULL DEFAULT true;
