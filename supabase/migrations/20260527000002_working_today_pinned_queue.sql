-- =============================================================================
-- MIGRATION: working_today pinned queue table + RLS + RPCs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.working_today (
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_item_id uuid        NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  pinned_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pipeline_item_id)
);

CREATE INDEX IF NOT EXISTS idx_working_today_user
  ON public.working_today(user_id);

ALTER TABLE public.working_today ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS working_today_select_own ON public.working_today;
CREATE POLICY working_today_select_own ON public.working_today
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS working_today_insert_own ON public.working_today;
CREATE POLICY working_today_insert_own ON public.working_today
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_staff());

DROP POLICY IF EXISTS working_today_delete_own ON public.working_today;
CREATE POLICY working_today_delete_own ON public.working_today
  FOR DELETE USING (user_id = auth.uid());

DROP FUNCTION IF EXISTS pin_working_today(uuid, integer);
CREATE OR REPLACE FUNCTION pin_working_today(
  p_item_id uuid,
  p_max     integer DEFAULT 3
)
RETURNS json AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  DELETE FROM public.working_today
  WHERE user_id = v_uid
    AND pinned_at < now() - interval '24 hours';

  IF EXISTS (
    SELECT 1 FROM public.working_today
    WHERE user_id = v_uid AND pipeline_item_id = p_item_id
  ) THEN
    RETURN json_build_object('status', 'already_pinned');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.working_today
  WHERE user_id = v_uid;

  IF v_count >= p_max THEN
    RETURN json_build_object('status', 'cap_reached', 'current', v_count, 'max', p_max);
  END IF;

  INSERT INTO public.working_today (user_id, pipeline_item_id)
  VALUES (v_uid, p_item_id);

  RETURN json_build_object('status', 'pinned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

DROP FUNCTION IF EXISTS unpin_working_today(uuid);
CREATE OR REPLACE FUNCTION unpin_working_today(
  p_item_id uuid
)
RETURNS json AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  DELETE FROM public.working_today
  WHERE user_id = v_uid AND pipeline_item_id = p_item_id;

  RETURN json_build_object('status', 'unpinned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';
