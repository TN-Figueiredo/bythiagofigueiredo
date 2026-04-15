-- Epic 10 / T74 — LGPD right-to-be-forgotten for contact submissions.
--
-- Admin-triggered redaction of a single submission. RPC is SECURITY DEFINER so
-- it can bypass RLS on write, but it validates staff status internally.
-- Callers (admin server actions) should ALSO verify staff on their side; this
-- is defense-in-depth.

-- Add audit column (idempotent).
alter table public.contact_submissions
  add column if not exists anonymized_at timestamptz;

-- Partial index for admin UI filters like `where anonymized_at is null`
-- (list of non-anonymized submissions) — avoids full scan once volume grows.
create index if not exists contact_submissions_pending_anonymize
  on public.contact_submissions (site_id, submitted_at desc)
  where anonymized_at is null;

create or replace function public.anonymize_contact_submission(p_id uuid) returns void language plpgsql security definer set search_path = public as $fn$
declare v_sub record; v_site_id uuid; v_hash text;
begin
  if p_id is null then
    raise exception 'invalid_id';
  end if;

  -- Lock the row up-front and fetch every field we'll need. Single query so the
  -- authz check and the update see the same committed state — no TOCTOU.
  select id, site_id, email, anonymized_at
    into v_sub
  from public.contact_submissions
  where id = p_id
  for update;

  if v_sub.id is null then
    -- Fail-closed on missing row WITHOUT revealing existence to non-staff.
    -- Global staff get an explicit 'not_found'; anyone else gets 'forbidden'.
    if public.is_staff() or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
      raise exception 'not_found';
    end if;
    raise exception 'forbidden';
  end if;

  v_site_id := v_sub.site_id;

  -- Access control: staff of the submission's site/org, service_role, or
  -- site-scoped admin via can_admin_site against the resolved site_id.
  if not (public.is_staff()
          or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
          or (v_site_id is not null and public.can_admin_site(v_site_id))) then
    raise exception 'forbidden';
  end if;

  if v_sub.anonymized_at is not null then
    return; -- idempotent no-op
  end if;

  v_hash := encode(sha256(v_sub.email::bytea), 'hex');

  update public.contact_submissions
  set name = 'Anonymous',
      email = v_hash,
      ip = null,
      user_agent = null,
      message = '[anonymized per LGPD request]',
      anonymized_at = now()
  where id = p_id;
end $fn$;

grant execute on function public.anonymize_contact_submission(uuid) to authenticated;
