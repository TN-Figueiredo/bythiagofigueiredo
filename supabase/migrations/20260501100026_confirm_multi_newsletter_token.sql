-- Allow one confirmation token to cover multiple newsletter subscriptions.
-- Old: UNIQUE index on confirmation_token_hash blocked multi-newsletter inserts.
-- New: plain index (lookup only) + RPC confirms ALL rows matching the token.

-- 1. Drop the unique partial index that blocks shared tokens
DROP INDEX IF EXISTS public.newsletter_pending_token_hash;

-- 2. Re-create as a plain (non-unique) index for lookup performance
CREATE INDEX IF NOT EXISTS newsletter_pending_token_hash
  ON public.newsletter_subscriptions (confirmation_token_hash)
  WHERE status = 'pending_confirmation' AND confirmation_token_hash IS NOT NULL;

-- 3. Replace confirm RPC to handle multiple rows per token
DROP FUNCTION IF EXISTS public.confirm_newsletter_subscription(text);
CREATE OR REPLACE FUNCTION public.confirm_newsletter_subscription(p_token_hash text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_first  record;
  v_count  int;
BEGIN
  -- Lock all matching rows
  SELECT id, site_id, email, status, confirmation_expires_at
    INTO v_first
    FROM public.newsletter_subscriptions
   WHERE confirmation_token_hash = p_token_hash
   LIMIT 1
     FOR UPDATE;

  IF v_first.id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- If already confirmed, return idempotent success
  IF v_first.status = 'confirmed' THEN
    RETURN json_build_object('ok', true, 'email', v_first.email,
                             'site_id', v_first.site_id, 'already', true);
  END IF;

  -- Check expiry on the first row (all rows in the batch share the same expiry)
  IF v_first.confirmation_expires_at IS NULL
     OR v_first.confirmation_expires_at <= now() THEN
    RETURN json_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Confirm ALL rows sharing this token hash
  UPDATE public.newsletter_subscriptions
     SET status = 'confirmed',
         confirmed_at = now(),
         confirmation_token_hash = NULL,
         confirmation_expires_at = NULL
   WHERE confirmation_token_hash = p_token_hash
     AND status = 'pending_confirmation';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('ok', true, 'email', v_first.email,
                           'site_id', v_first.site_id, 'confirmed_count', v_count);
END $fn$;

-- 4. Ensure grants match
GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(text) TO anon, authenticated;
