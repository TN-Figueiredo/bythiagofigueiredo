-- =============================================================================
-- 0004_data_cleanup.sql — Wipe all dev/test content data.
--
-- KEEPS: organizations, sites, consent_texts, cron_config, kill_switches,
--        ad_placeholders, ad_slot_config, link_settings.
-- KEEPS: 1 default author (is_default=true), 1 default newsletter type (main-pt).
-- DELETES: everything else (posts, editions, campaigns, links, ads, youtube, etc).
--
-- This migration RUNS on remote (the only one that does — 0001-0003 are repair-marked).
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Blog content (bottom-up for FK safety)
--    blog_posts.author_id → authors (RESTRICT), so delete posts first
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.post_hashtags;
DELETE FROM public.blog_translations;
DELETE FROM public.blog_posts;
DELETE FROM public.hashtags;
DELETE FROM public.blog_cadence;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Newsletter data
--    sends CASCADE from editions, but explicit for clarity
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.newsletter_sends;
DELETE FROM public.newsletter_editions;
DELETE FROM public.newsletter_subscriptions;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Blog tags (must come after posts — post_hashtags FK)
--    Null out bidirectional FK before deleting types/tags
-- ═══════════════════════════════════════════════════════════════════════
UPDATE public.blog_tags SET linked_newsletter_type_id = NULL
  WHERE linked_newsletter_type_id IS NOT NULL;
UPDATE public.newsletter_types SET linked_tag_id = NULL
  WHERE linked_tag_id IS NOT NULL;
DELETE FROM public.blog_tags;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Newsletter types — delete all EXCEPT the main-pt default
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.newsletter_types WHERE id != 'main-pt';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Campaigns
--    campaign_submissions.campaign_id is RESTRICT — delete submissions first
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.campaign_submissions;
DELETE FROM public.campaign_translations;
DELETE FROM public.campaigns;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Contact / forms
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.contact_submissions;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. Links (partitioned — delete from parent cascades to partitions)
--    FK chain: link_daily_metrics, link_annotations, link_goals, link_alerts
--    all CASCADE from tracked_links, but explicit deletion avoids surprises
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.link_daily_metrics;
DELETE FROM public.link_annotations;
DELETE FROM public.link_goals;
DELETE FROM public.link_alerts;
DELETE FROM public.link_clicks;
DELETE FROM public.tracked_links;
DELETE FROM public.link_utm_presets;
DELETE FROM public.link_qr_templates;
DELETE FROM public.link_aggregation_watermark;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Ads (keep placeholders, kill_switches, slot_config)
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.ad_slot_metrics;
DELETE FROM public.ad_slot_creatives;
DELETE FROM public.ad_events;
DELETE FROM public.ad_campaigns;
DELETE FROM public.ad_inquiries;
DELETE FROM public.ad_media;
DELETE FROM public.ad_revenue_daily;
DELETE FROM public.user_app_presence;

-- ═══════════════════════════════════════════════════════════════════════
-- 9. YouTube
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.youtube_curated_comments;
DELETE FROM public.youtube_sync_log;
DELETE FROM public.youtube_videos;
DELETE FROM public.youtube_channels;
DELETE FROM public.youtube_categories;

-- ═══════════════════════════════════════════════════════════════════════
-- 10. Email / Audit / Webhooks / Auth artifacts
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.sent_emails;
DELETE FROM public.webhook_events;
DELETE FROM public.audit_log;
DELETE FROM public.invitations;
DELETE FROM public.password_reset_attempts;
DELETE FROM public.unsubscribe_tokens;

-- ═══════════════════════════════════════════════════════════════════════
-- 11. LGPD (no real users yet — safe to clean)
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.lgpd_requests;
DELETE FROM public.consents;

-- ═══════════════════════════════════════════════════════════════════════
-- 12. Authors — keep only the default
--     blog_posts already deleted above, so author_id RESTRICT is safe
-- ═══════════════════════════════════════════════════════════════════════
UPDATE public.newsletter_types SET author_id = NULL
  WHERE author_id IS NOT NULL;
DELETE FROM public.author_about_translations
  WHERE author_id NOT IN (SELECT id FROM public.authors WHERE is_default = true);
DELETE FROM public.authors WHERE is_default != true;

COMMIT;
