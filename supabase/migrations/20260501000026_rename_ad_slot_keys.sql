-- Migration 1: Rename ad slot keys from generic to position-based names.
-- Renames across 5 tables + seeds 2 new slots (rail_left, inline_end).

-- 1. ad_slot_creatives
UPDATE ad_slot_creatives SET slot_key = 'banner_top' WHERE slot_key = 'article_top';
UPDATE ad_slot_creatives SET slot_key = 'inline_mid' WHERE slot_key = 'article_between_paras';
UPDATE ad_slot_creatives SET slot_key = 'rail_right' WHERE slot_key = 'sidebar_right';
UPDATE ad_slot_creatives SET slot_key = 'block_bottom' WHERE slot_key = 'below_fold';

-- 2. ad_slot_metrics
UPDATE ad_slot_metrics SET slot_key = 'banner_top' WHERE slot_key = 'article_top';
UPDATE ad_slot_metrics SET slot_key = 'inline_mid' WHERE slot_key = 'article_between_paras';
UPDATE ad_slot_metrics SET slot_key = 'rail_right' WHERE slot_key = 'sidebar_right';
UPDATE ad_slot_metrics SET slot_key = 'block_bottom' WHERE slot_key = 'below_fold';

-- 3. ad_events (historical data unified under new names)
UPDATE ad_events SET slot_id = 'banner_top' WHERE slot_id = 'article_top';
UPDATE ad_events SET slot_id = 'inline_mid' WHERE slot_id = 'article_between_paras';
UPDATE ad_events SET slot_id = 'rail_right' WHERE slot_id = 'sidebar_right';
UPDATE ad_events SET slot_id = 'block_bottom' WHERE slot_id = 'below_fold';

-- 4. ad_placeholders (PK = slot_id, can't UPDATE PK — insert new, delete old)
INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'banner_top', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'article_top'
  ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'inline_mid', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'article_between_paras'
  ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'rail_right', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'sidebar_right'
  ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'block_bottom', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'below_fold'
  ON CONFLICT (slot_id) DO NOTHING;

DELETE FROM ad_placeholders WHERE slot_id IN ('article_top', 'article_between_paras', 'sidebar_right', 'below_fold');

-- Seed new slots (disabled placeholders)
INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, dismiss_after_ms, is_enabled)
VALUES
  ('rail_left', '', '', '', '', 0, false),
  ('inline_end', '', '', '', '', 0, false)
ON CONFLICT (slot_id) DO NOTHING;

-- 5. kill_switches (PK = id — same insert/delete pattern)
INSERT INTO kill_switches (id, enabled, reason)
  SELECT 'ads_slot_banner_top', enabled, reason
  FROM kill_switches WHERE id = 'ads_slot_article_top'
  ON CONFLICT (id) DO NOTHING;

INSERT INTO kill_switches (id, enabled, reason)
  SELECT 'ads_slot_inline_mid', enabled, reason
  FROM kill_switches WHERE id = 'ads_slot_article_between_paras'
  ON CONFLICT (id) DO NOTHING;

INSERT INTO kill_switches (id, enabled, reason)
  SELECT 'ads_slot_rail_right', enabled, reason
  FROM kill_switches WHERE id = 'ads_slot_sidebar_right'
  ON CONFLICT (id) DO NOTHING;

INSERT INTO kill_switches (id, enabled, reason)
  SELECT 'ads_slot_block_bottom', enabled, reason
  FROM kill_switches WHERE id = 'ads_slot_below_fold'
  ON CONFLICT (id) DO NOTHING;

DELETE FROM kill_switches WHERE id IN ('ads_slot_article_top', 'ads_slot_article_between_paras', 'ads_slot_sidebar_right', 'ads_slot_below_fold');

-- Seed new slot kill switches (enabled by default)
INSERT INTO kill_switches (id, enabled, reason)
VALUES
  ('ads_slot_rail_left', true, 'Kill switch for rail_left ad slot'),
  ('ads_slot_inline_end', true, 'Kill switch for inline_end ad slot')
ON CONFLICT (id) DO NOTHING;
