-- Fix misplaced references and clean up dead entries
-- Corrects deep-research-wyd (was stuck in pessoal due to wrong key in v1 migration)
-- Removes about-page (redundant with personal-profile, not AI context)

BEGIN;

DO $$ DECLARE _site_id uuid;
BEGIN
  SELECT id INTO _site_id FROM public.sites WHERE domains @> ARRAY['bythiagofigueiredo.com'];
  IF _site_id IS NULL THEN RAISE EXCEPTION 'Site not found'; END IF;

  -- deep-research-wyd → estrategia (content research, not biography)
  UPDATE public.reference_content SET ref_group = 'estrategia'
  WHERE site_id = _site_id AND key = 'deep-research-wyd';

  -- Remove about-page (redundant with personal-profile — website content, not AI context)
  DELETE FROM public.reference_content
  WHERE site_id = _site_id AND key = 'about-page';

END $$;

COMMIT;
