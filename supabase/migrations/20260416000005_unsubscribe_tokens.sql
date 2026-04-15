create table public.unsubscribe_tokens (
  token text primary key check (token ~ '^[a-f0-9]{64}$'),
  site_id uuid not null references public.sites(id) on delete restrict,
  email citext not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (site_id, email)
);

create index on public.unsubscribe_tokens (email);

alter table public.unsubscribe_tokens enable row level security;

-- service role only direct access; anon via RPC
drop policy if exists "unsubscribe service write" on public.unsubscribe_tokens;
-- (no policy = effectively service-role only via bypass)

create or replace function public.unsubscribe_via_token(p_token text)
returns json language plpgsql security definer as $$
declare v_tok record; v_sub record;
begin
  select token, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens where token = p_token for update;

  if v_tok.token is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true, 'site_id', v_tok.site_id, 'email', v_tok.email);
  end if;

  select id, status into v_sub from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email for update;

  if v_sub.id is not null and v_sub.status <> 'unsubscribed' then
    update public.newsletter_subscriptions
    set status = 'unsubscribed', unsubscribed_at = now()
    where id = v_sub.id;
  end if;

  update public.unsubscribe_tokens set used_at = now() where token = p_token;

  return json_build_object('ok', true, 'site_id', v_tok.site_id, 'email', v_tok.email, 'sub_id', v_sub.id);
end $$;

grant execute on function public.unsubscribe_via_token(text) to anon, authenticated;
