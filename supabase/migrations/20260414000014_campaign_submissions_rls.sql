-- RLS for campaign_submissions + LGPD consent validation trigger.
--
-- The public form allows anon inserts (no read). Staff may read via RLS policy;
-- service_role bypasses RLS for updates (Brevo sync, anonymization, etc.).
-- cron_runs RLS is enabled in 20260414000016_cron_runs.sql; don't re-enable here.
alter table campaign_submissions enable row level security;

-- Consent validation trigger: LGPD requires explicit consent with a versioned
-- text reference. Enforce at the database layer so no API path can bypass.
create or replace function public.validate_submission_consent()
returns trigger language plpgsql as $$
begin
  if new.consent_marketing is not true then
    raise exception 'consent_marketing must be true (LGPD)'
      using errcode = 'check_violation';
  end if;
  if new.consent_text_version is null or length(new.consent_text_version) = 0 then
    raise exception 'consent_text_version is required';
  end if;
  return new;
end
$$;

create trigger tg_validate_submission_consent
  before insert on campaign_submissions
  for each row execute function public.validate_submission_consent();

-- anon may insert submissions (form is public); read/update forbidden.
create policy "submissions anon insert"
  on campaign_submissions for insert
  to anon, authenticated
  with check (true);

create policy "submissions staff read"
  on campaign_submissions for select
  to authenticated
  using (public.is_staff());

-- Updates only via service_role (bypasses RLS). No explicit update policy = deny.
