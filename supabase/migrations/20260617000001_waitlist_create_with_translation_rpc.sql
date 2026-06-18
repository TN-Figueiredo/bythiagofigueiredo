-- =============================================================================
-- MIGRATION: create_waitlist_with_translation — atomic create (WL-09).
-- Replaces the app-layer two-write + compensating-delete in createWaitlist with a
-- single transactional RPC: the waitlist row + its default-locale translation row are
-- inserted together, so a translation-insert failure rolls BOTH back (no orphan), and a
-- slug collision is reported as data (no exception leaks to the caller).
-- =============================================================================
create or replace function public.create_waitlist_with_translation(
  p_site_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_campaign_id uuid,
  p_sender_name text,
  p_sender_email text,
  p_reply_to text,
  p_intro_mdx text,
  p_locale text,
  p_headline text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.waitlists
    (site_id, slug, name, description, campaign_id, sender_name, sender_email, reply_to, intro_mdx)
  values
    (p_site_id, p_slug, p_name, p_description, p_campaign_id, p_sender_name, p_sender_email, p_reply_to, p_intro_mdx)
  returning id into v_id;

  insert into public.waitlist_translations (waitlist_id, locale, headline)
  values (v_id, p_locale, p_headline);

  return jsonb_build_object('id', v_id);
exception
  -- (site_id, slug) unique violation on the waitlist insert — the block rolls back to the
  -- BEGIN savepoint, so nothing is persisted; report it as data for the caller.
  when unique_violation then
    return jsonb_build_object('error', 'slug_taken');
end;
$$;

-- Only the service-role (server actions, post-requireSiteScope) calls this.
revoke all on function public.create_waitlist_with_translation(uuid,text,text,text,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_waitlist_with_translation(uuid,text,text,text,uuid,text,text,text,text,text,text) to service_role;
