-- Unified view for newsletter click analytics.
-- Merges legacy newsletter_click_events with link_clicks from the unified pipeline.
-- The analytics page queries this view when LINKS_NEWSLETTER_REWRITE_ENABLED=true.
--
-- Columns exposed: send_id, url, ip, user_agent, clicked_at
-- The send_id for link_clicks is derived by looking up the newsletter_sends row
-- via the tracked_link's source_id (= edition_id) and the send's edition_id.

CREATE OR REPLACE VIEW public.newsletter_click_events_unified AS
  -- Legacy clicks (pre-unification sends)
  SELECT
    nce.send_id,
    nce.url,
    nce.ip,
    nce.user_agent,
    nce.clicked_at
  FROM public.newsletter_click_events nce

  UNION ALL

  -- Unified clicks (post-unification sends via tracked_links)
  SELECT
    ns.id AS send_id,
    tl.destination_url AS url,
    lc.ip,
    lc.user_agent,
    lc.clicked_at
  FROM public.link_clicks lc
  INNER JOIN public.tracked_links tl ON tl.id = lc.link_id
  INNER JOIN public.newsletter_sends ns
    ON ns.edition_id = tl.source_id
    AND ns.link_rewrite_enabled = true
  WHERE tl.source_type = 'newsletter';

-- Grant read access to authenticated and service_role
GRANT SELECT ON public.newsletter_click_events_unified TO authenticated;
GRANT SELECT ON public.newsletter_click_events_unified TO service_role;
