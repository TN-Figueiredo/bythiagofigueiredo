-- Invitations: admin-created, email-delivered, token-accepted.
-- Audit fields: invited_by, accepted_at/by, revoked_at/by, last_sent_at, resend_count.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','author')),
  token text not null check (token ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  last_sent_at timestamptz not null default now(),
  resend_count int not null default 0
);

create unique index invitations_token_unique on public.invitations (token);
create unique index invitations_pending_unique
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;
create index on public.invitations (org_id, accepted_at) where accepted_at is null;

-- RLS policies
alter table public.invitations enable row level security;

drop policy if exists "invitations admin manage" on public.invitations;
create policy "invitations admin manage"
  on public.invitations for all to authenticated
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

-- RPC: get invitation by token (anon-callable, returns minimal info)
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  email citext,
  role text,
  org_name text,
  expires_at timestamptz,
  expired boolean
)
language sql
stable
as $$
  select
    i.email,
    i.role,
    o.name as org_name,
    i.expires_at,
    (i.expires_at <= now() or i.accepted_at is not null or i.revoked_at is not null) as expired
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
  limit 1
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- RPC: accept invitation atomically (security definer + FOR UPDATE lock)
create or replace function public.accept_invitation_atomic(
  p_token text,
  p_user_id uuid
) returns json
language plpgsql
security definer
as $$
declare
  v_inv record;
  v_user_email citext;
begin
  -- Lock the invitation row
  select id, email, org_id, role, expires_at, accepted_at, revoked_at
    into v_inv
  from public.invitations
  where token = p_token
  for update;

  if v_inv.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;
  if v_inv.revoked_at is not null then
    return json_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_inv.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  -- Verify user_id email matches invitation email
  select email::citext into v_user_email from auth.users where id = p_user_id;
  if v_user_email is null or lower(v_user_email::text) <> lower(v_inv.email::text) then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Atomic inserts
  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, p_user_id, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  insert into public.authors (user_id, name, slug)
  values (
    p_user_id,
    split_part(v_inv.email::text, '@', 1),
    split_part(v_inv.email::text, '@', 1) || '-' || substring(p_user_id::text, 1, 8)
  )
  on conflict (user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by_user_id = p_user_id
  where id = v_inv.id;

  return json_build_object('ok', true, 'org_id', v_inv.org_id);
end $$;

grant execute on function public.accept_invitation_atomic(text, uuid) to authenticated;
