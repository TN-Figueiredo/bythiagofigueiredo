# @tn-figueiredo/cms-admin — Complete CMS Admin Package

## Goal

Extract all CMS admin pages, components, queries, and actions from `bythiagofigueiredo` into a single reusable package `@tn-figueiredo/cms-admin`. Any app in the `@tn-figueiredo/*` ecosystem installs this package and gets a complete CMS with ~200 lines of consumer wiring (vs ~7,500 lines today).

## Architecture

**Monolith with subpath exports.** One package containing 8 domains (blog, campaigns, newsletters, subscribers, analytics, schedule, contacts, dashboard). Consumers import only the domains they need via subpath imports. ESM tree-shaking ensures unused domains don't enter the bundle.

**Three-layer pattern** (consistent with `@tn-figueiredo/newsletter-admin`):

1. **Queries** — server-safe fetch helpers. Receive `SupabaseClient` + `siteId` via the factory. Return typed results.
2. **Actions** — server-safe mutation factories. Same injection pattern. Return async functions ready to be re-exported as `'use server'`.
3. **Components** — `'use client'` presentational components. Zero Supabase dependency. Data + callbacks via props.

**Factory pattern** — `createCmsAdmin(config)` returns a pre-wired object with all queries and actions. Consumer creates it once, uses it everywhere.

## Tech Stack

- **Build:** tsup (ESM + CJS + DTS, code splitting, externals)
- **CSS:** postcss + @tailwindcss/postcss (extends cms-ui tokens)
- **Test:** vitest + @testing-library/react + happy-dom
- **Peer deps:** react >=19, react-dom >=19, next >=15, @supabase/supabase-js ^2
- **Dependencies:** @tn-figueiredo/cms, @tn-figueiredo/cms-ui, @tn-figueiredo/newsletter (types only)

## Package Exports

```jsonc
{
  "exports": {
    ".":                           { "types": "./dist/index.d.ts",                    "import": "./dist/index.js",                    "require": "./dist/index.cjs" },
    "./blog":                      { "types": "./dist/blog/index.d.ts",               "import": "./dist/blog/index.js",               "require": "./dist/blog/index.cjs" },
    "./blog/client":               { "types": "./dist/blog/client.d.ts",              "import": "./dist/blog/client.js",              "require": "./dist/blog/client.cjs" },
    "./campaigns":                 { "types": "./dist/campaigns/index.d.ts",          "import": "./dist/campaigns/index.js",          "require": "./dist/campaigns/index.cjs" },
    "./campaigns/client":          { "types": "./dist/campaigns/client.d.ts",         "import": "./dist/campaigns/client.js",         "require": "./dist/campaigns/client.cjs" },
    "./newsletters":               { "types": "./dist/newsletters/index.d.ts",        "import": "./dist/newsletters/index.js",        "require": "./dist/newsletters/index.cjs" },
    "./newsletters/client":        { "types": "./dist/newsletters/client.d.ts",       "import": "./dist/newsletters/client.js",       "require": "./dist/newsletters/client.cjs" },
    "./subscribers":               { "types": "./dist/subscribers/index.d.ts",        "import": "./dist/subscribers/index.js",        "require": "./dist/subscribers/index.cjs" },
    "./subscribers/client":        { "types": "./dist/subscribers/client.d.ts",       "import": "./dist/subscribers/client.js",       "require": "./dist/subscribers/client.cjs" },
    "./analytics/client":          { "types": "./dist/analytics/client.d.ts",         "import": "./dist/analytics/client.js",         "require": "./dist/analytics/client.cjs" },
    "./schedule":                  { "types": "./dist/schedule/index.d.ts",           "import": "./dist/schedule/index.js",           "require": "./dist/schedule/index.cjs" },
    "./schedule/client":           { "types": "./dist/schedule/client.d.ts",          "import": "./dist/schedule/client.js",          "require": "./dist/schedule/client.cjs" },
    "./contacts":                  { "types": "./dist/contacts/index.d.ts",           "import": "./dist/contacts/index.js",           "require": "./dist/contacts/index.cjs" },
    "./contacts/client":           { "types": "./dist/contacts/client.d.ts",          "import": "./dist/contacts/client.js",          "require": "./dist/contacts/client.cjs" },
    "./dashboard/client":          { "types": "./dist/dashboard/client.d.ts",         "import": "./dist/dashboard/client.js",         "require": "./dist/dashboard/client.cjs" },
    "./client":                    { "types": "./dist/client.d.ts",                   "import": "./dist/client.js",                   "require": "./dist/client.cjs" },
    "./styles.css":                "./dist/styles.css"
  }
}
```

## Factory: `createCmsAdmin(config)`

```typescript
interface CmsAdminConfig {
  getClient: () => SupabaseClient
  getSiteContext: () => Promise<{ siteId: string; orgId: string; defaultLocale: string }>
  requireAuth?: () => Promise<void>
  revalidatePath?: (path: string) => void
  revalidateTag?: (tag: string) => void
}

interface CmsAdmin {
  blog: {
    list: (params: BlogListParams) => Promise<BlogListResult>
    getById: (id: string) => Promise<BlogPostDetail>
    getForEdit: (id: string) => Promise<BlogEditData>
    actions: {
      savePost: (id: string, data: SavePostInput) => Promise<ActionResult>
      publishPost: (id: string) => Promise<void>
      unpublishPost: (id: string) => Promise<void>
      archivePost: (id: string) => Promise<void>
      deletePost: (id: string) => Promise<DeleteResult>
      compilePreview: (source: string) => Promise<CompiledMdx>
      uploadAsset: (file: File, postId: string) => Promise<{ url: string }>
    }
  }
  campaigns: {
    list: (params: CampaignListParams) => Promise<CampaignListResult>
    getById: (id: string) => Promise<CampaignDetail>
    getForEdit: (id: string) => Promise<CampaignEditData>
    getKpis: () => Promise<CampaignKpisData>
    actions: {
      createCampaign: (data: CreateCampaignInput) => Promise<ActionResult>
      saveCampaign: (id: string, data: SaveCampaignInput) => Promise<ActionResult>
      publishCampaign: (id: string) => Promise<void>
      unpublishCampaign: (id: string) => Promise<void>
      archiveCampaign: (id: string) => Promise<void>
      deleteCampaign: (id: string) => Promise<DeleteResult>
    }
  }
  newsletters: {
    listEditions: (params: EditionListParams) => Promise<EditionListResult>
    getEdition: (id: string) => Promise<EditionDetail>
    getAnalytics: (id: string) => Promise<EditionAnalyticsData>
    listTypes: () => Promise<NewsletterTypeInfo[]>
    getSettings: () => Promise<NewsletterSettingsData>
    actions: {
      saveEdition: (id: string, data: SaveEditionInput) => Promise<ActionResult>
      createEdition: (typeId: string) => Promise<ActionResult>
      scheduleEdition: (id: string, sendAt: string) => Promise<ActionResult>
      cancelEdition: (id: string) => Promise<ActionResult>
      sendTestEmail: (id: string) => Promise<ActionResult>
      assignToSlot: (id: string, slotDate: string) => Promise<ActionResult>
      unslotEdition: (id: string) => Promise<ActionResult>
      updateCadence: (typeId: string, data: CadenceInput) => Promise<ActionResult>
    }
  }
  subscribers: {
    list: (params: SubscriberListParams) => Promise<SubscriberListResult>
    getKpis: () => Promise<SubscriberKpisData>
    getGrowthData: (period: string) => Promise<GrowthDataPoint[]>
  }
  contacts: {
    list: (params: ContactListParams) => Promise<ContactListResult>
    getById: (id: string) => Promise<ContactDetail>
  }
  contentQueue: {
    getBacklog: () => Promise<BacklogData>
    getScheduled: () => Promise<ScheduledData>
    getCadences: () => Promise<CadenceConfig[]>
    actions: {
      assignBlogToSlot: (postId: string, slotDate: string) => Promise<ActionResult>
      unslotBlogPost: (postId: string) => Promise<ActionResult>
      publishBlogNow: (postId: string) => Promise<ActionResult>
      markBlogReady: (postId: string) => Promise<ActionResult>
      reorderBacklog: (orderedIds: string[]) => Promise<ActionResult>
      updateBlogCadence: (locale: string, data: CadenceInput) => Promise<ActionResult>
    }
  }
  dashboard: {
    getKpis: () => Promise<DashboardKpisData>
    getComingUp: () => Promise<ComingUpItem[]>
  }
  analytics: {
    getOverview: (period: string) => Promise<OverviewData>
    getCampaignStats: (period: string) => Promise<CampaignStatsData>
    getContentStats: (period: string) => Promise<ContentStatsData>
    getNewsletterStats: (period: string) => Promise<NewsletterStatsData>
  }
}
```

## Component API Pattern

All components follow the newsletter-admin pattern: data via props, callbacks via props, zero Supabase.

```typescript
// Example: PostsPage (full page shell)
interface PostsPageProps {
  posts: BlogPostRow[]
  total: number
  page: number
  pageSize: number
  currentParams: string
  onDelete?: (id: string) => Promise<void>
  linkComponent?: React.ComponentType<{ href: string; children: React.ReactNode }>
}
```

Components that need navigation links accept an injectable `linkComponent` prop (defaults to `<a>`, consumer passes Next `Link`). The `linkComponent` is set once via the root barrel (`client.ts`) which re-exports all components with a pre-configured link component via a `CmsAdminProvider` context wrapper. Consumer wraps their layout with `<CmsAdminProvider linkComponent={Link}>`.

### Analytics Data Source

The analytics domain currently uses **demo data** (hardcoded constants in `demo-data.ts`). Queries in `analytics/queries.ts` return this demo data directly. When real analytics DB tables are built (Sprint 8+), the queries will be updated to fetch from Supabase — consumers get the real data automatically on package upgrade, no code change needed.

### Component Inventory (38 components across 8 domains)

**Blog (4):** PostsPage, PostsTable, PostsFilters, DeletePostButton
**Campaigns (5):** CampaignsPage, CampaignTable, CampaignKpis, PdfUploadForm, DeleteCampaignButton
**Newsletters (3):** EditionsTable, TypeCards, EditionAnalyticsView
**Subscribers (7):** SubscriberTable, SubscriberKpis, GrowthChart, SubscriberActionMenu, SubscriberMobileCard, SubscriberIcons (TypeBadge/LgpdLockIcon/ConsentIcon), EngagementDots
**Analytics (9):** AnalyticsTabs, OverviewTab, ContentTab, NewslettersTab, CampaignsTab, AreaChart, DonutChart, Heatmap, DeliveryFunnel
**Schedule (5):** ScheduleClient, WeekView, AgendaView, QuickScheduleDialog, BacklogPanel
**Contacts (3):** ContactsPage, ContactDetail, AuthorCard
**Dashboard (3):** DashboardKpis, ComingUp, ContinueEditing

## Consumer Integration

### One-time setup (lib/cms/admin.ts)

```typescript
import { createCmsAdmin } from '@tn-figueiredo/cms-admin'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export const cms = createCmsAdmin({
  getClient: getSupabaseServiceClient,
  getSiteContext,
  requireAuth: requireSiteScope,
  revalidatePath,
  revalidateTag,
})
```

### Route file pattern (~8 lines each)

```typescript
// app/cms/blog/page.tsx
import { cms } from '@/lib/cms/admin'
import { PostsPage } from '@tn-figueiredo/cms-admin/blog/client'

export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const data = await cms.blog.list(params)
  return <PostsPage {...data} />
}
```

### Action wrapper pattern (~5 lines each)

```typescript
// app/cms/blog/[id]/edit/actions.ts
'use server'
import { cms } from '@/lib/cms/admin'

export const savePost = cms.blog.actions.savePost
export const publishPost = cms.blog.actions.publishPost
export const unpublishPost = cms.blog.actions.unpublishPost
export const archivePost = cms.blog.actions.archivePost
export const deletePost = cms.blog.actions.deletePost
```

### CSS import

```css
/* app/globals.css */
@import '@tn-figueiredo/cms-ui/styles.css';
@import '@tn-figueiredo/cms-admin/styles.css';
```

### Feature selection

Consumer controls which CMS features appear by:
1. **Route files** — only create routes for desired features
2. **Sidebar sections** — filter `DEFAULT_CMS_SECTIONS` to include only active domains
3. **Subpath imports** — only import domains you use (tree-shaking handles the rest)

No feature flag system needed — the file system IS the feature selection.

## What Stays in Consumer

| Item | Why |
|------|-----|
| Route files (`app/cms/*/page.tsx`) | Next.js requires filesystem routing |
| `'use server'` wrappers | Directive must be in consumer codebase |
| `lib/cms/site-context.ts` | App-specific middleware header reading |
| `lib/cms/auth-guards.ts` | Already in `@tn-figueiredo/auth-nextjs` |
| Site switcher provider | App-specific (depends on user's org membership) |
| Email service wiring | Already in `@tn-figueiredo/email` |

## What Moves to Package

| Item | Lines | Domain |
|------|-------|--------|
| PostsTable, PostsFilters, DeletePostButton | ~307 | blog |
| CampaignTable, CampaignKpis, DeleteCampaignButton, PdfUploadForm | ~628 | campaigns |
| EditionsTable, TypeCards | ~284 | newsletters |
| SubscriberTable + sub-components, SubscriberKpis, GrowthChart | ~931 | subscribers |
| AnalyticsTabs + 8 chart components + demo data | ~1,103 | analytics |
| ScheduleClient + 4 sub-components | ~525 | schedule |
| ContactsPage, ContactDetail, AuthorCard | ~384 | contacts |
| DashboardKpis, ComingUp, ContinueEditing | ~174 | dashboard |
| All queries (extracted from page.tsx server components) | ~400 | queries |
| All actions (extracted from actions.ts files) | ~884 | actions |
| **Total** | **~5,620** | |

## Package Directory Structure

```
packages/cms-admin/
├── package.json
├── tsup.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── src/
│   ├── index.ts                         → createCmsAdmin, config types, DEFAULT_CMS_SECTIONS
│   ├── client.ts                        → 'use client' barrel (all components)
│   ├── styles.css                       → chart/analytics CSS (extends cms-ui tokens)
│   ├── types.ts                         → ActionResult, DeleteResult, shared interfaces
│   ├── factory.ts                       → createCmsAdmin() implementation
│   ├── blog/
│   │   ├── index.ts                     → queries, action factory, types re-export
│   │   ├── client.ts                    → 'use client' barrel
│   │   ├── queries.ts                   → fetchBlogPosts, fetchBlogPost, fetchBlogForEdit
│   │   ├── actions.ts                   → createBlogActions()
│   │   ├── types.ts                     → BlogPostRow, BlogListParams, BlogListResult
│   │   └── components/
│   │       ├── posts-page.tsx
│   │       ├── posts-table.tsx
│   │       ├── posts-filters.tsx
│   │       └── delete-post-button.tsx
│   ├── campaigns/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── queries.ts
│   │   ├── actions.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── campaigns-page.tsx
│   │       ├── campaign-table.tsx
│   │       ├── campaign-kpis.tsx
│   │       ├── pdf-upload-form.tsx
│   │       └── delete-campaign-button.tsx
│   ├── newsletters/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── queries.ts
│   │   ├── actions.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── editions-table.tsx
│   │       ├── type-cards.tsx
│   │       └── edition-analytics.tsx
│   ├── subscribers/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── queries.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── subscriber-table.tsx
│   │       ├── subscriber-kpis.tsx
│   │       ├── subscriber-action-menu.tsx
│   │       ├── subscriber-mobile-card.tsx
│   │       ├── subscriber-icons.tsx
│   │       ├── growth-chart.tsx
│   │       └── engagement-dots.tsx
│   ├── analytics/
│   │   ├── client.ts
│   │   ├── queries.ts
│   │   ├── types.ts
│   │   ├── demo-data.ts
│   │   └── components/
│   │       ├── analytics-tabs.tsx
│   │       ├── overview-tab.tsx
│   │       ├── content-tab.tsx
│   │       ├── newsletters-tab.tsx
│   │       ├── campaigns-tab.tsx
│   │       ├── area-chart.tsx
│   │       ├── donut-chart.tsx
│   │       ├── heatmap.tsx
│   │       └── delivery-funnel.tsx
│   ├── schedule/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── actions.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── schedule-client.tsx
│   │       ├── week-view.tsx
│   │       ├── agenda-view.tsx
│   │       ├── quick-schedule-dialog.tsx
│   │       └── backlog-panel.tsx
│   ├── contacts/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── queries.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── contacts-page.tsx
│   │       ├── contact-detail.tsx
│   │       └── author-card.tsx
│   └── dashboard/
│       ├── client.ts
│       ├── queries.ts
│       ├── types.ts
│       └── components/
│           ├── dashboard-kpis.tsx
│           ├── coming-up.tsx
│           └── continue-editing.tsx
└── __tests__/
    ├── blog/
    │   ├── queries.test.ts
    │   └── components/
    │       ├── posts-table.test.tsx
    │       └── posts-filters.test.tsx
    ├── campaigns/
    │   ├── queries.test.ts
    │   └── components/
    │       ├── campaign-table.test.tsx
    │       └── campaign-kpis.test.tsx
    ├── subscribers/
    │   └── components/
    │       ├── subscriber-table.test.tsx
    │       └── growth-chart.test.tsx
    ├── analytics/
    │   └── components/
    │       └── analytics-tabs.test.tsx
    ├── schedule/
    │   └── components/
    │       └── schedule-client.test.tsx
    └── factory.test.ts
```

## Dependency Graph

```
@tn-figueiredo/cms-admin (NEW)
  ├── @tn-figueiredo/cms       (types, repos, editors, MDX, Zod schemas)
  ├── @tn-figueiredo/cms-ui    (StatusBadge, KpiCard, Pagination, Sparkline, EmptyState, etc.)
  ├── @tn-figueiredo/newsletter (types: EditionStatus, SubscriptionStatus — for subscribers/newsletters)
  └── peer: @supabase/supabase-js, react, react-dom, next
```

`@tn-figueiredo/newsletter-admin` stays separate. Its components (NewsletterDashboard, EditionEditor, etc.) remain importable directly. `cms-admin/newsletters` provides the query/action layer + lighter table components, NOT a full re-export of newsletter-admin.

## Migration Plan (bythiagofigueiredo)

After the package is published:

1. Install `@tn-figueiredo/cms-admin@0.1.0` (pinned)
2. Create `lib/cms/admin.ts` (factory wiring)
3. Replace each CMS page:
   - Delete inline queries from server components → use `cms.blog.list()`
   - Delete component code → import from `@tn-figueiredo/cms-admin/blog/client`
   - Delete `_components/` files that moved to package
   - Thin down action files to re-exports
4. Delete moved test files (tests now live in the package)
5. Add `@tn-figueiredo/cms-admin` to `transpilePackages` in `next.config.ts`

**Expected result:** ~5,000 lines deleted from bythiagofigueiredo, replaced by ~200 lines of wiring.

## Auth Guard Pattern

The package does NOT handle auth internally. Instead:

1. `createCmsAdmin({ requireAuth })` receives an auth function from the consumer
2. Every query and action calls `await config.requireAuth()` before executing
3. This keeps auth completely pluggable — works with any auth system
4. For bythiagofigueiredo, `requireAuth` is `requireSiteScope` from `@tn-figueiredo/auth-nextjs`

Row-level auth (e.g., "can this user edit this post?") uses `@tn-figueiredo/cms`'s `SupabasePostRepository` which already respects RLS via the injected client.

## Cache Invalidation Pattern

The factory receives `revalidatePath` and `revalidateTag` from `next/cache`. Actions call these after mutations:

- `savePost` → `revalidateTag('blog:post:' + id)`
- `publishPost` → `revalidateTag('blog:post:' + id)` + `revalidateTag('sitemap:' + siteId)`
- `deletePost` → `revalidatePath('/cms/blog')` + `revalidateTag('sitemap:' + siteId)`

This follows the existing SEO cache invalidation tags from Sprint 5b.

## Testing Strategy

- **Component tests:** vitest + @testing-library/react + happy-dom (same as cms-ui)
- **Query tests:** vitest with mocked Supabase client (spy on `.from().select()` chains)
- **Action tests:** vitest with mocked Supabase client (verify mutations)
- **Factory test:** verify `createCmsAdmin()` returns all expected domains and functions
- **Smoke test:** verify package builds, exports are correct, version matches

Target: 100+ tests covering all components and critical query/action paths.

## Versioning

- Initial release: `0.1.0`
- Published to GitHub Packages (`npm.pkg.github.com`)
- Consumer pins exact version (no `^`) per ecosystem convention
- CHANGELOG.md tracks changes
