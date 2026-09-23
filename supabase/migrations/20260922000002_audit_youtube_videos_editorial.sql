-- =============================================================================
-- MIGRATION: audit trail for EDITORIAL changes on youtube_videos
-- =============================================================================
--
-- Why: the channel is measured weekly, but a measurement only answers half the
-- question. "What did I try, and how did it behave afterwards?" needs the
-- events too — every retitle, thumbnail swap, recategorization, hide/feature,
-- pin and CMS note, with before/after, author and timestamp.
--
-- Scope, and why it is narrow:
--   `youtube_videos` is rewritten wholesale by the sync crons. view_count,
--   like_count, ctr, impressions, view_count_delta_today, last_analytics_sync_at
--   etc. change on every run and carry no decision. Auditing every UPDATE would
--   drown the editorial signal in imported metrics.
--
--   So the trigger is scoped twice over:
--     1. `AFTER UPDATE OF <editorial columns>` — a cheap statement-level
--        pre-filter on the SET list.
--     2. a `WHEN` clause requiring at least one of those columns to have
--        actually CHANGED. Postgres fires `UPDATE OF col` whenever the column
--        appears in the SET clause even if the value is identical, and the
--        Data API sync upserts title/description/tags/thumbnails on every run.
--        Without (2) each sync would write one audit row per video saying
--        nothing happened.
--
-- Columns audited (a human decision, whether made in the CMS or upstream in
-- YouTube Studio and mirrored here by the sync):
--   title, description, tags, thumbnail_url, thumbnail_hq_url  -- the levers
--   title_translation, description_translation                 -- CMS copy
--   category_id, is_featured, is_hidden, cms_notes, pinned_until
--
-- Deliberately NOT audited:
--   view_count, like_count, comment_count, view_count_yesterday,
--   view_count_delta_today, ctr, impressions, avg_view_percentage,
--   avg_view_duration_seconds, retention_curve, traffic_sources,
--   last_analytics_sync_at  -- imported measurements, not decisions
--   duration, duration_seconds, published_at, youtube_video_id, id, site_id,
--   channel_id              -- immutable facts about the upload
--   created_at, updated_at, version  -- bookkeeping touched by every write
--   auto_suggested_category_id       -- the auto-categorizer's OPINION, recomputed
--                                       by every full sync; a classifier changing
--                                       its mind about 35 videos at once is the
--                                       exact flood this trigger exists to avoid.
--                                       The human ACTING on a suggestion writes
--                                       category_id, which IS audited.
--
-- INSERT is not audited: a row only ever appears because the sync discovered a
-- video on the channel — there is no "create video" in the CMS — and the first
-- sync of a channel would emit one audit row per video for no decision at all.
-- DELETE is not audited: the only delete path is disconnecting a channel
-- (cms/settings/actions.ts), which wipes every video of that channel in one
-- statement — dozens of rows of noise for a single decision that is better
-- recorded at the channel level, and the video has no "after" left to compare.
-- =============================================================================

-- 1. Resolve org_id/site_id for youtube_videos rows.
--    Additive: the four existing branches (organization_members,
--    site_memberships, invitations + the implicit consents fall-through) are
--    byte-identical to the deployed body.
--    org_id matters: audit_log's read policy is
--    `is_super_admin() OR (org_id IS NOT NULL AND is_org_admin(org_id))`, so a
--    row with a NULL org_id is invisible to the ring admin who needs it.
CREATE OR REPLACE FUNCTION public.tg_audit_mutation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_before jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_org_id uuid;
  v_site_id uuid;
  v_resource_id uuid;
  v_ip inet;
  v_ua text;
  v_ip_raw text;
BEGIN
  -- Sprint 5a: skip during LGPD phase 1 cascade ops
  IF COALESCE(current_setting('app.skip_cascade_audit', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_resource_id := COALESCE((NEW).id, (OLD).id);

  IF TG_TABLE_NAME = 'organization_members' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME = 'site_memberships' THEN
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
    SELECT org_id INTO v_org_id FROM sites WHERE id = v_site_id;
  ELSIF TG_TABLE_NAME = 'invitations' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
  ELSIF TG_TABLE_NAME = 'youtube_videos' THEN
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
    SELECT org_id INTO v_org_id FROM sites WHERE id = v_site_id;
  END IF;

  v_ip_raw := nullif(current_setting('app.client_ip', true), '');
  IF v_ip_raw IS NOT NULL THEN
    BEGIN v_ip := v_ip_raw::inet;
    EXCEPTION WHEN invalid_text_representation THEN v_ip := NULL;
    END;
  END IF;
  IF v_ip IS NULL THEN v_ip := inet_client_addr(); END IF;
  v_ua := nullif(current_setting('app.user_agent', true), '');

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data, ip, user_agent)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_resource_id, v_org_id, v_site_id, v_before, v_after, v_ip, v_ua);
  RETURN COALESCE(NEW, OLD);
END $$;

-- 2. The trigger itself.
DROP TRIGGER IF EXISTS audit_youtube_videos_editorial ON public.youtube_videos;

CREATE TRIGGER audit_youtube_videos_editorial
AFTER UPDATE OF
  title,
  description,
  tags,
  thumbnail_url,
  thumbnail_hq_url,
  title_translation,
  description_translation,
  category_id,
  is_featured,
  is_hidden,
  cms_notes,
  pinned_until
ON public.youtube_videos
FOR EACH ROW
WHEN (
  OLD.title                   IS DISTINCT FROM NEW.title
  OR OLD.description          IS DISTINCT FROM NEW.description
  OR OLD.tags                 IS DISTINCT FROM NEW.tags
  OR OLD.thumbnail_url        IS DISTINCT FROM NEW.thumbnail_url
  OR OLD.thumbnail_hq_url     IS DISTINCT FROM NEW.thumbnail_hq_url
  OR OLD.title_translation    IS DISTINCT FROM NEW.title_translation
  OR OLD.description_translation IS DISTINCT FROM NEW.description_translation
  OR OLD.category_id          IS DISTINCT FROM NEW.category_id
  OR OLD.is_featured          IS DISTINCT FROM NEW.is_featured
  OR OLD.is_hidden            IS DISTINCT FROM NEW.is_hidden
  OR OLD.cms_notes            IS DISTINCT FROM NEW.cms_notes
  OR OLD.pinned_until         IS DISTINCT FROM NEW.pinned_until
)
EXECUTE FUNCTION public.tg_audit_mutation();

-- 3. "Everything ever tried on THIS video, newest first" is the only query this
--    trail exists to answer, and audit_log has no index on resource_id.
CREATE INDEX IF NOT EXISTS audit_log_youtube_video
  ON public.audit_log (resource_id, created_at DESC)
  WHERE resource_type = 'youtube_videos';

-- RLS on audit_log is deliberately untouched: the three existing SELECT
-- policies (super_admin / org_admin of org_id / the actor themselves) already
-- cover these rows, and no new policy is created.
