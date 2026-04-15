-- Epic 10 / T74 — LGPD right-to-be-forgotten for contact submissions.
--
-- Admin-triggered redaction of a single submission. RPC is SECURITY DEFINER so
-- it can bypass RLS on write, but it validates staff status internally.
-- Callers (admin server actions) should ALSO verify staff on their side; this
-- is defense-in-depth.

-- Add audit column (idempotent).
alter table public.contact_submissions
  add column if not exists anonymized_at timestamptz;

create or replace function public.anonymize_contact_submission(p_id uuid) returns void language plpgsql security definer set search_path = public as $fn$
declare v_sub record; v_hash text;
begin
  if p_id is null then
    raise exception 'invalid_id';
  end if;

  -- Access control: staff of the submission's site/org, or service_role caller.
  -- is_staff() returns true for global staff (owner/admin/editor at master ring),
  -- and we also accept the service_role JWT (server actions running server-side).
  if not (public.is_staff() or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role') then
    -- Additionally, allow site-scoped admins via can_admin_site against the row's site.
    select site_id into v_sub from public.contact_submissions where id = p_id;
    if v_sub.site_id is null or not public.can_admin_site(v_sub.site_id) then
      raise exception 'forbidden';
    end if;
  end if;

  select id, email, anonymized_at into v_sub
  from public.contact_submissions
  where id = p_id
  for update;

  if v_sub.id is null then
    raise exception 'not_found';
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
