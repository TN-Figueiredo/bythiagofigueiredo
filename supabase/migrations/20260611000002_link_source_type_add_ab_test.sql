-- =============================================================================
-- MIGRATION: link_source_type_add_ab_test
--
-- The AB-Lab title/description feature (20260517000002_ab_lab_title_desc.sql)
-- created ab_test_tracked_links and app code that writes
-- tracked_links.source_type = 'ab_test' (ensureTrackedLink call in
-- ab-lab/actions.ts), but the link_source_type enum was never extended —
-- every AB-test tracked-link insert fails (invalid enum value) and is
-- swallowed by the Sentry-and-return-null path in lib/links/auto-link.ts.
--
-- Additive + idempotent.
-- =============================================================================

ALTER TYPE public.link_source_type ADD VALUE IF NOT EXISTS 'ab_test';
