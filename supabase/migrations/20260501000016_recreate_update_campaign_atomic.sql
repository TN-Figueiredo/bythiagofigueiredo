-- Drop old version (returns public.campaigns) and recreate with jsonb return
DROP FUNCTION IF EXISTS public.update_campaign_atomic(uuid, jsonb, jsonb);
