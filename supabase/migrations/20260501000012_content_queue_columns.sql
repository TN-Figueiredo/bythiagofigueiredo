-- 20260421000003_content_queue_columns.sql
-- Add content queue support: post_status enum extension, queue columns on blog_posts,
-- cadence + sender columns on newsletter_types

-- ALTER TYPE ADD VALUE cannot run inside a transaction
-- supabase:disable-transaction

-- ============================================================
-- 1. Extend post_status enum with 'ready' and 'queued'
-- ============================================================
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'draft';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'queued' AFTER 'ready';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'draft';

-- ============================================================
-- 2. blog_posts: add queue columns
-- ============================================================
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS queue_position int,
  ADD COLUMN IF NOT EXISTS slot_date date;

-- ============================================================
-- 3. newsletter_types: cadence + sender columns
-- ============================================================

ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS cadence_days int NOT NULL DEFAULT 7;

UPDATE public.newsletter_types SET cadence_days = CASE
  WHEN cadence = 'weekly' THEN 7
  WHEN cadence = 'biweekly' THEN 14
  WHEN cadence = 'monthly' THEN 30
  ELSE 7
END WHERE cadence IS NOT NULL;

ALTER TABLE public.newsletter_types
  DROP COLUMN IF EXISTS cadence;

ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS preferred_send_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS cadence_start_date date,
  ADD COLUMN IF NOT EXISTS cadence_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_name text DEFAULT 'Thiago Figueiredo',
  ADD COLUMN IF NOT EXISTS sender_email text DEFAULT 'newsletter@bythiagofigueiredo.com',
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS max_bounce_rate_pct int NOT NULL DEFAULT 5;
