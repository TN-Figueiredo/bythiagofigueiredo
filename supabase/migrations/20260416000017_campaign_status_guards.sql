-- Campaign status invariants enforced at the DB layer.
--
-- These are belt-and-suspenders on top of the server-action transition
-- helpers (publish/unpublish/archive/schedule). Even if a future caller
-- bypasses those helpers, the DB will reject inconsistent lifecycle states.
--
-- Invariants:
--   * status='scheduled' MUST have scheduled_for IS NOT NULL
--   * status='published' MUST have published_at IS NOT NULL
--   * status='scheduled' AND scheduled_for < now()  → rejected (statement-level
--     trigger; keeps the constraint out of CHECK so replay of historical data
--     still works).
--
-- Idempotent DDL.

-- Drop existing constraints (idempotent re-apply).
alter table public.campaigns
  drop constraint if exists campaigns_scheduled_requires_scheduled_for;
alter table public.campaigns
  drop constraint if exists campaigns_published_requires_published_at;

alter table public.campaigns
  add constraint campaigns_scheduled_requires_scheduled_for
  check (status <> 'scheduled' or scheduled_for is not null);

alter table public.campaigns
  add constraint campaigns_published_requires_published_at
  check (status <> 'published' or published_at is not null);

-- Row-level trigger: reject inserts/updates where status='scheduled' but
-- scheduled_for is in the past. This is not a CHECK because now() is not
-- IMMUTABLE.
create or replace function public.tg_campaigns_scheduled_for_future()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'scheduled' and new.scheduled_for is not null and new.scheduled_for < now() then
    raise exception 'campaigns.scheduled_for must be in the future when status=scheduled (got %)',
      new.scheduled_for
      using errcode = '22023';
  end if;
  return new;
end
$$;

drop trigger if exists tg_campaigns_scheduled_for_future on public.campaigns;
create trigger tg_campaigns_scheduled_for_future
  before insert or update of status, scheduled_for on public.campaigns
  for each row execute function public.tg_campaigns_scheduled_for_future();
