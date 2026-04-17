-- Sprint 5a: merge_anonymous_consents — on user sign-in, transfer anonymous
-- consents (keyed by anonymous_id from localStorage UUID) to the authed user.
--
-- Uses FOR UPDATE to serialize concurrent sign-ins from multiple tabs.
-- Conflict resolution: if the user already has a consent row for the same
-- (category, site_id), the user's existing consent WINS — anonymous row is
-- simply deleted. This preserves intentional post-auth choices.

CREATE OR REPLACE FUNCTION public.merge_anonymous_consents(p_anonymous_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_merged int := 0;
  v_rec record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Lock anonymous rows first to avoid races with another tab's merge.
  FOR v_rec IN
    SELECT id, category, site_id, consent_text_id, granted, granted_at, ip, user_agent
    FROM consents
    WHERE anonymous_id = p_anonymous_id AND user_id IS NULL
    FOR UPDATE
  LOOP
    -- Skip if user already has a current consent for (category, site_id).
    IF EXISTS (
      SELECT 1 FROM consents
      WHERE user_id = v_user
        AND category = v_rec.category
        AND site_id IS NOT DISTINCT FROM v_rec.site_id
        AND withdrawn_at IS NULL
    ) THEN
      DELETE FROM consents WHERE id = v_rec.id;
      CONTINUE;
    END IF;

    INSERT INTO consents (user_id, anonymous_id, category, site_id, consent_text_id, granted, granted_at, ip, user_agent)
    VALUES (v_user, NULL, v_rec.category, v_rec.site_id, v_rec.consent_text_id, v_rec.granted, v_rec.granted_at, v_rec.ip, v_rec.user_agent);

    DELETE FROM consents WHERE id = v_rec.id;
    v_merged := v_merged + 1;
  END LOOP;

  RETURN jsonb_build_object('merged_count', v_merged);
END $$;
