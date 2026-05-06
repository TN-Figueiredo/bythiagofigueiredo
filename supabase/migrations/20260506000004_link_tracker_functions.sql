-- ─── update_tracked_links_timestamp ───
-- Trigger function: bumps updated_at on tracked_links before any UPDATE.
CREATE OR REPLACE FUNCTION public.update_tracked_links_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Attach to tracked_links (regular table, not partitioned).
DROP TRIGGER IF EXISTS trg_tracked_links_updated_at ON tracked_links;
CREATE TRIGGER trg_tracked_links_updated_at
  BEFORE UPDATE ON tracked_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tracked_links_timestamp();

-- ─── generate_link_code ───
-- Generates a collision-free random alphanumeric short code for a given site.
-- Length grows from 6 to 8 characters if the 6-char space is exhausted (>50%
-- fill in practice). Re-tries up to 20 times before raising.
CREATE OR REPLACE FUNCTION public.generate_link_code(p_site_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet text  := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_length   int   := 6;
  v_code     text;
  v_attempt  int   := 0;
  v_exists   boolean;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      v_length := 8;  -- widen the space after repeated collisions
    END IF;
    IF v_attempt > 40 THEN
      RAISE EXCEPTION 'generate_link_code: too many collisions for site %', p_site_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Build a random code by sampling characters from the alphabet.
    v_code := '';
    FOR i IN 1..v_length LOOP
      v_code := v_code || substr(
        v_alphabet,
        1 + (floor(random() * length(v_alphabet)))::int,
        1
      );
    END LOOP;

    -- Check uniqueness within the site.
    SELECT EXISTS (
      SELECT 1 FROM tracked_links
      WHERE site_id = p_site_id AND code = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

-- ─── anonymize_old_link_clicks ───
-- LGPD / privacy retention: anonymizes PII (ip, user_agent, city, region,
-- visitor_id) in link_clicks older than p_older_than_days days.
-- Returns the count of rows anonymized.
-- Designed to be called by a nightly cron (service role).
CREATE OR REPLACE FUNCTION public.anonymize_old_link_clicks(p_older_than_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anonymized int;
BEGIN
  -- Only rows that still have PII present (ip IS NOT NULL guards idempotency).
  UPDATE link_clicks
  SET
    ip          = NULL,
    user_agent  = NULL,
    visitor_id  = NULL,
    city        = NULL,
    region      = NULL
  WHERE
    clicked_at < now() - (p_older_than_days || ' days')::interval
    AND ip IS NOT NULL;

  GET DIAGNOSTICS v_anonymized = ROW_COUNT;

  RETURN jsonb_build_object(
    'anonymized', v_anonymized,
    'older_than_days', p_older_than_days
  );
END;
$$;
