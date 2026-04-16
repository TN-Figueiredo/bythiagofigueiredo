-- Sprint 5a: cancel_account_deletion_in_grace — cancels an in-flight deletion
-- during the phase 1 → phase 3 grace window. App layer handles unban + email.
--
-- Finds the lgpd_requests row by token hash, validates it is still in grace,
-- marks it cancelled, returns the key payload so the caller can unban.

CREATE OR REPLACE FUNCTION public.cancel_account_deletion_in_grace(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row lgpd_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM lgpd_requests
  WHERE confirmation_token_hash = p_token_hash
    AND type = 'account_deletion'
    AND status = 'processing'
    AND phase = 1
    AND scheduled_purge_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('cancelled', false);
  END IF;

  UPDATE lgpd_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'cancelled', true,
    'user_id', v_row.user_id,
    'scheduled_purge_at', v_row.scheduled_purge_at
  );
END $$;
