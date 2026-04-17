-- Sprint 5a: reassign_authors — moves authors.user_id from one user to another.
-- Called during super_admin transfer pre-deletion flow. Caller must be able to
-- admin each site that has authored content associated with the from-user.

CREATE OR REPLACE FUNCTION public.reassign_authors(p_from uuid, p_to uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_site_id uuid;
BEGIN
  -- Permission check: caller must be able to admin site users for every site
  -- that has blog_posts/campaigns authored by rows linked to p_from's author_id.
  FOR v_site_id IN
    SELECT DISTINCT bp.site_id
    FROM blog_posts bp
    JOIN authors a ON a.id = bp.author_id
    WHERE a.user_id = p_from
    UNION
    SELECT DISTINCT c.site_id
    FROM campaigns c
    WHERE c.owner_user_id = p_from
  LOOP
    IF NOT public.can_admin_site_users(v_site_id) THEN
      RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE authors SET user_id = p_to WHERE user_id = p_from;
END $$;
