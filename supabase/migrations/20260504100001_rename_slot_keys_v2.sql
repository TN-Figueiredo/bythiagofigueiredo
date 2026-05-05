-- Migration: rename flat slot keys to post:* namespace
-- Idempotent: WHERE clauses target old keys only, no-op if already renamed

BEGIN;

-- 1. ad_placeholders (PK = slot_id) — must delete + reinsert since PK changes
INSERT INTO public.ad_placeholders (slot_id, is_enabled, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, app_id, created_at, updated_at)
SELECT
  CASE slot_id
    WHEN 'banner_top'   THEN 'post:top:banner'
    WHEN 'rail_left'    THEN 'post:rail:anchor-left'
    WHEN 'rail_right'   THEN 'post:rail:anchor'
    WHEN 'inline_mid'   THEN 'post:body:bookmark'
    WHEN 'block_bottom' THEN 'post:footer:coda'
  END,
  is_enabled, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, app_id, created_at, now()
FROM public.ad_placeholders
WHERE slot_id IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom')
ON CONFLICT (slot_id) DO NOTHING;

DELETE FROM public.ad_placeholders
WHERE slot_id IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom');

-- 2. ad_slot_creatives (slot_key column)
UPDATE public.ad_slot_creatives SET slot_key = 'post:top:banner'       WHERE slot_key = 'banner_top';
UPDATE public.ad_slot_creatives SET slot_key = 'post:rail:anchor-left' WHERE slot_key = 'rail_left';
UPDATE public.ad_slot_creatives SET slot_key = 'post:rail:anchor'      WHERE slot_key = 'rail_right';
UPDATE public.ad_slot_creatives SET slot_key = 'post:body:bookmark'    WHERE slot_key = 'inline_mid';
UPDATE public.ad_slot_creatives SET slot_key = 'post:footer:coda'      WHERE slot_key = 'block_bottom';

-- 3. ad_slot_metrics (slot_key in composite PK — delete + reinsert)
INSERT INTO public.ad_slot_metrics (slot_key, app_id, impressions, clicks, conversions, revenue_cents, date, created_at, updated_at)
SELECT
  CASE slot_key
    WHEN 'banner_top'   THEN 'post:top:banner'
    WHEN 'rail_left'    THEN 'post:rail:anchor-left'
    WHEN 'rail_right'   THEN 'post:rail:anchor'
    WHEN 'inline_mid'   THEN 'post:body:bookmark'
    WHEN 'block_bottom' THEN 'post:footer:coda'
  END,
  app_id, impressions, clicks, conversions, revenue_cents, date, created_at, now()
FROM public.ad_slot_metrics
WHERE slot_key IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom')
ON CONFLICT DO NOTHING;

DELETE FROM public.ad_slot_metrics
WHERE slot_key IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom');

-- 4. ad_events (slot_id column)
UPDATE public.ad_events SET slot_id = 'post:top:banner'       WHERE slot_id = 'banner_top';
UPDATE public.ad_events SET slot_id = 'post:rail:anchor-left' WHERE slot_id = 'rail_left';
UPDATE public.ad_events SET slot_id = 'post:rail:anchor'      WHERE slot_id = 'rail_right';
UPDATE public.ad_events SET slot_id = 'post:body:bookmark'    WHERE slot_id = 'inline_mid';
UPDATE public.ad_events SET slot_id = 'post:footer:coda'      WHERE slot_id = 'block_bottom';

-- 5. kill_switches (id column for per-slot switches)
UPDATE public.kill_switches SET id = 'ads_slot_post_top_banner',       reason = 'post:top:banner'       WHERE id = 'ads_slot_banner_top';
UPDATE public.kill_switches SET id = 'ads_slot_post_rail_anchor_left', reason = 'post:rail:anchor-left' WHERE id = 'ads_slot_rail_left';
UPDATE public.kill_switches SET id = 'ads_slot_post_rail_anchor',      reason = 'post:rail:anchor'      WHERE id = 'ads_slot_rail_right';
UPDATE public.kill_switches SET id = 'ads_slot_post_body_bookmark',    reason = 'post:body:bookmark'    WHERE id = 'ads_slot_inline_mid';
UPDATE public.kill_switches SET id = 'ads_slot_post_footer_coda',      reason = 'post:footer:coda'      WHERE id = 'ads_slot_block_bottom';

-- 6. ad_slot_config (composite PK = site_id + slot_key — update in-place)
UPDATE public.ad_slot_config SET slot_key = 'post:top:banner'       WHERE slot_key = 'banner_top';
UPDATE public.ad_slot_config SET slot_key = 'post:rail:anchor-left' WHERE slot_key = 'rail_left';
UPDATE public.ad_slot_config SET slot_key = 'post:rail:anchor'      WHERE slot_key = 'rail_right';
UPDATE public.ad_slot_config SET slot_key = 'post:body:bookmark'    WHERE slot_key = 'inline_mid';
UPDATE public.ad_slot_config SET slot_key = 'post:footer:coda'      WHERE slot_key = 'block_bottom';

COMMIT;
