-- =============================================================================
-- MIGRATION: activate_research_foco_service
--
-- Adds a SECURITY DEFINER RPC `activate_research_foco_service(p_foco_id, p_site_id)`
-- that atomically demotes the previously-active foco and promotes the target,
-- WITHOUT a can_edit_site/auth.uid() check.
--
-- Rationale: the existing `activate_research_foco` RPC gates on `can_edit_site`,
-- which evaluates against `auth.uid()`. The MCP/service-role path has a NULL
-- auth.uid(), so that RPC always raises 42501. The MCP fallback previously did
-- TWO non-transactional UPDATEs (manual demote + promote); a partial failure
-- between them could leave the site with ZERO active focos. This function runs
-- both UPDATEs in a SINGLE atomic function body.
--
-- Site scoping is enforced by the CALLER passing the already-resolved p_site_id
-- (every UPDATE here is bounded by site_id), so no auth check is performed here.
-- EXECUTE is granted ONLY to service_role (never to PUBLIC/authenticated).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.activate_research_foco_service(
  p_foco_id uuid,
  p_site_id uuid
)
RETURNS public.research_focos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco public.research_focos;
BEGIN
  -- Demote whichever foco is currently active for this site. An 'ativo' foco
  -- transitions back to 'proposto'; any other state is preserved.
  UPDATE public.research_focos
  SET
    active = false,
    state  = CASE WHEN state = 'ativo' THEN 'proposto' ELSE state END
  WHERE site_id = p_site_id
    AND active = true
    AND id <> p_foco_id;

  -- Promote the target foco to the single active foco for the site.
  UPDATE public.research_focos
  SET
    active  = true,
    state   = 'ativo',
    horizon = 'agora'
  WHERE id = p_foco_id
    AND site_id = p_site_id
  RETURNING * INTO v_foco;

  RETURN v_foco;
END;
$$;

-- EXECUTE granted ONLY to service_role — this RPC bypasses the auth check by
-- design and must never be reachable by anon/authenticated clients.
REVOKE ALL ON FUNCTION public.activate_research_foco_service(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_research_foco_service(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
