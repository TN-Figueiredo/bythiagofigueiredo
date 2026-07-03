-- =============================================================================
-- MIGRATION: BTF-097 — harden 9 SECURITY DEFINER functions missing search_path
-- =============================================================================
-- Without a pinned search_path, a caller-controlled search_path can shadow the
-- objects/operators referenced inside a SECURITY DEFINER body and run attacker
-- code with the definer's (elevated) privileges — search-path hijacking /
-- privilege escalation.
--
-- search_path DECISION (per function):
--   Every one of the 9 bodies below references at least one UNQUALIFIED table
--   name (e.g. `social_posts`, `blog_posts`, `link_clicks`, `ab_test_cycles`),
--   NOT `public.<table>`. An empty search_path (`= ''`) would therefore break
--   name resolution and the function would error at runtime. So all 9 are pinned
--   to `= 'public'` (strict enough: `public` is owned by the DB owner, unprivileged
--   roles cannot create shadowing objects there), NOT `= ''`.
--   Contrast with 20260607000001 where the bodies were fully schema-qualified and
--   `= ''` was safe.
--
-- ALTER FUNCTION ... SET search_path is idempotent (re-running just re-sets the
-- same value), so no drop/create needed.
--
-- Signatures confirmed against:
--   - update_pipeline_step: final redef in 20260518000002_fix_security_definer_search_path.sql
--   - 7 analytics RPCs:     20260516100003_analytics_rpc_functions.sql
--   - rotate_cycle:         20260531000014_rpc_rotate_cycle.sql
-- =============================================================================

-- update_pipeline_step — body uses bare `social_posts` → 'public'.
-- NOTE: this one was ALREADY hardened by 20260518000002 (final redef sets
-- search_path='public'); the audit flagged the original 20260515000002 body.
-- Kept here as an idempotent belt-and-suspenders re-assertion so the finding is
-- closed regardless of which definition wins on a partial replay.
-- NOTE: argument types are UNQUOTED — `integer`/`timestamptz` are SQL grammar
-- aliases (real pg_type names are int4 / timestamp with time zone); quoting them
-- as identifiers makes Postgres look for a literal type of that name and fails.
ALTER FUNCTION public.update_pipeline_step(uuid, text, jsonb)
  SET search_path = 'public';

-- Analytics RPCs — bodies use bare blog_posts / blog_translations / content_events
-- / tracked_links / link_clicks → 'public'
ALTER FUNCTION public.get_top_posts_analytics(uuid, timestamptz, timestamptz, integer)
  SET search_path = 'public';
ALTER FUNCTION public.get_top_links_analytics(uuid, timestamptz, timestamptz, integer)
  SET search_path = 'public';
ALTER FUNCTION public.get_top_referrers(uuid, timestamptz, timestamptz, integer)
  SET search_path = 'public';
ALTER FUNCTION public.get_utm_campaigns(uuid, timestamptz, timestamptz)
  SET search_path = 'public';
ALTER FUNCTION public.get_audience_countries(uuid, timestamptz, timestamptz)
  SET search_path = 'public';
ALTER FUNCTION public.get_audience_devices(uuid, timestamptz, timestamptz)
  SET search_path = 'public';
ALTER FUNCTION public.get_audience_sources(uuid, timestamptz, timestamptz)
  SET search_path = 'public';

-- rotate_cycle — body uses bare `ab_test_cycles` / `ab_tests` → 'public'
ALTER FUNCTION public.rotate_cycle(uuid, uuid, integer, jsonb)
  SET search_path = 'public';

