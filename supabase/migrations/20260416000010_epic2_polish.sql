-- Epic 2 polish — append-only migration.
-- Fixes:
-- 1. NULL guard in invitations_rate_limit trigger function
-- 2. Make length CHECK constraints idempotent
-- 3. (test-only) anon deny-all assertion on unsubscribe_tokens

-- ============================================================
-- 1: invitations_rate_limit — NULL guard for invited_by
-- ============================================================

create or replace function public.invitations_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count int;
begin
  -- NULL guard: invited_by is nullable (ON DELETE SET NULL); skip rate-limit for system inserts
  if new.invited_by is null then
    return new;
  end if;

  -- Advisory xact lock keyed on invited_by to prevent concurrent-insert race
  perform pg_advisory_xact_lock(hashtextextended(new.invited_by::text, 0));

  select count(*) into v_count from public.invitations
   where invited_by = new.invited_by
     and created_at > now() - interval '1 hour';

  if v_count >= 20 then
    raise exception 'rate_limit_exceeded: max 20 invitations per hour per admin'
      using errcode = 'check_violation';
  end if;
  return new;
end $fn$;

-- ============================================================
-- 2: Idempotent length CHECK constraints
-- ============================================================

alter table public.sent_emails drop constraint if exists sent_emails_template_name_len;
alter table public.sent_emails add constraint sent_emails_template_name_len
  check (char_length(template_name) <= 80);

alter table public.sites drop constraint if exists sites_contact_email_len;
alter table public.sites add constraint sites_contact_email_len
  check (contact_notification_email is null or char_length(contact_notification_email) <= 320);
