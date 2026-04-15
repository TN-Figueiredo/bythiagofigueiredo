-- Internal helper: check if a user has staff role in a given org.
-- Used by both can_admin_site (auth.uid) and can_admin_site_for_user (param).
-- Avoids drift between the two code paths.
create or replace function public.is_org_staff_for_user(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select role in ('owner','admin','editor')
  from public.organization_members
  where org_id = p_org_id and user_id = p_user_id
  limit 1
$$;

grant execute on function public.is_org_staff_for_user(uuid, uuid) to anon, authenticated, service_role;

-- Refactor can_admin_site_for_user to use the shared helper.
create or replace function public.can_admin_site_for_user(p_site_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_org_id uuid;
  v_parent_org_id uuid;
begin
  select s.org_id, o.parent_org_id into v_org_id, v_parent_org_id
  from public.sites s join public.organizations o on o.id = s.org_id
  where s.id = p_site_id;

  if v_org_id is null then return false; end if;
  if coalesce(public.is_org_staff_for_user(v_org_id, p_user_id), false) then return true; end if;
  if v_parent_org_id is not null
    and coalesce(public.is_org_staff_for_user(v_parent_org_id, p_user_id), false) then
    return true;
  end if;
  return false;
end
$$;
