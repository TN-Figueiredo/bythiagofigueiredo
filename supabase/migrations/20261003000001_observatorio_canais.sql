-- =============================================================================
-- MIGRATION:
-- =============================================================================

-- Observatório v2 — canais: nicho, saúde da sincronização, limite por site, nicho por usuário.
-- Idempotente. Não apaga nem reescreve dados.

alter table competitor_channels
  add column if not exists niche text,
  add column if not exists last_ok_synced_at timestamptz,
  add column if not exists sync_error_since timestamptz;

alter table competitor_channels drop constraint if exists competitor_channels_niche_check;
alter table competitor_channels add constraint competitor_channels_niche_check
  check (niche is null or niche in ('viagem', 'ia'));

-- last_synced_at era gravado no INÍCIO da sincronização; o "último sucesso" passa a ter coluna própria.
update competitor_channels set last_ok_synced_at = last_synced_at
  where last_ok_synced_at is null and sync_status = 'idle';

create index if not exists idx_competitor_channels_sync_cursor
  on competitor_channels (site_id, last_synced_at nulls first);

create table if not exists competitor_settings (
  site_id uuid primary key references sites(id) on delete cascade,
  channel_limit integer not null default 75 check (channel_limit between 1 and 500),
  series_started_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table competitor_settings enable row level security;
drop policy if exists "competitor_settings_select" on competitor_settings;
create policy "competitor_settings_select" on competitor_settings
  for select using (public.can_view_site(site_id));

create table if not exists competitor_user_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  niche text not null default 'todos' check (niche in ('todos', 'viagem', 'ia')),
  updated_at timestamptz not null default now(),
  primary key (user_id, site_id)
);
alter table competitor_user_prefs enable row level security;
drop policy if exists "competitor_user_prefs_own" on competitor_user_prefs;
create policy "competitor_user_prefs_own" on competitor_user_prefs
  for all using (user_id = auth.uid() and public.can_view_site(site_id))
  with check (user_id = auth.uid() and public.can_view_site(site_id));
