-- waitlist_signup: sole public-signup write path. SECURITY DEFINER, search_path=''.
-- site_id is EXPLICIT (route passes trusted x-site-id); resolve by (slug, site_id) only.
-- p_email is TEXT (PostgREST resolves RPCs by arg type; a citext param => PGRST202 500).
drop function if exists public.waitlist_signup(uuid, text, text, text, text, text, text, inet, text);

create or replace function public.waitlist_signup(
  p_site_id              uuid,
  p_slug                 text,
  p_email                text,
  p_locale               text,
  p_consent_version      text,
  p_consent_text_snapshot text,
  p_source_surface       text,
  p_ip                   inet,
  p_user_agent           text
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  v_email       public.citext := p_email::public.citext;
  v_site_id     uuid;
  v_org_id      uuid;
  v_waitlist_id uuid;
  v_status      text;
  v_existing    public.waitlist_signups;
  v_signup_id   uuid;
  v_event       text;
begin
  if p_site_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select w.id, w.site_id, w.status
    into v_waitlist_id, v_site_id, v_status
    from public.waitlists w
   where w.slug = p_slug and w.site_id = p_site_id
   limit 1;

  if v_waitlist_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('error', 'waitlist_not_open', 'status', v_status);
  end if;

  select org_id into v_org_id from public.sites where id = v_site_id;

  select * into v_existing
    from public.waitlist_signups s
   where s.waitlist_id = v_waitlist_id and s.email = v_email and s.anonymized_at is null
   for update;

  if not found then
    insert into public.waitlist_signups (
      waitlist_id, site_id, email, locale, consent_launch_notification,
      consent_text_version, consent_grant_at, status, source_surface, ip, user_agent
    ) values (
      v_waitlist_id, v_site_id, v_email, p_locale, true,
      p_consent_version, now(), 'pending', p_source_surface, p_ip, p_user_agent
    ) returning id into v_signup_id;
    v_event := 'consent_granted';
  elsif v_existing.status = 'suppressed' and v_existing.suppression_reason = 'unsubscribe' then
    update public.waitlist_signups
       set status='pending', suppressed_at=null, suppression_reason=null,
           consent_text_version=p_consent_version, consent_grant_at=now(),
           locale=p_locale, source_surface=p_source_surface, ip=p_ip, user_agent=p_user_agent
     where id = v_existing.id returning id into v_signup_id;
    v_event := 'consent_regranted';
  else
    return jsonb_build_object('duplicate', true);
  end if;

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  values (null, v_event, 'waitlist_signup', v_signup_id, v_org_id, v_site_id,
          jsonb_build_object(
            'email_hash', encode(sha256(v_email::text::bytea), 'hex'),
            'source_surface', p_source_surface,
            'consent_text_version', p_consent_version,
            'consent_text_snapshot', p_consent_text_snapshot),
          p_ip, p_user_agent);

  return jsonb_build_object('duplicate', false);
end
$fn$;

revoke all on function public.waitlist_signup(uuid, text, text, text, text, text, text, inet, text) from public, anon, authenticated;
grant execute on function public.waitlist_signup(uuid, text, text, text, text, text, text, inet, text) to service_role;
