-- Recreate update_campaign_atomic with jsonb return type
CREATE OR REPLACE FUNCTION public.update_campaign_atomic(
  p_campaign_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_translations jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
  v_result jsonb;
  v_key text;
  v_allowed_keys text[] := ARRAY[
    'interest', 'status', 'pdf_storage_path',
    'form_fields', 'scheduled_for', 'published_at',
    'owner_user_id'
  ];
  v_set_parts text[] := '{}';
  v_trans jsonb;
  v_trans_allowed text[] := ARRAY[
    'locale','slug','meta_title','meta_description',
    'content_mdx','content_compiled','cover_image_url',
    'pdf_storage_path','seo_extras'
  ];
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key = ANY(v_allowed_keys) THEN
      v_set_parts := array_append(v_set_parts,
        format('%I = %L', v_key, p_patch->>v_key));
    END IF;
  END LOOP;

  IF array_length(v_set_parts, 1) > 0 THEN
    EXECUTE format(
      'UPDATE campaigns SET %s, updated_at = now() WHERE id = %L',
      array_to_string(v_set_parts, ', '), p_campaign_id
    );
  END IF;

  FOR v_trans IN SELECT * FROM jsonb_array_elements(p_translations)
  LOOP
    INSERT INTO campaign_translations (campaign_id, locale, slug, meta_title, meta_description,
      content_mdx, content_compiled, cover_image_url, pdf_storage_path, seo_extras)
    VALUES (
      p_campaign_id,
      v_trans->>'locale',
      v_trans->>'slug',
      v_trans->>'meta_title',
      v_trans->>'meta_description',
      v_trans->>'content_mdx',
      v_trans->>'content_compiled',
      v_trans->>'cover_image_url',
      v_trans->>'pdf_storage_path',
      CASE WHEN v_trans ? 'seo_extras' THEN v_trans->'seo_extras' ELSE NULL END
    )
    ON CONFLICT (campaign_id, locale) DO UPDATE SET
      slug = EXCLUDED.slug,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      content_mdx = EXCLUDED.content_mdx,
      content_compiled = EXCLUDED.content_compiled,
      cover_image_url = EXCLUDED.cover_image_url,
      pdf_storage_path = EXCLUDED.pdf_storage_path,
      seo_extras = COALESCE(EXCLUDED.seo_extras, campaign_translations.seo_extras);
  END LOOP;

  SELECT row_to_json(c.*) INTO v_result FROM campaigns c WHERE c.id = p_campaign_id;
  RETURN jsonb_build_object('ok', true, 'campaign', v_result);
END;
$$;
