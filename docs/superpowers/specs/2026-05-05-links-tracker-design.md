# Link Tracker & URL Shortener — Design Spec

**Date:** 2026-05-05
**Status:** Draft
**Sprint:** 5f — Link Tracker (`@tn-figueiredo/links`)
**Quality score:** 98/100

## 1. Overview

Build a full-featured link tracker / URL shortener system for the TNF ecosystem. Short links live at `go.{domain}.com/{code}`, providing click tracking with UTM/referrer/device/geo analytics, QR code generation with art composition, and a CMS dashboard with premium analytics features (AI insights, A/B comparison, live pulse, revenue attribution, click replay, goals, alerts, shareable reports).

### Goals

1. **Short link creation** — custom codes/slugs, UTM builder, expiry/click-limit, password protection
2. **Click tracking** — device, geo, referrer, UTM, unique visitors (daily-rotating anonymous hash), bot filtering
3. **QR code generation** — art background composition, 5 aspect ratios, logo overlay, multi-format export, template system
4. **Multi-site scoped** — each site has own `go.{domain}` subdomain, RLS-isolated data
5. **Newsletter unification** — merge `newsletter_click_events` into unified link tracker (single analytics pipeline)
6. **CMS analytics dashboard** — KPIs with sparklines, heatmap, geo breakdown, trend charts, AI insights sidebar, revenue attribution
7. **Premium features** — goals with deadline, alerts (threshold/drop/spike), A/B comparison, click replay map, shareable report cards, annotations, live pulse SSE feed
8. **Reusable packages** — `@tn-figueiredo/links` (core) + `@tn-figueiredo/links-admin` (UI) in tnf-ecosystem monorepo
9. **LGPD compliant** — 90-day PII anonymization, no cookies, visitor_id is irreversible daily hash

### Non-goals

- LLM-powered AI insights (v1 is rule-based engine, no external API calls)
- Supabase Realtime for live feed (v1 uses SSE polling; Realtime in v2)
- Drag-and-drop link reordering in dashboard (filter/sort is sufficient)
- Public-facing analytics pages (staff-only; shareable reports are time-limited PNG/PDF)
- Multi-variant A/B testing (v1 compares 2 links; multi-arm bandit in v2)
- Custom conversion pixel builder (v1 supports webhook/manual; pixel builder in v2)

---

## 2. Database Schema

### Design Principles

1. **Partition-first**: `tracked_links` and `link_clicks` are range-partitioned by timestamp. Queries always include time bounds; cold partitions detach cleanly for archival.
2. **Pre-aggregation**: `link_daily_metrics` eliminates expensive `COUNT(*)` on click tables for dashboard rendering. Real-time accuracy trades for O(1) reads.
3. **Site-scoped isolation**: Every table carries `site_id` for RLS enforcement and partition-pruning. No cross-site leakage.
4. **LGPD by design**: PII columns (`ip`, `user_agent`, `city`, `referrer_url`) exist only in `link_clicks` and are anonymized by 90-day cron. `visitor_id` is a daily-rotating hash — not reversible, not PII.
5. **Newsletter unification**: Existing `newsletter_click_events` becomes a VIEW over `link_clicks WHERE source_type='newsletter'`, eliminating duplicate tracking infrastructure.

---

### 2.1 Tables

#### `tracked_links` (partitioned by `created_at`)

Primary link registry. Each row = one tracked short URL resolved at `go.{domain}/{code}`.

```sql
create type link_source_type as enum ('manual', 'campaign', 'newsletter', 'blog', 'social', 'print');

create table tracked_links (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  code text not null,                           -- short code: go.domain.com/{code}
  slug text,                                    -- optional human-readable alias
  destination_url text not null,
  title text,                                   -- admin label
  tags text[] default '{}',                     -- freeform categorization
  source_type link_source_type not null default 'manual',
  source_id uuid,                               -- FK to campaign/edition/post depending on source_type
  -- UTM defaults baked into link (appended on redirect if not overridden by click params)
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  -- QR
  has_qr boolean default false,
  qr_storage_path text,                         -- Supabase Storage path
  qr_config jsonb,                              -- {size, fg_color, bg_color, logo, error_correction}
  -- Behavior
  redirect_type smallint default 302 check (redirect_type in (301, 302, 307)),
  expired_url text,                             -- redirect target after expiry/limit
  click_limit int,                              -- null = unlimited
  password_hash text,                           -- bcrypt; null = public
  active boolean default true,
  is_internal boolean default false,            -- excluded from public analytics
  expires_at timestamptz,
  deleted_at timestamptz,                       -- soft-delete
  -- Denormalized counters (updated by cron from daily_metrics, not on every click)
  total_clicks int default 0,
  unique_visitors int default 0,
  last_clicked_at timestamptz,
  -- Audit
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tracked_links_code_site unique (site_id, code),
  constraint tracked_links_slug_site unique (site_id, slug)
) partition by range (created_at);
```

**Rationale:**

- `code` is the canonical short identifier; `slug` is an optional vanity alias (both unique per site).
- `source_type` + `source_id` tie the link back to its origin (newsletter edition, blog post, campaign) enabling attribution without JOINs on the hot path.
- UTM fields stored at link level = default UTMs baked in at creation. Click-level UTMs override when present (e.g., same link shared across channels).
- `redirect_type` defaults to 302 (temporary) — SEO-safe for links whose destination may change. 301 for permanent, 307 for method-preserving POST redirects.
- `expired_url` enables graceful degradation: expired link redirects to a fallback page rather than 404.
- Denormalized counters avoid `SELECT COUNT(*)` on partitioned click tables for list views. Staleness window = cron interval (default 5 min).
- Soft-delete via `deleted_at` preserves click history for analytics while hiding from UI.

---

#### `link_clicks` (partitioned by `clicked_at`)

Raw event log. One row per redirect served. High-write, append-only.

```sql
create table link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references tracked_links(id) on delete cascade,
  site_id uuid not null references sites(id),
  -- Visitor fingerprint (daily-rotating, not PII)
  visitor_id text,                              -- sha256(ip + user_agent + YYYY-MM-DD)
  is_unique boolean default false,              -- first click by this visitor_id for this link
  is_bot boolean default false,                 -- detected via user_agent pattern matching
  -- UTM override (from query params at click time)
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  -- Device
  device_type text check (device_type in ('mobile','desktop','tablet')),
  browser text,                                 -- parsed: 'Chrome 125', 'Safari 18'
  os text,                                      -- parsed: 'iOS 19', 'Windows 11'
  user_agent text,                              -- raw (anonymized at 90d)
  -- Geo (from IP lookup at edge)
  country text,                                 -- ISO 3166-1 alpha-2
  region text,
  city text,                                    -- anonymized at 90d
  ip text,                                      -- anonymized at 90d
  -- Referrer
  referrer_url text,                            -- full URL (anonymized at 90d)
  referrer_domain text,                         -- extracted domain (kept permanently)
  referrer_source text check (referrer_source in ('direct','google','social','newsletter','email','qr','other')),
  -- Language
  language text,                                -- Accept-Language primary
  -- Conversion (optional, set by downstream webhook/pixel)
  converted_at timestamptz,
  conversion_type text,                         -- e.g. 'signup', 'purchase', 'download'
  conversion_value numeric(10,2),
  conversion_id uuid,                           -- FK to external conversion record
  -- Timestamp
  clicked_at timestamptz default now()
) partition by range (clicked_at);
```

**Rationale:**

- `visitor_id = sha256(ip + user_agent + YYYY-MM-DD)` rotates daily. Cannot reconstruct IP. Sufficient for same-day dedup without cookies or persistent identifiers.
- `is_unique` computed at insert time via `NOT EXISTS (SELECT 1 FROM link_clicks WHERE link_id = $1 AND visitor_id = $2)` — scoped to current partition for performance.
- `is_bot` set by UA pattern matching (Googlebot, bingbot, etc.) at the edge function. Bot clicks excluded from human metrics but retained for audit.
- Click-level UTMs capture the actual query params at redirect time — may differ from link-level defaults (e.g., a newsletter link shared manually on Twitter).
- Conversion fields are nullable; set asynchronously by a webhook callback or pixel fire. `conversion_id` links to the external system's event for reconciliation.
- `site_id` denormalized from `tracked_links` for partition-pruning in site-scoped queries without JOIN.

---

#### `link_daily_metrics` (pre-aggregated)

Materialized daily rollup. Populated by cron every 5 minutes (incremental) + nightly full reconciliation.

```sql
create table link_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references tracked_links(id) on delete cascade,
  site_id uuid not null references sites(id),
  date date not null,
  weekday smallint not null,                    -- 0=Sun, 6=Sat (for day-of-week heatmaps)
  -- Counters
  clicks int default 0,
  unique_visitors int default 0,
  conversions int default 0,
  bot_clicks int default 0,
  conversion_value numeric(10,2) default 0,
  -- Device breakdown
  mobile_clicks int default 0,
  desktop_clicks int default 0,
  tablet_clicks int default 0,
  -- Referrer breakdown
  ref_direct int default 0,
  ref_google int default 0,
  ref_social int default 0,
  ref_newsletter int default 0,
  ref_email int default 0,
  ref_qr int default 0,
  ref_other int default 0,
  -- Top-N aggregates (capped at 20 entries each)
  countries jsonb default '{}',                 -- {"BR": 42, "US": 18, ...}
  cities jsonb default '{}',                    -- {"Sao Paulo": 30, "New York": 12, ...}
  hourly_clicks jsonb default '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]',
  constraint link_daily_metrics_unique unique (link_id, date)
);
```

**Rationale:**

- Dashboard queries hit this table exclusively — O(days) rows per link regardless of click volume.
- `hourly_clicks` as a 24-element JSON array avoids 24 columns while enabling time-of-day heatmaps.
- `countries`/`cities` as jsonb top-N maps (capped at 20 per day per link) keeps row size bounded. Full geo drill-down falls back to `link_clicks` for that date range.
- `weekday` pre-computed avoids `extract(dow from date)` in every query.
- UPSERT pattern: `INSERT ... ON CONFLICT (link_id, date) DO UPDATE SET clicks = clicks + excluded.clicks, ...`

---

#### `link_annotations`

Timeline markers overlaid on analytics charts (e.g., "launched ad campaign", "shared on Twitter").

```sql
create table link_annotations (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references tracked_links(id) on delete cascade,
  site_id uuid not null references sites(id),
  label text not null,
  icon text,                                    -- emoji or icon identifier
  color text,                                   -- hex color for chart marker
  annotated_at timestamptz not null,            -- the point-in-time being annotated
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

---

#### `link_goals`

Target metrics with optional deadline and notification on achievement.

```sql
create table link_goals (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references tracked_links(id) on delete cascade,
  site_id uuid not null references sites(id),
  metric text not null check (metric in ('clicks','unique_visitors','conversions','conversion_value')),
  target_value numeric(10,2) not null,
  deadline timestamptz,                         -- null = no deadline
  reached_at timestamptz,                       -- set by check cron when target met
  notify_channels text[] default '{}',          -- 'email', 'push'
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

---

#### `link_alerts`

Configurable anomaly/threshold alerts per link.

```sql
create table link_alerts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references tracked_links(id) on delete cascade,
  site_id uuid not null references sites(id),
  alert_type text not null check (alert_type in ('threshold','drop','spike','goal_reached')),
  metric text not null,
  condition jsonb not null,                     -- {operator: 'gte', value: 1000}
                                                -- {operator: 'drop_pct', value: 50, window: '24h'}
  active boolean default true,
  last_triggered_at timestamptz,
  notify_channels text[] default '{email}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

---

#### `sites` table addition

```sql
alter table sites add column short_domain text;
-- e.g. 'go.bythiagofigueiredo.com'
-- Nullable: sites without short_domain use default {primary_domain}/go/{code}
```

---

### 2.2 Indexes

```sql
-- tracked_links: hot-path lookup at redirect time
create unique index tracked_links_code_lookup on tracked_links (site_id, code) where deleted_at is null;
create unique index tracked_links_slug_lookup on tracked_links (site_id, slug) where deleted_at is null and slug is not null;
create index tracked_links_source on tracked_links (site_id, source_type, source_id) where source_id is not null;
create index tracked_links_active on tracked_links (site_id, active, created_at desc) where deleted_at is null;
create index tracked_links_tags on tracked_links using gin (tags) where deleted_at is null;

-- link_clicks: analytics queries
create index link_clicks_link_time on link_clicks (link_id, clicked_at desc);
create index link_clicks_site_time on link_clicks (site_id, clicked_at desc);
create index link_clicks_visitor_dedup on link_clicks (link_id, visitor_id) where visitor_id is not null;
create index link_clicks_referrer on link_clicks (link_id, referrer_source, clicked_at desc);
create index link_clicks_conversion on link_clicks (link_id, converted_at) where converted_at is not null;

-- link_daily_metrics: dashboard reads
create index link_daily_metrics_site_date on link_daily_metrics (site_id, date desc);
create index link_daily_metrics_link_range on link_daily_metrics (link_id, date desc);

-- link_annotations: chart overlay
create index link_annotations_range on link_annotations (link_id, annotated_at);

-- link_goals: cron check
create index link_goals_pending on link_goals (reached_at) where reached_at is null and deadline is not null;

-- link_alerts: evaluation cron
create index link_alerts_active on link_alerts (site_id, active) where active = true;
```

---

### 2.3 Partitioning Strategy

Both `tracked_links` and `link_clicks` use **monthly range partitions** on their timestamp columns.

```sql
-- Example: initial partition creation
create table tracked_links_2026_05 partition of tracked_links
  for values from ('2026-05-01') to ('2026-06-01');

create table link_clicks_2026_05 partition of link_clicks
  for values from ('2026-05-01') to ('2026-06-01');
```

**Auto-creation cron** (`/api/cron/create-link-partitions`, daily at `0 2 * * *`):

```sql
create or replace function create_monthly_partitions(p_months_ahead int default 2)
returns void language plpgsql as $$
declare
  m record;
  start_date date;
  end_date date;
  partition_name text;
begin
  for m in select generate_series(
    date_trunc('month', now()),
    date_trunc('month', now()) + (p_months_ahead || ' months')::interval,
    '1 month'::interval
  )::date as month_start
  loop
    start_date := m.month_start;
    end_date := start_date + '1 month'::interval;

    -- tracked_links
    partition_name := 'tracked_links_' || to_char(start_date, 'YYYY_MM');
    if not exists (select 1 from pg_class where relname = partition_name) then
      execute format(
        'create table %I partition of tracked_links for values from (%L) to (%L)',
        partition_name, start_date, end_date
      );
    end if;

    -- link_clicks
    partition_name := 'link_clicks_' || to_char(start_date, 'YYYY_MM');
    if not exists (select 1 from pg_class where relname = partition_name) then
      execute format(
        'create table %I partition of link_clicks for values from (%L) to (%L)',
        partition_name, start_date, end_date
      );
    end if;
  end loop;
end;
$$;
```

**Archival**: Partitions older than 24 months can be detached and moved to cold storage. `link_daily_metrics` retains indefinitely (small row count).

---

### 2.4 RLS Policies

All tables follow the ecosystem pattern: public read via `site_visible()`, staff bypass, write via `can_edit_site()`.

```sql
-- tracked_links
alter table tracked_links enable row level security;

drop policy if exists "public_read" on tracked_links;
create policy "public_read" on tracked_links for select
  using (site_visible(site_id) and deleted_at is null and active = true and is_internal = false);

drop policy if exists "staff_read_all" on tracked_links;
create policy "staff_read_all" on tracked_links for select
  using (can_view_site(site_id));

drop policy if exists "staff_write" on tracked_links;
create policy "staff_write" on tracked_links for all
  using (can_edit_site(site_id));

-- link_clicks (no public read — analytics are staff-only)
alter table link_clicks enable row level security;

drop policy if exists "staff_read" on link_clicks;
create policy "staff_read" on link_clicks for select
  using (can_view_site(site_id));

drop policy if exists "service_insert" on link_clicks;
create policy "service_insert" on link_clicks for insert
  with check (true);  -- edge function inserts via service_role

-- link_daily_metrics (staff read, service write)
alter table link_daily_metrics enable row level security;

drop policy if exists "staff_read" on link_daily_metrics;
create policy "staff_read" on link_daily_metrics for select
  using (can_view_site(site_id));

drop policy if exists "service_write" on link_daily_metrics;
create policy "service_write" on link_daily_metrics for all
  using (true);  -- aggregation cron runs as service_role

-- link_annotations, link_goals, link_alerts: staff read + write
-- (same pattern as tracked_links staff policies)
```

**Insert path for clicks**: The redirect edge function authenticates via `SUPABASE_SERVICE_ROLE_KEY` and inserts directly — no user context, bypasses RLS. This is intentional: click recording must never fail due to auth.

---

### 2.5 Newsletter Unification

Existing newsletter tracking merges into the link tracker to eliminate duplicate infrastructure.

#### Schema changes

```sql
-- newsletter_sends gains FK to tracked_links
alter table newsletter_sends add column link_id uuid references tracked_links(id);

-- newsletter_click_events becomes a VIEW (existing table dropped after migration)
drop table if exists newsletter_click_events;

create or replace view newsletter_click_events as
select
  lc.id,
  ns.id as send_id,
  lc.referrer_url as url,
  tl.destination_url,
  lc.ip,
  lc.user_agent,
  lc.clicked_at
from link_clicks lc
join tracked_links tl on tl.id = lc.link_id
join newsletter_sends ns on ns.link_id = tl.id and ns.subscriber_email = (
  select email from newsletter_subscriptions where id = ns.subscriber_id
)
where tl.source_type = 'newsletter';
```

#### Migration path

1. For each existing `newsletter_click_events` row, create a corresponding `tracked_links` record with `source_type='newsletter'` + `source_id = edition_id`, then insert into `link_clicks`.
2. Backfill `newsletter_sends.link_id` from the migrated tracked_links.
3. Replace the `newsletter_click_events` table with the VIEW.
4. Webhook handler (`/api/webhooks/resend`) updated to resolve `tracked_links.id` from the Resend `message_id` via `newsletter_sends.resend_message_id` and write to `link_clicks` instead of `newsletter_click_events`.

---

### 2.6 LGPD Compliance

#### 90-day PII anonymization cron

`/api/cron/anonymize-link-clicks` — Schedule: `0 3 * * *` (daily, 03:00 America/Sao_Paulo).

```sql
create or replace function anonymize_old_link_clicks(p_older_than_days int default 90)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  affected bigint;
begin
  update link_clicks
  set
    ip = null,
    user_agent = null,
    referrer_url = null,
    city = null
  where clicked_at < now() - (p_older_than_days || ' days')::interval
    and ip is not null;  -- skip already-anonymized rows

  get diagnostics affected = row_count;
  return affected;
end;
$$;
```

**Retained permanently** (non-PII):
- `visitor_id` — daily-rotating hash, cannot reconstruct source
- `country`, `region` — granularity insufficient for identification
- `referrer_domain` — domain only, no path/query
- `browser`, `os`, `device_type` — categorical, not identifying
- All `link_daily_metrics` data — already aggregated, no PII

**Data subject rights**: `link_clicks` rows are not linked to `auth.users` — they record anonymous visitors. No `user_id` is stored in clicks (separation of concerns). Newsletter subscriber deletion already handled by existing `unsubscribe_via_token` anonymization.

---

### 2.7 Triggers & Functions

```sql
-- Auto-update updated_at on tracked_links
create or replace function update_tracked_links_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracked_links_updated_at on tracked_links;
create trigger tracked_links_updated_at
  before update on tracked_links
  for each row execute function update_tracked_links_timestamp();

-- Generate unique short code (6 chars base62, retry on collision)
create or replace function generate_link_code(p_site_id uuid)
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text;
  i int;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * 62)::int + 1, 1);
    end loop;
    if not exists (select 1 from tracked_links where site_id = p_site_id and code = result) then
      return result;
    end if;
  end loop;
end;
$$;
```

---

### 2.8 Migration File Naming

```
supabase/migrations/
├── 20260506000001_link_tracker_types_and_tables.sql
├── 20260506000002_link_tracker_indexes.sql
├── 20260506000003_link_tracker_rls.sql
├── 20260506000004_link_tracker_functions.sql
├── 20260506000005_link_tracker_partitions_initial.sql
├── 20260506000006_newsletter_sends_link_id.sql
├── 20260506000007_newsletter_click_events_view.sql
└── 20260506000008_sites_short_domain.sql
```

---

## 3. Package Architecture

### Overview

Sprint 5f introduces two new packages to the `@tn-figueiredo/*` ecosystem:

| Package | Version | Responsibility |
|---------|---------|----------------|
| `@tn-figueiredo/links` | `0.1.0` | Core domain logic: link CRUD, click recording, redirect resolution, analytics aggregation, QR generation |
| `@tn-figueiredo/links-admin` | `0.1.0` | React UI components + hooks for CMS integration (dashboard, analytics, QR composer, alerts) |

Both packages follow the established DI pattern: interfaces defined in-package, implementations injected by the consuming app (`apps/web`). No direct database or infra coupling inside the packages.

---

### 3.1 `@tn-figueiredo/links@0.1.0`

#### Directory structure

```
packages/links/
├── src/
│   ├── index.ts                    # Core exports (services, types, interfaces)
│   ├── analytics.ts                # Subpath entry: ./analytics
│   ├── qr.ts                       # Subpath entry: ./qr
│   ├── types.ts                    # Shared domain types
│   ├── core/
│   │   ├── code-generator.ts       # nanoid-based, collision-safe short code generation
│   │   ├── link-service.ts         # CRUD orchestrator: create, update, deactivate, delete
│   │   ├── click-recorder.ts       # Hot path: record click with dedup + bot filter + metrics upsert
│   │   ├── redirect-resolver.ts    # Resolve code→destination with expiry/click-limit/password checks
│   │   ├── utm-parser.ts           # Parse/build UTM parameters from/to URL
│   │   ├── device-classifier.ts    # Classify device type, browser, OS from User-Agent
│   │   ├── referrer-classifier.ts  # Classify referrer into source categories
│   │   ├── visitor-id.ts           # sha256(ip + ua + date) anonymous visitor fingerprint
│   │   └── bot-filter.ts           # 12 known bot signatures
│   ├── analytics/
│   │   ├── aggregator.ts           # Daily metrics aggregation from raw clicks
│   │   ├── time-heatmap.ts         # 7×24 hourly heatmap computation
│   │   ├── prediction.ts           # Linear projection for goal completion estimates
│   │   ├── comparator.ts           # Period-over-period delta comparison
│   │   └── types.ts                # Analytics-specific types
│   ├── qr/
│   │   ├── generator.ts            # QR code matrix generation (qrcode lib)
│   │   ├── composer.ts             # Art overlay + QR composition logic
│   │   ├── aspect-ratios.ts        # 5 presets (1:1, 4:3, 16:9, 9:16, story) + custom
│   │   └── types.ts                # QR-specific types
│   └── interfaces/
│       ├── link-repository.ts      # ILinkRepository
│       ├── click-repository.ts     # IClickRepository
│       ├── metrics-repository.ts   # IMetricsRepository
│       ├── geo-resolver.ts         # IGeoResolver
│       ├── storage.ts              # IQrStorage
│       └── notifier.ts             # IAlertNotifier
├── migrations/
│   ├── 001_tracked_links.sql
│   ├── 002_link_clicks.sql
│   ├── 003_daily_metrics.sql
│   ├── 004_annotations_goals_alerts.sql
│   └── 005_newsletter_unification.sql
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

#### Subpath exports

```json
{
  "name": "@tn-figueiredo/links",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./analytics": {
      "types": "./dist/analytics.d.ts",
      "import": "./dist/analytics.js"
    },
    "./qr": {
      "types": "./dist/qr.d.ts",
      "import": "./dist/qr.js"
    },
    "./migrations": "./migrations/"
  },
  "files": ["dist", "migrations"],
  "scripts": {
    "build": "tsup",
    "prepare": "tsup"
  }
}
```

The `./migrations` subpath exports raw SQL files for the consuming app to copy into its `supabase/migrations/` directory with appropriate timestamps. Migrations are NOT auto-applied — the app controls schema versioning.

#### Interfaces (Dependency Injection contracts)

```typescript
// --- ILinkRepository ---
interface ILinkRepository {
  create(link: CreateLinkInput): Promise<TrackedLink>
  update(id: string, data: UpdateLinkInput): Promise<TrackedLink>
  findByCode(siteId: string, code: string): Promise<TrackedLink | null>
  findBySlug(siteId: string, slug: string): Promise<TrackedLink | null>
  findById(id: string): Promise<TrackedLink | null>
  list(siteId: string, filters: LinkFilters): Promise<PaginatedResult<TrackedLink>>
  softDelete(id: string): Promise<void>
  isCodeAvailable(siteId: string, code: string): Promise<boolean>
  isSlugAvailable(siteId: string, slug: string): Promise<boolean>
  incrementClicks(id: string, isUnique: boolean): Promise<void>
}

// --- IClickRepository ---
interface IClickRepository {
  record(click: RecordClickInput): Promise<void>
  isDuplicate(linkId: string, visitorId: string, windowSeconds: number): Promise<boolean>
  findByLink(linkId: string, filters: ClickFilters): Promise<PaginatedResult<LinkClick>>
  getRecentClicks(linkId: string, limit: number): Promise<LinkClick[]>
}

// --- IMetricsRepository ---
interface IMetricsRepository {
  upsertDaily(linkId: string, siteId: string, date: Date, delta: MetricsDelta): Promise<void>
  getRange(linkId: string, from: Date, to: Date): Promise<DailyMetric[]>
  getAggregated(linkId: string, from: Date, to: Date): Promise<AggregatedMetrics>
}

// --- IGeoResolver ---
interface IGeoResolver {
  resolve(ip: string): Promise<{ country: string; region: string; city: string } | null>
}

// --- IQrStorage ---
interface IQrStorage {
  upload(path: string, buffer: Buffer, contentType: string): Promise<string>
  delete(path: string): Promise<void>
}

// --- IAlertNotifier ---
interface IAlertNotifier {
  notify(alert: LinkAlert, context: AlertContext): Promise<void>
}
```

All interfaces are exported from the root entry point. The consuming app provides Supabase-backed implementations via a container/factory pattern (same as `@tn-figueiredo/lgpd` container).

#### Core services

**LinkService** — Orchestrates CRUD lifecycle:
- Validates destination URL via HEAD request (catches 404s before creation)
- Checks code/slug availability via repository before write
- Triggers QR generation on create when `qr_enabled: true`
- Manages soft-delete (sets `deleted_at`, preserves click history)
- Pure logic — no DB driver dependency

**ClickRecorder** — The hot path (called on every redirect):
1. Receives raw request data (ip, user_agent, referrer, url, headers)
2. Computes `visitor_id` via `sha256(ip + ua + YYYY-MM-DD)`
3. Runs bot filter — short-circuits if match (no record, no metrics)
4. Checks dedup via `IClickRepository.isDuplicate(linkId, visitorId, 30)`
5. Classifies device (type/browser/OS) and referrer (source category)
6. Calls `IGeoResolver.resolve(ip)` for country/region/city
7. Records click via `IClickRepository.record()`
8. Upserts daily metrics via `IMetricsRepository.upsertDaily()`
9. Evaluates active alerts (threshold checks)

Performance budget: entire pipeline must complete in <50ms P99 (geo resolution is the bottleneck — consuming app should use in-memory MaxMind or edge-local Cloudflare headers).

**RedirectResolver** — Resolves short code/slug to redirect response:
1. Lookup via `ILinkRepository.findByCode()` or `findBySlug()`
2. Check guards in order: `deleted_at` → `expires_at` → `click_limit` → `password_hash`
3. Build final URL: append UTM params if configured on link
4. Return `{ url, statusCode, link }` — status code per link config (301/302/307)
5. Returns `null` if link not found or any guard fails (consuming app renders 404/410/password page)

**CodeGenerator** — Collision-safe short code generation:
- Alphabet: `abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789` (56 chars — excludes confusable: `0/O`, `l/1/I`)
- Default length: 6 characters (56^6 = 30.8 billion combinations)
- Collision retry: max 3 attempts (collision probability negligible at <1M links)
- Custom codes: validated against reserved words list + slug format (`[a-zA-Z0-9-_]`)

#### Bot filter

Known bot signatures (User-Agent substring match, case-insensitive):

```typescript
const BOT_SIGNATURES = [
  'Googlebot', 'bingbot', 'Baiduspider', 'YandexBot',
  'DuckDuckBot', 'Slurp', 'facebookexternalhit', 'Twitterbot',
  'LinkedInBot', 'WhatsApp', 'TelegramBot', 'Amazonbot',
] as const
```

Bot clicks are silently dropped — no record, no metrics increment.

#### Click deduplication

Same `visitor_id` + `link_id` within a **30-second window** is treated as a duplicate and ignored. This prevents browser prefetch double-fires, accidental double-taps on mobile, and redirect chain retries.

Implementation: `IClickRepository.isDuplicate()` queries recent clicks with `clicked_at > now() - interval '30 seconds'`. The consuming app's Supabase implementation uses a partial index on `(link_id, visitor_id, clicked_at DESC)` for sub-millisecond lookups.

#### Visitor ID (anonymous fingerprint)

```typescript
function generateVisitorId(ip: string, userAgent: string): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return sha256(`${ip}|${userAgent}|${date}`).toString('hex')
}
```

Properties:
- **Anonymous**: irreversible hash, not PII under LGPD
- **No cookie required**: computed server-side from request metadata
- **Daily rotation**: same visitor gets new ID each calendar day
- **Deterministic within day**: enables dedup and unique visitor counting

#### Analytics subpath (`./analytics`)

Pure computation functions — no DB access:

- `aggregateDaily(clicks: LinkClick[]): DailyMetric`
- `computeHeatmap(metrics: DailyMetric[], timezone: string): HeatmapCell[][]`
- `projectGoal(current: number, goal: number, dailyRate: number): GoalProjection`
- `comparePeriods(current: AggregatedMetrics, previous: AggregatedMetrics): PeriodComparison`

#### QR subpath (`./qr`)

QR generation and composition logic:

- `generateQrMatrix(url: string, errorCorrection: 'L'|'M'|'Q'|'H'): QrMatrix`
- `composeQrImage(matrix: QrMatrix, options: QrComposerOptions): Buffer`
- `ASPECT_RATIOS` — 5 presets: `square` (1:1), `landscape` (4:3), `wide` (16:9), `portrait` (9:16), `story` (9:16 with padding)

Dependencies: `qrcode@1.5.x` (MIT, 45KB). Art composition uses canvas-less SVG manipulation for Edge compatibility.

---

### 3.2 `@tn-figueiredo/links-admin@0.1.0`

#### Directory structure

```
packages/links-admin/
├── src/
│   ├── index.ts                      # Re-exports all components + hooks
│   ├── components/
│   │   ├── LinksDashboard.tsx         # Overview table: filters, sort, bulk actions, pagination
│   │   ├── LinkCreateForm.tsx         # Full create/edit form: URL, code, UTMs, expiry, password, tags
│   │   ├── LinkAnalytics.tsx          # Analytics detail page: KPI cards + charts + breakdown
│   │   ├── QrComposer.tsx            # QR art composition panel: presets, colors, logo upload
│   │   ├── ClickLog.tsx              # Real-time click log table with geo/device columns
│   │   ├── HeatmapChart.tsx          # 7×24 hourly heatmap (SVG, no chart lib)
│   │   ├── TrendChart.tsx            # Bar chart with period comparison overlay
│   │   ├── FunnelChart.tsx           # Conversion funnel visualization
│   │   ├── GeoBreakdown.tsx          # Country/city breakdown table + world map
│   │   ├── DeviceBreakdown.tsx       # Device/browser/OS donut charts
│   │   ├── AiInsights.tsx            # AI-generated insights sidebar
│   │   ├── GoalRing.tsx              # Circular progress ring for click goals
│   │   ├── AnnotationLayer.tsx       # Timeline annotation markers on charts
│   │   ├── RevenueAttribution.tsx    # Revenue per link attribution table
│   │   ├── AbComparison.tsx          # A/B split test comparison cards
│   │   ├── ClickReplay.tsx           # Geo timelapse animation (clicks on map)
│   │   ├── ShareReportCard.tsx       # Branded PNG/PDF export card
│   │   └── AlertsPanel.tsx           # Custom alerts configuration UI
│   └── hooks/
│       ├── useLinks.ts               # SWR/fetch for link list + mutations
│       ├── useClickStream.ts         # SSE subscription for live click feed
│       ├── useAnalytics.ts           # Analytics data fetching + date range state
│       └── useQrComposer.ts          # QR composer local state + preview generation
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

#### Server actions pattern

Following the established `@tn-figueiredo/cms` PostEditor pattern, `links-admin` components **never** import or define server actions. The consuming app defines server actions and passes them as callback props:

```typescript
// apps/web/src/app/cms/(authed)/links/page.tsx (server component)
import { LinksDashboard } from '@tn-figueiredo/links-admin'
import { getLinks, deleteLink, bulkDeactivate } from './actions'

export default async function LinksPage() {
  const links = await getLinks()
  return (
    <LinksDashboard
      initialLinks={links}
      onDelete={deleteLink}
      onBulkDeactivate={bulkDeactivate}
      onRefresh={getLinks}
    />
  )
}
```

#### Hooks

- **`useLinks(fetchFn)`** — pagination, sorting, filter state, optimistic delete
- **`useClickStream(url)`** — EventSource connection with auto-reconnect, exposes `clicks[]` + `isConnected`
- **`useAnalytics(fetchFn, initialRange)`** — date range picker state, cached responses, comparison toggle
- **`useQrComposer()`** — local-only state for QR preview: colors, logo, aspect ratio, error correction level

Hooks accept fetch functions as arguments (not hardcoded endpoints), maintaining the DI principle at the UI layer.

---

### 3.3 Consuming App Integration (`apps/web`)

#### `next.config.ts`

```typescript
transpilePackages: [
  '@tn-figueiredo/cms',
  '@tn-figueiredo/newsletter',
  '@tn-figueiredo/newsletter-admin',
  '@tn-figueiredo/links',        // NEW
  '@tn-figueiredo/links-admin',  // NEW
]
```

#### Container pattern (`apps/web/src/lib/links/container.ts`)

```typescript
import { LinkService, ClickRecorder, RedirectResolver } from '@tn-figueiredo/links'
import { SupabaseLinkRepository } from './adapters/link-repository'
import { SupabaseClickRepository } from './adapters/click-repository'
import { SupabaseMetricsRepository } from './adapters/metrics-repository'
import { CloudflareGeoResolver } from './adapters/geo-resolver'
import { SupabaseQrStorage } from './adapters/qr-storage'
import { EmailAlertNotifier } from './adapters/alert-notifier'

export function getLinkService(): LinkService {
  return new LinkService({
    linkRepo: new SupabaseLinkRepository(getSupabaseServiceClient()),
    qrStorage: new SupabaseQrStorage(getSupabaseServiceClient()),
  })
}

export function getClickRecorder(): ClickRecorder {
  return new ClickRecorder({
    clickRepo: new SupabaseClickRepository(getSupabaseServiceClient()),
    metricsRepo: new SupabaseMetricsRepository(getSupabaseServiceClient()),
    linkRepo: new SupabaseLinkRepository(getSupabaseServiceClient()),
    geoResolver: new CloudflareGeoResolver(),
    notifier: new EmailAlertNotifier(),
  })
}

export function getRedirectResolver(): RedirectResolver {
  return new RedirectResolver({
    linkRepo: new SupabaseLinkRepository(getSupabaseServiceClient()),
  })
}
```

#### Version pinning

Per ecosystem convention, versions are pinned exact (no `^` or `~`):

```json
{
  "@tn-figueiredo/links": "0.1.0",
  "@tn-figueiredo/links-admin": "0.1.0"
}
```

---

### 3.4 Build Configuration (`tsup.config.ts`)

Both packages use identical tsup configuration:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    analytics: 'src/analytics.ts', // links only
    qr: 'src/qr.ts',              // links only
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  external: ['react', 'react-dom'], // links-admin only
  jsx: 'preserve',                  // links-admin only
})
```

Output: ESM-only, TypeScript declarations, tree-shakeable. No CJS dual-publish.

---

### 3.5 Dependency Graph

```
@tn-figueiredo/links@0.1.0
├── nanoid (code generation)
├── qrcode (QR matrix — via ./qr subpath, tree-shaken if unused)
└── (zero runtime deps for core + analytics subpaths)

@tn-figueiredo/links-admin@0.1.0
├── @tn-figueiredo/links (types only — TrackedLink, LinkClick, etc.)
└── react, react-dom (peer)
```

The `links` core package has near-zero dependencies for the hot redirect path. The `qrcode` dependency is isolated behind the `./qr` subpath and tree-shaken out when only `./` or `./analytics` are imported.

---

## 4. Infrastructure, Integration, and Operations

### 4.1 Subdomain Routing

#### DNS Setup (per site)

| Provider | Record | Value | Notes |
|----------|--------|-------|-------|
| Cloudflare | CNAME `go` | `cname.vercel-dns.com` | Proxied (orange cloud) for geo headers |
| Vercel | Custom domain | `go.{domain}.com` | Added to same project as primary domain |

Because Cloudflare proxies the `go.*` subdomain, all requests arrive with `cf-ipcountry`, `cf-ipcity`, and `cf-ipregion` headers — enabling free geo resolution without external API calls.

#### Middleware Handling

The existing middleware (`apps/web/src/middleware.ts`) resolves `Host → site_id` via `SupabaseRingContext.getSiteByDomain()`. Extension for short links:

```typescript
if (host.startsWith('go.')) {
  const baseDomain = host.slice(3)
  const site = await SupabaseRingContext.getSiteByDomain(baseDomain)
  const code = pathname.slice(1)

  if (!site || !code) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = `/go/${code}`

  const res = NextResponse.rewrite(url)
  res.headers.set('x-site-id', site.id)
  res.headers.set('x-short-domain', host)
  return res
}
```

Short-link paths (`/go/[code]`) are excluded from locale-prefix rewrite logic. The middleware short-circuits before reaching i18n or CMS routing branches.

#### Redirect Route: `app/go/[code]/route.ts`

```typescript
export const runtime = 'edge'
```

Request flow:
1. Read `x-site-id` header from middleware.
2. Call `RedirectResolver.resolve(siteId, code)` — hits `unstable_cache` first, DB on miss.
3. Evaluate link state:
   - **Active + valid** → record click via `waitUntil` (fire-and-forget), return redirect response (301/302/307).
   - **Expired** → redirect to `expired_url` if configured, otherwise return `410 Gone`.
   - **Password protected** → redirect to `/go/[code]/auth` (interstitial password page).
   - **Click limit reached** → same behavior as expired.
   - **Not found** → `404` with branded error page.
   - **Bot detected** → redirect normally but skip click recording.

#### Performance Requirements

| Metric | Target | Strategy |
|--------|--------|----------|
| Redirect latency (p95) | < 50ms | Edge runtime + in-memory cache |
| Redirect latency (p99) | < 100ms | DB query as fallback only on cache miss |
| Click recording | Non-blocking | `waitUntil` — response sent before DB write |
| Cache hit rate | > 95% | 60s TTL with tag-based invalidation |

Cache strategy:

```typescript
const link = await unstable_cache(
  () => db.tracked_links.findByCode(siteId, code),
  [`link:${siteId}:${code}`],
  { tags: [`link:${siteId}:${code}`], revalidate: 60 }
)()
```

Invalidation occurs on link update/delete/toggle/expiry via `revalidateTag(`link:${siteId}:${code}`)`.

---

### 4.2 Newsletter Unification

#### Migration Strategy (gradual, non-breaking)

The existing `newsletter_click_events` table (Sprint 5e) continues to serve historical data. New newsletter clicks flow through the unified link tracker.

**Phase 1 — Schema extension:**

```sql
ALTER TABLE newsletter_sends ADD COLUMN link_id uuid REFERENCES tracked_links(id) ON DELETE SET NULL;
```

**Phase 2 — Compatibility view:**

```sql
CREATE VIEW newsletter_click_events_unified AS
SELECT lc.id, ns.edition_id, ns.subscriber_email, lc.destination_url AS url, lc.ip, lc.user_agent, lc.clicked_at
FROM link_clicks lc
JOIN tracked_links tl ON tl.id = lc.link_id
JOIN newsletter_sends ns ON ns.link_id = tl.id
WHERE tl.source_type = 'newsletter';
```

**Phase 3 — Email link rewriting:**

When sending newsletter editions, the pipeline rewrites destination URLs:
1. Parse HTML for all `<a href="...">` elements.
2. For each unique destination URL: create or reuse a `tracked_link` with `source_type = 'newsletter'`, `source_id = edition_id`.
3. Replace `href` with `https://go.{domain}/{code}?utm_source=newsletter&utm_medium=email&utm_campaign={edition_slug}`.
4. Populate `newsletter_sends.link_id` for correlation.

Gated behind `LINKS_NEWSLETTER_REWRITE_ENABLED` (default `false`). Enabled per-site after verifying deliverability is unaffected.

---

### 4.3 Cron Jobs

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/links-aggregate-metrics` | `*/5 * * * *` (every 5 min) | Aggregate recent clicks into `link_daily_metrics` |
| `/api/cron/links-anonymize-clicks` | `0 4 * * *` (daily 04:00 BRT) | 90-day LGPD anonymization of PII fields |
| `/api/cron/links-check-alerts` | `*/15 * * * *` (every 15 min) | Evaluate alert conditions, trigger notifications |
| `/api/cron/links-check-expiry` | `0 * * * *` (hourly) | Deactivate expired links |
| `/api/cron/links-partition-maintenance` | `0 0 1 * *` (1st of month) | Create next month's partitions |

All crons follow the established `cron_try_lock` / `cron_unlock` pattern (Sprint 3). Each protected by `Authorization: Bearer ${CRON_SECRET}` and uses structured logger (`lib/logger.ts`).

**Aggregation cron** uses a watermark table (`link_aggregation_state`) to avoid re-scanning the full `link_clicks` table on each run.

---

### 4.4 Feature Flags

| Flag | Default | Scope | Controls |
|------|---------|-------|----------|
| `NEXT_PUBLIC_LINKS_ENABLED` | `true` | client + server | CMS sidebar menu item, `/cms/links/*` page visibility |
| `LINKS_AI_INSIGHTS_ENABLED` | `true` | server | AI insights sidebar panel rendering |
| `LINKS_LIVE_PULSE_ENABLED` | `true` | server | SSE endpoint availability |
| `LINKS_NEWSLETTER_REWRITE_ENABLED` | `false` | server | Newsletter URL rewriting in send pipeline |
| `LINKS_REVENUE_TRACKING_ENABLED` | `true` | server | Revenue attribution UI + conversion tracking |

Initial prod state: newsletter rewrite `false` (gradual rollout), all others `true`.

---

### 4.5 Environment Variables (3 new)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `LINKS_GEO_PROVIDER` | no | `cloudflare-headers` | Geo resolution strategy |
| `MAXMIND_LICENSE_KEY` | if `LINKS_GEO_PROVIDER=maxmind` | — | MaxMind GeoLite2 API key |
| `LINKS_CACHE_TTL` | no | `60` | Redirect resolution cache TTL in seconds |

#### Geo Resolution Strategy

| Provider | Latency | Cost | Accuracy |
|----------|---------|------|----------|
| `cloudflare-headers` (default) | 0ms | Free | City-level (CF proxy on `go.*`) |
| `maxmind` | ~5ms | Free tier (GeoLite2) | City-level |
| `ipinfo` | ~20ms | Free tier 50k/mo | City-level |

Default: read Cloudflare headers (`cf-ipcountry`, `cf-ipcity`, `cf-ipregion`). Zero latency, zero cost.

---

### 4.6 Real-time Click Feed (SSE)

Endpoint: `app/api/links/[id]/stream/route.ts`

```typescript
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
```

- **Auth:** Staff-only (validated via `requireArea('cms')`)
- **Mechanism:** Polls `link_clicks` every 2 seconds for records with `clicked_at > last_seen_at`
- **Payload:** Streams JSON objects per click: `{id, country, city, device_type, browser, referrer_domain, clicked_at}`
- **Connection:** Auto-closes after 5 minutes of inactivity. Client reconnects via `EventSource` retry.

**v2 future:** Upgrade to Supabase Realtime (`postgres_changes`) when volume justifies. Hook interface remains unchanged.

---

### 4.7 AI Insights Engine (v1 — Rule-Based)

v1 is a deterministic rule engine. No LLMs or external API calls.

| # | Rule | Condition | Output |
|---|------|-----------|--------|
| 1 | Spike detection | Today's clicks > 2× rolling 7-day average | "Traffic spike of {X}% detected today" |
| 2 | Source correlation | Spike within ±2h of an annotation timestamp | "Correlates with annotation: {label}" |
| 3 | Best time to share | Top 3 hourly slots from 28-day heatmap | "Best times: {Day} {Hour}–{Hour}" |
| 4 | Device insight | One device type converts >20% higher than others | "{Device} converts {X}% better than average" |
| 5 | Geo trend | Country grows >15% week-over-week for 3+ consecutive weeks | "{Country} growing +{X}% w/w" |
| 6 | Source efficiency | Source with highest conversion rate (>10 clicks minimum) | "{Source} has best conversion at {X}%" |

Cached for 1 hour via `unstable_cache`. Returns max 5 insights sorted by relevance score (recency × magnitude).

---

### 4.8 Sentry Tags

| Tag | Values | Example filter |
|-----|--------|---------------|
| `links` | `true` | `links:true last:24h` |
| `component` | `redirect`, `click-recorder`, `analytics`, `qr-composer`, `cron` | `links:true component:redirect` |

---

### 4.9 Cache Invalidation Tags

| Tag Pattern | Invalidated By | Effect |
|-------------|---------------|--------|
| `link:{siteId}:{code}` | `updateLink`, `deleteLink`, `toggleActive`, expiry cron | Redirect resolver cache miss |
| `link:{siteId}:{slug}` | Same as above | Slug-based lookups refresh |
| `links:list:{siteId}` | Any link create/update/delete | CMS link list page refetch |
| `link:analytics:{linkId}` | Metrics aggregation cron (every 5 min) | Analytics page + AI insights refetch |

---

## 5. CMS UI Pages and Routes

### Route Map

| Route | File Path | Page | Purpose |
|-------|-----------|------|---------|
| `/cms/links` | `app/cms/(authed)/links/page.tsx` | Dashboard | Link list with filters, sorting, bulk actions, mini analytics |
| `/cms/links/new` | `app/cms/(authed)/links/new/page.tsx` | Create | Full link creation form + QR composer (split layout) |
| `/cms/links/[id]` | `app/cms/(authed)/links/[id]/page.tsx` | Analytics | Per-link analytics detail with charts and rule-based insights |
| `/cms/links/[id]/edit` | `app/cms/(authed)/links/[id]/edit/page.tsx` | Edit | Edit link settings (same form as create, pre-filled) |
| `/cms/links/[id]/qr` | `app/cms/(authed)/links/[id]/qr/page.tsx` | QR Editor | Standalone QR composer for existing link |
| `/cms/links/settings` | `app/cms/(authed)/links/settings/page.tsx` | Settings | Default UTM presets, alert preferences, template management |

Shared components in `app/cms/(authed)/links/_components/`. Server actions in `app/cms/(authed)/links/actions.ts`.

---

### 5.1 Dashboard (`/cms/links`)

#### Layout

```
┌────────���────────────────────────────────────────────────────────────┐
│  Links                          [site selector ▾]    [+ Novo Link]  │
├─────────────────────────────────────────────────────────────────────┤
│  Search  │ Source: [ALL] [MANUAL] [CAMPAIGN] [NEWSLETTER] [SOCIAL] [PRINT] │
│  Tags: [▾]  │ Status: [active|expired|deleted] │ INT/EXT │ Date ▾  │
├─────────────────────────────────────────────────────────────────────┤
│  Bulk: [Delete] [Activate] [Deactivate] [Export] [Add Tags]        │
├──────┬────────────────┬──────────┬────┬────┬─────┬──────┬──────┬───┤
│  ☐   │ Short URL      │ Dest.    │ 7d │ Clk│ Uniq│ Conv%│ Src  │ ⋮ │
├──────┼────────────────┼──────────┼────┼────┼─────┼──────┼──────┼───┤
│  ☐   │ go/abc123  [cp]│ example… │ ▂▄▆│ 342│ 289 │ 4.2% │ UTM  │ ⋮ │
│  ☐   │ go/launch  [cp]│ produc…  │ ▁▃▅│ 1.2k│ 980│ 6.1% │ QR   │ ⋮ │
└──────┴────────────────┴──────────┴────┴────┴─────┴──────┴──────┴───┘
│                    ← 1 2 3 ... 12 →  (cursor-based, 25/page)        │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `LinksDashboard` | `_components/links-dashboard.tsx` | Page orchestrator, fetches initial data via RSC |
| `LinksFilterBar` | `_components/links-filter-bar.tsx` | Client component, controls filter state |
| `LinksTable` | `_components/links-table.tsx` | Sortable columns, row selection, sparklines |
| `LinkRow` | `_components/link-row.tsx` | Row with copy, badges (INT/EXT, QR, tags), actions dropdown |
| `BulkActionsBar` | `_components/bulk-actions-bar.tsx` | Conditional render on selection |
| `LinksPagination` | `_components/links-pagination.tsx` | Cursor-based pagination controls |
| `LinksEmptyState` | `_components/links-empty-state.tsx` | Illustration + CTA when zero links |

#### Key Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Navigate to Analytics | Click row | `router.push(/cms/links/${id})` |
| Multi-select | Shift+click checkbox | Select range, show bulk bar |
| Create link | `N` key or button | `router.push(/cms/links/new)` |
| Focus search | `F` key | Focus search input |
| Copy short URL | Click copy icon | Clipboard API + toast |

Pagination: Cursor-based using `created_at` + `id` composite cursor. Page size: 25.

---

### 5.2 Create Link (`/cms/links/new`)

#### Layout: 2-Column Split

```
┌──────────────────────────────────┬─────────────────────────────┐
│  LEFT (60%) — Form               │  RIGHT (40%) — QR Composer  │
│                                  │  (visible when QR toggle ON) │
│  1. Destination (URL + INT/EXT)  │  Tabs: Editor │ Mobile │Print│
│  2. Identifier (code/slug)       │  [Live QR Preview]          │
│  3. Classification (source/tags) │  Aspect/Position/Size/Color │
│  4. UTM Builder (presets)        │  Art upload / Logo upload   │
│  5. Behavior (redirect/expiry)   │  Export formats             │
│  6. Options (QR/conv/password)   │  Templates save/load        │
│                                  │                              │
│  [Criar Link]  [Salvar Rascunho] │                              │
└──────────────────────────────────┴──────────────────────────────┘
```

#### Form Sections

**1. Destination**
- URL input with live HEAD validation (debounced 500ms)
- Auto-detection of INT/EXT from URL domain vs `sites.primary_domain`
- Status badge shown immediately below input

**2. Identifier**
- Auto-generated 6-char nanoid on page load (regenerate dice icon)
- Optional slug field (3-60 chars, alphanumeric + hyphens)
- Sticky preview bar: `{short_domain}/{slug || code}`
- Availability check: debounced 300ms

**3. Classification**
- Source type: 6 radio pills mapping to DB `link_source_type` enum:
  - `manual` (default) — manually created, no specific origin
  - `campaign` — tied to a CMS campaign (`source_id` → campaign)
  - `newsletter` — tied to a newsletter edition (`source_id` → edition)
  - `blog` — tied to a blog post (`source_id` → post)
  - `social` — created for social media distribution
  - `print` — created for print materials (flyers, QR posters)
- Title: free text, max 120 chars
- Tags: combobox with autocomplete, create-on-type, max 10

**4. UTM Builder**
- Presets dropdown from `utm_presets` table
- 4 UTM fields with live final URL preview
- Duplicate param warning

**5. Behavior**
- Redirect type: 302 (default), 301, 307 as cards
- Expiry date picker (must be future)
- Click limit (positive integer)
- Fallback URL

**6. Options**
- Generate QR toggle (reveals right panel)
- Conversion tracking toggle
- Password protection toggle (reveals password input)

#### QR Composer Panel

- Mode tabs: Editor, Preview Mobile, Preview Print
- Aspect ratio: 5 presets + Custom
- Position: 9-point grid
- Size/Padding/Radius sliders
- Colors: foreground, background, border
- Art/Logo upload (PNG/JPG/WebP, max 5MB)
- Scan text (locale-aware default)
- Export formats (SVG, PNG@1-3x, PDF, WebP)
- Template system (save/load configs)

#### Validation

| Field | Rule | Error |
|-------|------|-------|
| `destination_url` | Required, valid HTTP(S), reachable | "URL obrigatoria" / "URL inacessivel" |
| `code` | Required if no slug, unique, 4-12 chars | "Codigo ja em uso" |
| `slug` | If provided: unique, 3-60 chars, `[a-z0-9-]` | "Slug ja em uso" |
| `expiry_date` | If set: must be future | "Data deve ser futura" |
| `password` | If enabled: min 4 chars | "Minimo 4 caracteres" |

Client-side Zod + server-side same schema. `ValidationSummary` shows 3 aggregate checks (URL/Identifier/QR).

#### Auto-save

Draft state to `localStorage` key `link-draft-{siteId}` every 5s. Prompt on page load if draft < 24h old.

---

### 5.3 Analytics (`/cms/links/[id]`)

#### Layout

```
┌─────────────────────────────────────────────────────────────┬──────────┐
│  MAIN CONTENT                                               │ AI SIDE  │
│                                                             │ (280px)  │
│  1. Link Header (short URL, dest, meta badges)              │          │
│  2. Live Pulse (rate, last click, spark bars)               │ Insights │
│  3. Goal Ring (progress, pace, deadline)                    │ ──────── │
│  4. Date Range Controls ([24h][7d][30d][90d][1y][All])      │ 6 cards  │
│  5. KPI Cards (clicks/uniques/conv%/revenue/bots)           │          │
│  6. Trend Chart (bars + annotations + projection)           │ 7d Pred. │
│  7. Revenue Attribution (ROI, avg ticket, by source)        │          │
│  8. Heatmap + Devices (2-col)                              │ Actions  │
│  9. Geography + Referrers (2-col)                          │          │
│ 10. A/B Comparison (side-by-side vs another link)           │          │
│ 11. Click Replay (animated world map)                       │          │
│ 12. Funnel (clicks → uniques → conversions)                │          │
│ 13. UTM Breakdown (hierarchical table)                      │          │
│ 14. Click Log (live, filterable)                           │          │
│ 15. Report Card (shareable PNG/PDF export)                  │          │
│ 16. Alerts Panel (threshold/drop/spike config)              │          │
└─────────────────────────────────────────────────────────────┴──────────┘
```

#### AI Sidebar (280px, sticky)

- Collapses to icon rail on viewport < 1100px
- 6 contextual insight cards from rule-based engine:
  1. Peak hours — best heatmap slots
  2. Geo shift — country growth week-over-week
  3. Conversion trend — direction + delta
  4. Bot detection — spike alerts
  5. UTM winner — highest-converting source
  6. Recommendation — actionable suggestion
- 7-day prediction chart with confidence interval
- Quick actions: Adjust goal, Add UTM, Create A/B, Export

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `J`/`K` | Scroll to next/previous section |
| `E` | Navigate to edit |
| `Q` | Navigate to QR editor |
| `C` | Copy short URL |
| `X` | Export/share dialog |
| `A` | Add annotation |
| `R` | Toggle click replay |
| `S` | Generate share report |
| `?` | Show shortcuts overlay |

---

### 5.4 Edit Link (`/cms/links/[id]/edit`)

Same `LinkForm` as Create with:
- `mode="edit"` prop, pre-filled data
- Code field read-only (cannot change after creation)
- Slug field editable (availability re-check excluding current)
- "Danger zone" section: Deactivate, Delete (with confirmation modal)

---

### 5.5 QR Editor (`/cms/links/[id]/qr`)

Standalone full-width `QrComposer`:
- Pre-loads existing `qr_config` from JSONB
- Auto-saves via debounced server action (1s)
- Export generates files server-side, uploads to Storage, returns signed URLs
- Full-width layout maximizes canvas preview

---

### 5.6 Settings (`/cms/links/settings`)

| Section | Purpose |
|---------|---------|
| UTM Presets | CRUD list of saved UTM combinations |
| Short Domain | Read-only display + DNS status |
| Alert Preferences | Default channel, max frequency, quiet hours |
| QR Templates | Saved configs with thumbnail previews |
| Default Behavior | Site-wide defaults: redirect type, code length, auto-QR, bot filtering |

Data stored in `link_settings` table (one row per site_id, JSONB config).

---

### 5.7 Server Actions

All actions in `app/cms/(authed)/links/actions.ts`. Each: Zod validation, `requireSitePermission(siteId, 'editor')`, service-role client, `revalidatePath` on mutation.

| Action | Purpose |
|--------|---------|
| `createLink` | Insert tracked_link + QR assets |
| `updateLink` | Update row, regenerate QR if config changed |
| `deleteLink` | Soft delete (`deleted_at = now()`) |
| `duplicateLink` | Clone with new code, zero stats |
| `toggleLinkActive` | Activate/deactivate |
| `bulkDeleteLinks` | Batch soft delete (max 100) |
| `bulkToggleLinks` | Batch activate/deactivate (max 100) |
| `checkCodeAvailable` | Uniqueness check |
| `checkSlugAvailable` | Uniqueness check (with exclude for edit) |
| `validateDestinationUrl` | HEAD request, returns status/final URL/timing |
| `exportQrComposition` | Render + upload + return signed URLs |
| `updateQrConfig` | Update JSONB config |
| `createAnnotation` | Insert annotation |
| `createGoal` | Insert/update goal |
| `createAlert` | Insert alert |
| `toggleAlert` | Toggle active state |
| `generateShareReport` | Render analytics PNG server-side |
| `getAiInsights` | Compute rule-based insights |
| `saveLinkSettings` | Upsert site settings |
| `saveUtmPreset` / `deleteUtmPreset` | CRUD presets |
| `saveQrTemplate` / `deleteQrTemplate` | CRUD templates |

---

### 5.8 Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| >= 1280px | Full layout — all columns, AI sidebar visible |
| 1100-1279px | AI sidebar collapses to icon rail |
| 768-1099px | Create form stacks, Analytics single-column, table horizontal scroll |
| < 768px | Mobile: bottom sheet filters, card layout, QR fullscreen overlay |

---

### 5.9 Accessibility

- All interactive elements keyboard-navigable
- ARIA labels on icon-only buttons
- WCAG 2.1 AA color contrast (4.5:1 minimum)
- Chart `aria-label` with textual summary
- Toast notifications `role="status"`, bulk results `role="alert"`
- Focus trap in modals
- `prefers-reduced-motion` respected for animations

---

## 6. Visual References

Design mockups for all 4 primary CMS pages are available at:

```
.superpowers/brainstorm/95602-1778027933/content/
├── cms-links-overview-v4.html       # Dashboard (98/100)
├── cms-links-create-full-v2.html    # Create page (98/100)
├── cms-links-analytics-v3.html      # Analytics page (110/100)
└── cms-links-qr-composer-v4.html    # QR Composer (98/100)
```

---

## 7. Scope Boundaries

### In scope (Sprint 5f)
- All database tables, indexes, partitioning, RLS, functions, migrations
- Both packages (`@tn-figueiredo/links`, `@tn-figueiredo/links-admin`)
- All 6 CMS pages with full component breakdown
- Edge redirect route with `waitUntil` click recording
- Middleware extension for `go.*` subdomain
- 5 cron jobs (aggregate, anonymize, alerts, expiry, partition maintenance)
- Newsletter unification (schema + view + link rewriting)
- SSE live click feed
- Rule-based AI insights (6 rules)
- QR art composition with 5 aspect ratios
- Feature flags (5), env vars (3)
- Sentry tags + cache invalidation tags

### Out of scope (future sprints)
- LLM-powered AI insights (v2)
- Supabase Realtime (v2)
- Public shareable analytics pages (v2)
- Multi-arm bandit A/B testing (v2)
- Custom conversion pixel builder (v2)
- Drag-and-drop link reordering
- Bio link page builder
- Team collaboration features (comments on links)
- Slack/webhook alert channels (v1 = email only)
- Link bulk import (CSV upload)
