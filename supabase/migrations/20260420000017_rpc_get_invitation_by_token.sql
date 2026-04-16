-- Sprint 4.75 RPC: get_invitation_by_token — read-side RPC used by the
-- /signup/invite/[token] page to fetch invitation metadata before accept.
-- Returns NULL if invalid/expired/revoked/accepted.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'inviter_email', au.email,
    'inviter_name', COALESCE(au.raw_user_meta_data->>'name', split_part(au.email,'@',1)),
    'org_id', i.org_id,
    'org_name', o.name,
    'site_id', i.site_id,
    'site_name', s.name,
    'primary_domain', s.primary_domain,
    'role', i.role,
    'role_scope', i.role_scope,
    'email', i.email,
    'expires_at', i.expires_at
  ) FROM invitations i
  LEFT JOIN auth.users au ON au.id = i.invited_by
  LEFT JOIN organizations o ON o.id = i.org_id
  LEFT JOIN sites s ON s.id = i.site_id
  WHERE i.token = p_token_hash
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now();
$$;
