-- Ring-scoped RLS helpers. These work alongside the existing global helpers
-- (is_staff, site_visible) from Sprint 1a/1b. is_staff remains as "god mode"
-- for backward compatibility with the 135 existing tests.

-- org_role: returns the current user's role in org_id, or NULL if not a member.
create or replace function public.org_role(p_org_id uuid)
returns text
language sql
stable
as $$
  select role from public.organization_members
  where org_id = p_org_id and user_id = auth.uid()
  limit 1
$$;

-- Test helper: same logic with explicit user_id parameter.
create or replace function public.org_role_for_user(p_org_id uuid, p_user_id uuid)
returns text
language sql
stable
as $$
  select role from public.organization_members
  where org_id = p_org_id and user_id = p_user_id
  limit 1
$$;

-- is_org_staff: true if current user has staff role (owner|admin|editor) in org.
create or replace function public.is_org_staff(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select public.org_role(p_org_id) in ('owner','admin','editor')
$$;

-- can_admin_site: true if current user is staff in the site's org OR in the
-- site's parent org (cascade up for multi-ring admin).
create or replace function public.can_admin_site(p_site_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_org_id uuid;
  v_parent_org_id uuid;
begin
  select s.org_id, o.parent_org_id
    into v_org_id, v_parent_org_id
  from public.sites s
  join public.organizations o on o.id = s.org_id
  where s.id = p_site_id;

  if v_org_id is null then return false; end if;

  if public.is_org_staff(v_org_id) then return true; end if;

  if v_parent_org_id is not null and public.is_org_staff(v_parent_org_id) then
    return true;
  end if;

  return false;
end
$$;

-- Test helper: explicit user_id version.
create or replace function public.can_admin_site_for_user(p_site_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_org_id uuid;
  v_parent_org_id uuid;
  v_role text;
begin
  select s.org_id, o.parent_org_id into v_org_id, v_parent_org_id
  from public.sites s join public.organizations o on o.id = s.org_id
  where s.id = p_site_id;

  if v_org_id is null then return false; end if;

  select role into v_role from public.organization_members
  where org_id = v_org_id and user_id = p_user_id;
  if v_role in ('owner','admin','editor') then return true; end if;

  if v_parent_org_id is not null then
    select role into v_role from public.organization_members
    where org_id = v_parent_org_id and user_id = p_user_id;
    if v_role in ('owner','admin','editor') then return true; end if;
  end if;

  return false;
end
$$;

grant execute on function public.org_role(uuid) to anon, authenticated, service_role;
grant execute on function public.is_org_staff(uuid) to anon, authenticated, service_role;
grant execute on function public.can_admin_site(uuid) to anon, authenticated, service_role;
grant execute on function public.org_role_for_user(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_admin_site_for_user(uuid, uuid) to anon, authenticated, service_role;
