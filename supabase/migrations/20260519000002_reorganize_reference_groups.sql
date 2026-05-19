-- Reorganize reference groups: move misplaced refs, remove API docs migrated to Tier 2
-- Keys verified against prod DB output 2026-05-19

BEGIN;

DO $$ DECLARE _site_id uuid;
BEGIN
  SELECT id INTO _site_id FROM public.sites WHERE domains @> ARRAY['bythiagofigueiredo.com'];
  IF _site_id IS NULL THEN RAISE EXCEPTION 'Site not found'; END IF;

  -- Pessoal → Estratégia (taxonomy/strategy refs, not biographical)
  UPDATE public.reference_content SET ref_group = 'estrategia'
  WHERE site_id = _site_id AND key IN (
    'content-calendar-taxonomy',
    'practitioner-research',
    'playlist-pathways-v2',
    'banco-de-tags'
  );

  -- Pessoal → Craft (format conventions and writing tools)
  UPDATE public.reference_content SET ref_group = 'craft'
  WHERE site_id = _site_id AND key IN (
    'featured-convention',
    'banco-de-frases-ancora',
    'text-pathways'
  );

  -- API → Craft (product eval methodology)
  UPDATE public.reference_content SET ref_group = 'craft'
  WHERE site_id = _site_id AND key IN ('product-eval-catalog', 'product-eval-reference');

  -- API → Pessoal (personal product experience)
  UPDATE public.reference_content SET ref_group = 'pessoal'
  WHERE site_id = _site_id AND key = 'product-eval-experience';

  -- Delete API docs migrated to Tier 2 domain docs
  DELETE FROM public.reference_content
  WHERE site_id = _site_id AND key IN ('cowork-section-schemas', 'playlist-graph-api');

END $$;

COMMIT;
