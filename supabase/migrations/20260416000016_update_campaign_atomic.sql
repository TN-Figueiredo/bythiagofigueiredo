-- update_campaign_atomic: single-transaction update of campaigns + upsert of
-- campaign_translations. Enforces can_admin_site(campaigns.site_id) inside
-- the function (callers run with service_role — we re-check here).
--
-- Signature: update_campaign_atomic(p_campaign_id uuid, p_patch jsonb, p_translations jsonb)
--   p_patch: partial row for public.campaigns (any subset of writable columns).
--            Keys are snake_case column names. jsonb null => set column to null.
--   p_translations: jsonb array of translation upserts, each object MUST carry
--                   `locale`. All other fields mirror campaign_translations
--                   columns. Rows with matching (campaign_id, locale) are
--                   updated; missing ones are inserted.
--
-- Hardening (round 2):
--   * SELECT ... FOR UPDATE on campaigns to close the TOCTOU window between
--     authz check and write.
--   * Reject unknown patch / translation keys with an explicit exception so
--     typos aren't silently dropped by the whitelist.
--
-- Hardening (round 3):
--   * `status`, `published_at`, `scheduled_for` removed from the patch
--     whitelist. Status transitions MUST go through the dedicated server
--     actions (publish/unpublish/archive/schedule) which call repo-level
--     helpers — never this generic patch. Keeps lifecycle invariants in one
--     place and prevents the editor's content save from flipping status.
--
-- Idempotent DDL.

drop function if exists public.update_campaign_atomic(uuid, jsonb, jsonb);

create or replace function public.update_campaign_atomic(
  p_campaign_id uuid,
  p_patch jsonb,
  p_translations jsonb
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_site_id uuid;
  v_row public.campaigns;
  v_translation jsonb;
  v_unknown_keys text[];
begin
  -- Row-lock the campaign up-front. This both asserts existence and prevents
  -- TOCTOU between the can_admin_site() check and subsequent writes.
  select site_id into v_site_id
    from public.campaigns
    where id = p_campaign_id
    for update;

  if not found then
    raise exception using message = 'campaign_not_found';
  end if;

  if v_site_id is not null and not public.can_admin_site(v_site_id) then
    raise exception 'permission denied for campaign %', p_campaign_id using errcode = '42501';
  end if;

  -- Reject unknown keys in p_patch (surface typos instead of silently dropping).
  if p_patch is not null and jsonb_typeof(p_patch) = 'object' then
    with keys as (select jsonb_object_keys(p_patch) as k)
    select array_agg(k) into v_unknown_keys
      from keys
     where k not in (
       'interest',
       'pdf_storage_path','brevo_list_id','brevo_template_id',
       'form_fields','updated_by'
     );
    if v_unknown_keys is not null then
      raise exception 'update_campaign_atomic: unknown patch keys: %',
        array_to_string(v_unknown_keys, ',');
    end if;
  end if;

  -- Reject unknown keys in each translation entry.
  if p_translations is not null and jsonb_typeof(p_translations) = 'array' then
    for v_translation in select * from jsonb_array_elements(p_translations)
    loop
      with keys as (select jsonb_object_keys(v_translation) as k)
      select array_agg(k) into v_unknown_keys
        from keys
       where k not in (
         'locale','slug','meta_title','meta_description','og_image_url',
         'main_hook_md','supporting_argument_md','introductory_block_md',
         'body_content_md','form_intro_md','form_button_label',
         'form_button_loading_label','context_tag',
         'success_headline','success_headline_duplicate',
         'success_subheadline','success_subheadline_duplicate',
         'check_mail_text','download_button_label','extras'
       );
      if v_unknown_keys is not null then
        raise exception 'update_campaign_atomic: unknown translation keys: %',
          array_to_string(v_unknown_keys, ',');
      end if;
    end loop;
  end if;

  -- apply partial patch to campaigns using jsonb_populate_record merge.
  -- NOTE: `status`, `published_at`, `scheduled_for` are intentionally NOT
  -- handled here. Status transitions go through dedicated repo actions.
  if p_patch is not null and jsonb_typeof(p_patch) = 'object' and p_patch <> '{}'::jsonb then
    update public.campaigns c
       set interest         = coalesce(p_patch->>'interest', c.interest),
           pdf_storage_path = case when p_patch ? 'pdf_storage_path'
                                   then nullif(p_patch->>'pdf_storage_path','')
                                   else c.pdf_storage_path end,
           brevo_list_id    = case when p_patch ? 'brevo_list_id'
                                   then nullif(p_patch->>'brevo_list_id','')::int
                                   else c.brevo_list_id end,
           brevo_template_id= case when p_patch ? 'brevo_template_id'
                                   then nullif(p_patch->>'brevo_template_id','')::int
                                   else c.brevo_template_id end,
           form_fields      = case when p_patch ? 'form_fields'
                                   then coalesce(p_patch->'form_fields', '[]'::jsonb)
                                   else c.form_fields end,
           updated_by       = case when p_patch ? 'updated_by'
                                   then nullif(p_patch->>'updated_by','')::uuid
                                   else c.updated_by end
     where c.id = p_campaign_id;
  end if;

  -- upsert translations
  if p_translations is not null and jsonb_typeof(p_translations) = 'array' then
    for v_translation in select * from jsonb_array_elements(p_translations)
    loop
      if (v_translation->>'locale') is null then
        raise exception 'translation entry missing locale' using errcode = '22004';
      end if;

      insert into public.campaign_translations (
        campaign_id, locale, slug,
        meta_title, meta_description, og_image_url,
        main_hook_md, supporting_argument_md, introductory_block_md, body_content_md,
        form_intro_md, form_button_label, form_button_loading_label,
        context_tag,
        success_headline, success_headline_duplicate,
        success_subheadline, success_subheadline_duplicate,
        check_mail_text, download_button_label,
        extras
      ) values (
        p_campaign_id,
        v_translation->>'locale',
        coalesce(v_translation->>'slug', ''),
        v_translation->>'meta_title',
        v_translation->>'meta_description',
        v_translation->>'og_image_url',
        coalesce(v_translation->>'main_hook_md', ''),
        v_translation->>'supporting_argument_md',
        v_translation->>'introductory_block_md',
        v_translation->>'body_content_md',
        v_translation->>'form_intro_md',
        v_translation->>'form_button_label',
        coalesce(v_translation->>'form_button_loading_label', 'Enviando...'),
        coalesce(v_translation->>'context_tag', ''),
        coalesce(v_translation->>'success_headline', ''),
        coalesce(v_translation->>'success_headline_duplicate', ''),
        coalesce(v_translation->>'success_subheadline', ''),
        coalesce(v_translation->>'success_subheadline_duplicate', ''),
        coalesce(v_translation->>'check_mail_text', ''),
        coalesce(v_translation->>'download_button_label', ''),
        v_translation->'extras'
      )
      on conflict (campaign_id, locale) do update set
        slug                         = coalesce(excluded.slug, public.campaign_translations.slug),
        meta_title                   = case when v_translation ? 'meta_title' then excluded.meta_title else public.campaign_translations.meta_title end,
        meta_description             = case when v_translation ? 'meta_description' then excluded.meta_description else public.campaign_translations.meta_description end,
        og_image_url                 = case when v_translation ? 'og_image_url' then excluded.og_image_url else public.campaign_translations.og_image_url end,
        main_hook_md                 = case when v_translation ? 'main_hook_md' then excluded.main_hook_md else public.campaign_translations.main_hook_md end,
        supporting_argument_md       = case when v_translation ? 'supporting_argument_md' then excluded.supporting_argument_md else public.campaign_translations.supporting_argument_md end,
        introductory_block_md        = case when v_translation ? 'introductory_block_md' then excluded.introductory_block_md else public.campaign_translations.introductory_block_md end,
        body_content_md              = case when v_translation ? 'body_content_md' then excluded.body_content_md else public.campaign_translations.body_content_md end,
        form_intro_md                = case when v_translation ? 'form_intro_md' then excluded.form_intro_md else public.campaign_translations.form_intro_md end,
        form_button_label            = case when v_translation ? 'form_button_label' then excluded.form_button_label else public.campaign_translations.form_button_label end,
        form_button_loading_label    = case when v_translation ? 'form_button_loading_label' then excluded.form_button_loading_label else public.campaign_translations.form_button_loading_label end,
        context_tag                  = case when v_translation ? 'context_tag' then excluded.context_tag else public.campaign_translations.context_tag end,
        success_headline             = case when v_translation ? 'success_headline' then excluded.success_headline else public.campaign_translations.success_headline end,
        success_headline_duplicate   = case when v_translation ? 'success_headline_duplicate' then excluded.success_headline_duplicate else public.campaign_translations.success_headline_duplicate end,
        success_subheadline          = case when v_translation ? 'success_subheadline' then excluded.success_subheadline else public.campaign_translations.success_subheadline end,
        success_subheadline_duplicate= case when v_translation ? 'success_subheadline_duplicate' then excluded.success_subheadline_duplicate else public.campaign_translations.success_subheadline_duplicate end,
        check_mail_text              = case when v_translation ? 'check_mail_text' then excluded.check_mail_text else public.campaign_translations.check_mail_text end,
        download_button_label        = case when v_translation ? 'download_button_label' then excluded.download_button_label else public.campaign_translations.download_button_label end,
        extras                       = case when v_translation ? 'extras' then excluded.extras else public.campaign_translations.extras end;
    end loop;
  end if;

  select * into v_row from public.campaigns where id = p_campaign_id;
  return v_row;
end
$fn$;

grant execute on function public.update_campaign_atomic(uuid, jsonb, jsonb) to authenticated;
