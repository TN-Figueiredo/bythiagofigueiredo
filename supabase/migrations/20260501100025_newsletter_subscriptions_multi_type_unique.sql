-- Allow same email to subscribe to multiple newsletter types.
-- Old constraint: unique (site_id, email) — blocks multi-newsletter subs.
-- New constraint: unique (site_id, email, newsletter_id) excluding unsubscribed.

-- 1. Drop the table-level unique that blocks multi-newsletter subs
ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_site_id_email_key;

-- 2. Safety backfill: any row with NULL newsletter_id gets 'main-pt'
--    (original backfill in 20260501000009 should have caught all, but ON DELETE SET NULL
--     could have re-nullified if a newsletter_type was deleted)
UPDATE public.newsletter_subscriptions
  SET newsletter_id = 'main-pt'
  WHERE newsletter_id IS NULL;

-- 3. Make newsletter_id NOT NULL + tighten FK to RESTRICT
--    (deleting a newsletter_type that has subscriptions should be blocked, not silently null)
ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_newsletter_id_fkey;

ALTER TABLE public.newsletter_subscriptions
  ALTER COLUMN newsletter_id SET NOT NULL;

ALTER TABLE public.newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_newsletter_id_fkey
    FOREIGN KEY (newsletter_id) REFERENCES public.newsletter_types(id)
    ON DELETE RESTRICT;

-- 4. New partial unique: one active sub per (site, email, type)
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscriptions_site_email_type
  ON public.newsletter_subscriptions (site_id, email, newsletter_id)
  WHERE status <> 'unsubscribed';
