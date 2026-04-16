-- Sprint 5a: check_deletion_safety — returns blockers that prevent account deletion.
-- Blockers:
--   - master_ring_sole_admin: user is the only org_admin on the master ring (parent_org_id IS NULL)
--   - child_org_sole_admin: user is the only org_admin on some child org
--   - sole_editor_on_sites: user is the only editor on some site with published content
--
-- Returns jsonb { can_delete: bool, blockers: text[], details: jsonb }.
-- SECURITY DEFINER so it can count across orgs regardless of caller's RLS view.

CREATE OR REPLACE FUNCTION public.check_deletion_safety(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_blockers text[] := ARRAY[]::text[];
  v_details jsonb := '{}'::jsonb;
  v_master_ring_id uuid;
  v_master_admin_count int;
  v_child_sole_orgs uuid[];
  v_sole_editor_sites uuid[];
BEGIN
  -- Identify master ring (unique: parent_org_id IS NULL).
  SELECT id INTO v_master_ring_id
  FROM organizations WHERE parent_org_id IS NULL LIMIT 1;

  -- Blocker 1: master ring sole admin.
  IF v_master_ring_id IS NOT NULL THEN
    SELECT count(*) INTO v_master_admin_count
    FROM organization_members
    WHERE org_id = v_master_ring_id AND role = 'org_admin';

    IF v_master_admin_count = 1 AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = v_master_ring_id AND role = 'org_admin' AND user_id = p_user_id
    ) THEN
      v_blockers := array_append(v_blockers, 'master_ring_sole_admin');
      v_details := v_details || jsonb_build_object('master_ring_org_id', v_master_ring_id);
    END IF;
  END IF;

  -- Blocker 2: child org sole admin.
  SELECT COALESCE(array_agg(org_id), ARRAY[]::uuid[])
  INTO v_child_sole_orgs
  FROM (
    SELECT om.org_id
    FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = p_user_id
      AND om.role = 'org_admin'
      AND o.parent_org_id IS NOT NULL
      AND (
        SELECT count(*) FROM organization_members om2
        WHERE om2.org_id = om.org_id AND om2.role = 'org_admin'
      ) = 1
  ) t;

  IF array_length(v_child_sole_orgs, 1) IS NOT NULL THEN
    v_blockers := array_append(v_blockers, 'child_org_sole_admin');
    v_details := v_details || jsonb_build_object('child_org_ids', to_jsonb(v_child_sole_orgs));
  END IF;

  -- Blocker 3: sole editor on sites with published content.
  SELECT COALESCE(array_agg(site_id), ARRAY[]::uuid[])
  INTO v_sole_editor_sites
  FROM (
    SELECT sm.site_id
    FROM site_memberships sm
    WHERE sm.user_id = p_user_id
      AND sm.role = 'editor'
      AND (
        SELECT count(*) FROM site_memberships sm2
        WHERE sm2.site_id = sm.site_id AND sm2.role = 'editor'
      ) = 1
      AND EXISTS (
        SELECT 1 FROM blog_posts bp
        WHERE bp.site_id = sm.site_id AND bp.status = 'published'
      )
  ) t;

  IF array_length(v_sole_editor_sites, 1) IS NOT NULL THEN
    v_blockers := array_append(v_blockers, 'sole_editor_on_sites');
    v_details := v_details || jsonb_build_object('sole_editor_site_ids', to_jsonb(v_sole_editor_sites));
  END IF;

  RETURN jsonb_build_object(
    'can_delete', (array_length(v_blockers, 1) IS NULL),
    'blockers', to_jsonb(v_blockers),
    'details', v_details
  );
END $$;
