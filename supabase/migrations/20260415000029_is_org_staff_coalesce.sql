-- Wrap is_org_staff in coalesce(..., false) so it always returns a concrete
-- boolean. Prior behavior returned NULL for non-members (null in (...) = null
-- under SQL 3-valued logic). Safe in RLS contexts either way, but explicit
-- boolean output prevents consumer-side === true bugs.

create or replace function public.is_org_staff(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(public.org_role(p_org_id) in ('owner','admin','editor'), false)
$$;
