-- =============================================================================
-- MIGRATION: harden remaining SECURITY DEFINER functions missing search_path
-- =============================================================================
-- Without a pinned search_path, a caller-controlled search_path could shadow
-- objects/operators referenced inside the function body (search-path hijacking).
--
-- All three function bodies reference only schema-qualified objects
-- (public.unsubscribe_tokens, public.newsletter_subscriptions) and pg_catalog
-- built-ins (pg_*_advisory_lock, hashtextextended, now, encode, sha256), so an
-- empty search_path is safe and strictest.
--
-- Audit: BTF-084 (2026-06-07). cron_try_lock / cron_unlock / unsubscribe_via_token
-- in 20260507000001_schema.sql were created SECURITY DEFINER without SET search_path.

ALTER FUNCTION "public"."cron_try_lock"("p_job" "text") SET "search_path" = '';
ALTER FUNCTION "public"."cron_unlock"("p_job" "text") SET "search_path" = '';
ALTER FUNCTION "public"."unsubscribe_via_token"("p_token_hash" "text") SET "search_path" = '';
