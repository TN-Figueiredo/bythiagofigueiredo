-- Sprint 4.75 RPC: reassign_content — org_admin transfers blog+campaign
-- ownership from one user to another within a site. Target must be eligible
-- (super_admin/org_admin or editor of the site).
CREATE OR REPLACE FUNCTION public.reassign_content(
  p_from_user uuid, p_to_user uuid, p_site_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_tmp integer;
BEGIN
  IF NOT public.can_admin_site_users(p_site_id) THEN
    RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_super_admin()
    OR public.is_org_admin((SELECT org_id FROM sites WHERE id = p_site_id))
    OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = p_to_user AND site_id = p_site_id AND role = 'editor')) THEN
    RAISE EXCEPTION 'target_user_not_eligible' USING ERRCODE = 'P0003';
  END IF;
  UPDATE blog_posts SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_count := v_count + v_tmp;
  UPDATE campaigns SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_count := v_count + v_tmp;
  RETURN v_count;
END $$;
