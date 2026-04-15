-- Harden the anon insert policy on campaign_submissions: only allow submissions
-- targeting a campaign that is currently publicly visible (status='published',
-- published_at<=now()). Prevents anon from inflating submission counts for
-- unreleased or archived campaigns by guessing UUIDs.
--
-- Idempotent: drop-if-exists then create. Matches the pattern established in
-- 20260414000008_rls_site_helper.sql.

drop policy if exists "submissions anon insert" on public.campaign_submissions;

create policy "submissions anon insert"
  on public.campaign_submissions
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id
        and c.status = 'published'
        and c.published_at is not null
        and c.published_at <= now()
    )
  );

-- Cover UPDATE as well so consent_marketing cannot be flipped false post-insert.
drop trigger if exists tg_validate_submission_consent on public.campaign_submissions;
create trigger tg_validate_submission_consent
  before insert or update on public.campaign_submissions
  for each row execute function public.validate_submission_consent();
