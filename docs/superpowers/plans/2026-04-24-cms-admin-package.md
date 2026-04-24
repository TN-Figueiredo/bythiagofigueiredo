# @tn-figueiredo/cms-admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all CMS admin pages, components, queries, and actions from `bythiagofigueiredo` into `@tn-figueiredo/cms-admin` — a single reusable package that gives any `@tn-figueiredo/*` app a complete CMS with ~200 lines of wiring.

**Architecture:** Factory pattern (`createCmsAdmin(config)`) returns pre-wired queries + actions. Components are pure `'use client'` presentational (zero Supabase). Monolith with subpath exports for tree-shaking.

**Tech Stack:** tsup (ESM+CJS+DTS), postcss + @tailwindcss/postcss, vitest + @testing-library/react + happy-dom, React 19, Next.js 15, Supabase.

**Spec:** `docs/superpowers/specs/2026-04-24-cms-admin-package-design.md`

**Two repos:**
- `tnf-ecosystem` at `/Users/figueiredo/Workspace/tnf-ecosystem/` — package lives at `packages/cms-admin/`
- `bythiagofigueiredo` at `/Users/figueiredo/Workspace/bythiagofigueiredo/` — consumer migration

---

## Phase 0: Foundation (sequential — Tasks 1–3)

### Task 1: Package Scaffold

**Files:**
- Create: `packages/cms-admin/package.json`
- Create: `packages/cms-admin/tsup.config.ts`
- Create: `packages/cms-admin/postcss.config.mjs`
- Create: `packages/cms-admin/vitest.config.ts`
- Create: `packages/cms-admin/tsconfig.json`
- Create: `packages/cms-admin/src/styles.css`
- Create: `packages/cms-admin/src/__tests__/setup.ts`

**Working directory:** `/Users/figueiredo/Workspace/tnf-ecosystem/`

- [ ] **Step 1: Create branch**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git checkout -b feat/cms-admin
```

- [ ] **Step 2: Create package directory**

```bash
mkdir -p packages/cms-admin/src/__tests__
```

- [ ] **Step 3: Write package.json**

Create `packages/cms-admin/package.json`:

```json
{
  "name": "@tn-figueiredo/cms-admin",
  "version": "0.1.0",
  "description": "Complete CMS admin: queries, actions, and components for blog, campaigns, newsletters, subscribers, analytics, schedule, contacts, and dashboard",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    },
    "./blog": {
      "types": "./dist/blog/index.d.ts",
      "require": "./dist/blog/index.cjs",
      "import": "./dist/blog/index.js"
    },
    "./blog/client": {
      "types": "./dist/blog/client.d.ts",
      "require": "./dist/blog/client.cjs",
      "import": "./dist/blog/client.js"
    },
    "./campaigns": {
      "types": "./dist/campaigns/index.d.ts",
      "require": "./dist/campaigns/index.cjs",
      "import": "./dist/campaigns/index.js"
    },
    "./campaigns/client": {
      "types": "./dist/campaigns/client.d.ts",
      "require": "./dist/campaigns/client.cjs",
      "import": "./dist/campaigns/client.js"
    },
    "./newsletters": {
      "types": "./dist/newsletters/index.d.ts",
      "require": "./dist/newsletters/index.cjs",
      "import": "./dist/newsletters/index.js"
    },
    "./newsletters/client": {
      "types": "./dist/newsletters/client.d.ts",
      "require": "./dist/newsletters/client.cjs",
      "import": "./dist/newsletters/client.js"
    },
    "./subscribers": {
      "types": "./dist/subscribers/index.d.ts",
      "require": "./dist/subscribers/index.cjs",
      "import": "./dist/subscribers/index.js"
    },
    "./subscribers/client": {
      "types": "./dist/subscribers/client.d.ts",
      "require": "./dist/subscribers/client.cjs",
      "import": "./dist/subscribers/client.js"
    },
    "./analytics/client": {
      "types": "./dist/analytics/client.d.ts",
      "require": "./dist/analytics/client.cjs",
      "import": "./dist/analytics/client.js"
    },
    "./schedule": {
      "types": "./dist/schedule/index.d.ts",
      "require": "./dist/schedule/index.cjs",
      "import": "./dist/schedule/index.js"
    },
    "./schedule/client": {
      "types": "./dist/schedule/client.d.ts",
      "require": "./dist/schedule/client.cjs",
      "import": "./dist/schedule/client.js"
    },
    "./contacts": {
      "types": "./dist/contacts/index.d.ts",
      "require": "./dist/contacts/index.cjs",
      "import": "./dist/contacts/index.js"
    },
    "./contacts/client": {
      "types": "./dist/contacts/client.d.ts",
      "require": "./dist/contacts/client.cjs",
      "import": "./dist/contacts/client.js"
    },
    "./dashboard/client": {
      "types": "./dist/dashboard/client.d.ts",
      "require": "./dist/dashboard/client.cjs",
      "import": "./dist/dashboard/client.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "require": "./dist/client.cjs",
      "import": "./dist/client.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build:css": "postcss src/styles.css -o dist/styles.css",
    "build:js": "tsup",
    "build": "npm run build:js && npm run build:css",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "dev": "tsup --watch"
  },
  "peerDependencies": {
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0",
    "next": ">=15.0.0",
    "@supabase/supabase-js": "^2.0.0"
  },
  "dependencies": {
    "@tn-figueiredo/cms": "*",
    "@tn-figueiredo/cms-ui": "*"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "@tailwindcss/postcss": "^4.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.3.2",
    "@vitejs/plugin-react": "4.3.4",
    "happy-dom": "20.9.0",
    "next": "^15.0.0",
    "postcss": "^8.5.0",
    "postcss-cli": "^11.0.0",
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0",
    "tailwindcss": "^4.1.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^4.0.0"
  },
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/tn-figueiredo/tnf-ecosystem.git",
    "directory": "packages/cms-admin"
  },
  "license": "MIT",
  "author": "Thiago Figueiredo <tnfigueiredotv@gmail.com>"
}
```

- [ ] **Step 4: Write tsup.config.ts**

Create `packages/cms-admin/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    'blog/index': 'src/blog/index.ts',
    'blog/client': 'src/blog/client.ts',
    'campaigns/index': 'src/campaigns/index.ts',
    'campaigns/client': 'src/campaigns/client.ts',
    'newsletters/index': 'src/newsletters/index.ts',
    'newsletters/client': 'src/newsletters/client.ts',
    'subscribers/index': 'src/subscribers/index.ts',
    'subscribers/client': 'src/subscribers/client.ts',
    'analytics/client': 'src/analytics/client.ts',
    'schedule/index': 'src/schedule/index.ts',
    'schedule/client': 'src/schedule/client.ts',
    'contacts/index': 'src/contacts/index.ts',
    'contacts/client': 'src/contacts/client.ts',
    'dashboard/client': 'src/dashboard/client.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  external: ['react', 'react-dom', 'next', '@supabase/supabase-js'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
})
```

- [ ] **Step 5: Write postcss.config.mjs**

Create `packages/cms-admin/postcss.config.mjs`:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 6: Write vitest.config.ts**

Create `packages/cms-admin/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
})
```

- [ ] **Step 7: Write tsconfig.json**

Create `packages/cms-admin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

- [ ] **Step 8: Write test setup file**

Create `packages/cms-admin/src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 9: Write styles.css**

Create `packages/cms-admin/src/styles.css`:

```css
/* @tn-figueiredo/cms-admin — CMS admin component styles
   Import in your app: @import '@tn-figueiredo/cms-admin/styles.css' */

@import "tailwindcss/utilities";

@source "./blog/**/*.tsx";
@source "./campaigns/**/*.tsx";
@source "./newsletters/**/*.tsx";
@source "./subscribers/**/*.tsx";
@source "./analytics/**/*.tsx";
@source "./schedule/**/*.tsx";
@source "./contacts/**/*.tsx";
@source "./dashboard/**/*.tsx";

@theme {
  --color-cms-bg: var(--cms-bg);
  --color-cms-surface: var(--cms-surface);
  --color-cms-surface-hover: var(--cms-surface-hover);
  --color-cms-border: var(--cms-border);
  --color-cms-border-subtle: var(--cms-border-subtle);
  --color-cms-text: var(--cms-text);
  --color-cms-text-muted: var(--cms-text-muted);
  --color-cms-text-dim: var(--cms-text-dim);
  --color-cms-accent: var(--cms-accent);
  --color-cms-accent-hover: var(--cms-accent-hover);
  --color-cms-accent-subtle: var(--cms-accent-subtle);
  --color-cms-green: var(--cms-green);
  --color-cms-green-subtle: var(--cms-green-subtle);
  --color-cms-amber: var(--cms-amber);
  --color-cms-amber-subtle: var(--cms-amber-subtle);
  --color-cms-red: var(--cms-red);
  --color-cms-red-subtle: var(--cms-red-subtle);
  --color-cms-cyan: var(--cms-cyan);
}
```

- [ ] **Step 10: Install dependencies**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npm install
```

- [ ] **Step 11: Commit**

```bash
git add packages/cms-admin/
git commit -m "feat(cms-admin): scaffold package with build config"
```

---

### Task 2: Core Types + CmsAdminProvider

**Files:**
- Create: `packages/cms-admin/src/types.ts`
- Create: `packages/cms-admin/src/context.tsx`

**Working directory:** `/Users/figueiredo/Workspace/tnf-ecosystem/`

- [ ] **Step 1: Write shared types**

Create `packages/cms-admin/src/types.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReactNode, ComponentType } from 'react'

export interface SiteContext {
  siteId: string
  orgId: string
  defaultLocale: string
}

export interface CmsAdminConfig {
  getClient: () => SupabaseClient
  getSiteContext: () => Promise<SiteContext>
  requireAuth?: () => Promise<void>
  revalidatePath?: (path: string) => void
  revalidateTag?: (tag: string) => void
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; message?: string }

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: 'already_published' | 'not_found' | 'db_error'; message?: string }

export interface LinkComponentProps {
  href: string
  children: ReactNode
  className?: string
  [key: string]: unknown
}

export type LinkComponent = ComponentType<LinkComponentProps>

export function DefaultLink({ href, children, ...rest }: LinkComponentProps) {
  return <a href={href} {...rest}>{children}</a>
}
```

- [ ] **Step 2: Write CmsAdminProvider context**

Create `packages/cms-admin/src/context.tsx`:

```typescript
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DefaultLink, type LinkComponent } from './types.js'

interface CmsAdminContextValue {
  LinkComponent: LinkComponent
}

const CmsAdminContext = createContext<CmsAdminContextValue>({
  LinkComponent: DefaultLink,
})

export function CmsAdminProvider({
  linkComponent,
  children,
}: {
  linkComponent?: LinkComponent
  children: ReactNode
}) {
  return (
    <CmsAdminContext.Provider value={{ LinkComponent: linkComponent ?? DefaultLink }}>
      {children}
    </CmsAdminContext.Provider>
  )
}

export function useLinkComponent(): LinkComponent {
  return useContext(CmsAdminContext).LinkComponent
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/cms-admin/src/types.ts packages/cms-admin/src/context.tsx
git commit -m "feat(cms-admin): add core types and CmsAdminProvider"
```

---

### Task 3: Factory Implementation + Root Barrels

**Files:**
- Create: `packages/cms-admin/src/factory.ts`
- Create: `packages/cms-admin/src/index.ts`
- Create: `packages/cms-admin/src/client.ts`
- Create: `packages/cms-admin/src/__tests__/factory.test.ts`

**Working directory:** `/Users/figueiredo/Workspace/tnf-ecosystem/`

**Context:** The factory file imports domain-specific `createXxxQueries` and `createXxxActions` functions from each domain. Those don't exist yet — this task creates the factory with the full interface and stub imports. Each domain task (Tasks 4–11) will create the actual domain files. The factory test verifies the shape of the returned object.

- [ ] **Step 1: Write the factory test**

Create `packages/cms-admin/src/__tests__/factory.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createCmsAdmin } from '../factory.js'
import type { CmsAdminConfig } from '../types.js'

function mockConfig(): CmsAdminConfig {
  return {
    getClient: vi.fn() as unknown as CmsAdminConfig['getClient'],
    getSiteContext: vi.fn().mockResolvedValue({
      siteId: 'site-1',
      orgId: 'org-1',
      defaultLocale: 'pt-BR',
    }),
    requireAuth: vi.fn().mockResolvedValue(undefined),
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
  }
}

describe('createCmsAdmin', () => {
  it('returns all domain namespaces', () => {
    const cms = createCmsAdmin(mockConfig())

    expect(cms.blog).toBeDefined()
    expect(cms.blog.list).toBeTypeOf('function')
    expect(cms.blog.actions).toBeDefined()
    expect(cms.blog.actions.savePost).toBeTypeOf('function')

    expect(cms.campaigns).toBeDefined()
    expect(cms.campaigns.list).toBeTypeOf('function')
    expect(cms.campaigns.actions).toBeDefined()

    expect(cms.newsletters).toBeDefined()
    expect(cms.newsletters.listEditions).toBeTypeOf('function')
    expect(cms.newsletters.actions).toBeDefined()

    expect(cms.subscribers).toBeDefined()
    expect(cms.subscribers.list).toBeTypeOf('function')

    expect(cms.contacts).toBeDefined()
    expect(cms.contacts.list).toBeTypeOf('function')

    expect(cms.contentQueue).toBeDefined()
    expect(cms.contentQueue.getBacklog).toBeTypeOf('function')
    expect(cms.contentQueue.actions).toBeDefined()

    expect(cms.dashboard).toBeDefined()
    expect(cms.dashboard.getKpis).toBeTypeOf('function')

    expect(cms.analytics).toBeDefined()
    expect(cms.analytics.getOverview).toBeTypeOf('function')
  })
})
```

- [ ] **Step 2: Write the factory**

Create `packages/cms-admin/src/factory.ts`:

```typescript
import type { CmsAdminConfig } from './types.js'
import { createBlogQueries, createBlogActions } from './blog/index.js'
import { createCampaignQueries, createCampaignActions } from './campaigns/index.js'
import { createNewsletterQueries, createNewsletterActions } from './newsletters/index.js'
import { createSubscriberQueries } from './subscribers/index.js'
import { createContactQueries } from './contacts/index.js'
import { createContentQueueQueries, createContentQueueActions } from './schedule/index.js'
import { createDashboardQueries } from './dashboard/queries.js'
import { createAnalyticsQueries } from './analytics/queries.js'

export function createCmsAdmin(config: CmsAdminConfig) {
  return {
    blog: {
      ...createBlogQueries(config),
      actions: createBlogActions(config),
    },
    campaigns: {
      ...createCampaignQueries(config),
      actions: createCampaignActions(config),
    },
    newsletters: {
      ...createNewsletterQueries(config),
      actions: createNewsletterActions(config),
    },
    subscribers: createSubscriberQueries(config),
    contacts: createContactQueries(config),
    contentQueue: {
      ...createContentQueueQueries(config),
      actions: createContentQueueActions(config),
    },
    dashboard: createDashboardQueries(config),
    analytics: createAnalyticsQueries(config),
  }
}
```

- [ ] **Step 3: Write root index.ts (server-safe barrel)**

Create `packages/cms-admin/src/index.ts`:

```typescript
export { createCmsAdmin } from './factory.js'
export type { CmsAdminConfig, ActionResult, DeleteResult, SiteContext, LinkComponent } from './types.js'

export { CmsAdminProvider } from './context.js'
```

- [ ] **Step 4: Write root client.ts (will be populated after domain tasks)**

Create `packages/cms-admin/src/client.ts`:

```typescript
'use client'

export { CmsAdminProvider, useLinkComponent } from './context.js'

// Domain client re-exports will be added as each domain is implemented
```

- [ ] **Step 5: Commit (tests will pass after all domain tasks are complete)**

```bash
git add packages/cms-admin/src/factory.ts packages/cms-admin/src/index.ts packages/cms-admin/src/client.ts packages/cms-admin/src/__tests__/factory.test.ts
git commit -m "feat(cms-admin): add factory, root barrels, and factory test"
```

---

## Phase 1: Domain Extraction (Tasks 4–11 — ALL PARALLEL)

Each domain task is fully independent. All 8 can run simultaneously. Each follows the same pattern:
1. `types.ts` — domain-specific type definitions
2. `queries.ts` — server-safe fetch factories (extracted from `page.tsx` server components)
3. `actions.ts` — mutation factories (extracted from `actions.ts` files) — only for domains with mutations
4. `components/*.tsx` — UI components adapted to props-only (extracted from `_components/`)
5. `client.ts` — `'use client'` barrel exporting all components
6. `index.ts` — server-safe barrel exporting queries + action factories + types
7. Tests

**Source code lives at:** `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/cms/(authed)/`
**Target directory:** `/Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-admin/src/`

---

### Task 4: Blog Domain

**Files:**
- Create: `packages/cms-admin/src/blog/types.ts`
- Create: `packages/cms-admin/src/blog/queries.ts`
- Create: `packages/cms-admin/src/blog/actions.ts`
- Create: `packages/cms-admin/src/blog/components/posts-table.tsx`
- Create: `packages/cms-admin/src/blog/components/posts-filters.tsx`
- Create: `packages/cms-admin/src/blog/components/posts-page.tsx`
- Create: `packages/cms-admin/src/blog/components/delete-post-button.tsx`
- Create: `packages/cms-admin/src/blog/client.ts`
- Create: `packages/cms-admin/src/blog/index.ts`
- Create: `packages/cms-admin/src/__tests__/blog/components/posts-table.test.tsx`
- Create: `packages/cms-admin/src/__tests__/blog/queries.test.ts`

**Source files to extract from (in bythiagofigueiredo):**
- `apps/web/src/app/cms/(authed)/blog/page.tsx` — query pattern (lines 27–49)
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` — all 7 action functions (209 lines)
- `apps/web/src/app/cms/(authed)/blog/_components/posts-table.tsx` — full component (118 lines)
- `apps/web/src/app/cms/(authed)/blog/_components/posts-filters.tsx` — full component (87 lines)
- `apps/web/src/app/cms/(authed)/blog/_components/delete-post-button.tsx` — full component (103 lines)

**Key adaptation:** Components currently import `Link` from `next/link` and have hardcoded routes like `/cms/blog/${post.id}/edit`. Extract to use `useLinkComponent()` from context. Query code extracted from the server component body into standalone factory functions. Actions use the `config.requireAuth()` + `config.getClient()` pattern instead of direct imports.

- [ ] **Step 1: Create directories**

```bash
mkdir -p packages/cms-admin/src/blog/components
mkdir -p packages/cms-admin/src/__tests__/blog/components
```

- [ ] **Step 2: Write blog/types.ts**

Extract from the existing `PostRow` interface in `posts-table.tsx` and the `BlogPostRow` in `page.tsx`:

```typescript
export interface BlogPostRow {
  id: string
  title: string
  slug: string
  status: string
  locales: string[]
  authorName: string
  authorInitials: string
  updatedAt: string
  readingTime: number
}

export interface BlogListParams {
  page?: string
  status?: string
  locale?: string
  q?: string
}

export interface BlogListResult {
  posts: BlogPostRow[]
  total: number
  page: number
  pageSize: number
  currentParams: string
  statusCounts: Record<string, number>
}

export interface SavePostInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_url?: string | null
}

export type SavePostResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'invalid_seo_extras'; details: unknown[] }
  | { ok: false; error: 'db_error'; message: string }

export type DeletePostResult =
  | { ok: true }
  | { ok: false; error: 'already_published' | 'not_found' | 'db_error'; message?: string }
```

- [ ] **Step 3: Write blog/queries.ts**

Extract query logic from `blog/page.tsx` lines 27–64:

```typescript
import type { CmsAdminConfig } from '../types.js'
import type { BlogListParams, BlogListResult, BlogPostRow } from './types.js'

const PAGE_SIZE = 20

export function createBlogQueries(config: CmsAdminConfig) {
  async function list(params: BlogListParams): Promise<BlogListResult> {
    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()

    const page = Math.max(1, parseInt(params.page ?? '1', 10))

    const { data: statusData } = await client
      .from('blog_posts')
      .select('status')
      .eq('site_id', siteId)

    const counts: Record<string, number> = {}
    for (const row of statusData ?? []) {
      const status = String(row.status ?? 'draft')
      counts[status] = (counts[status] ?? 0) + 1
    }

    let query = client
      .from('blog_posts')
      .select(
        'id, slug, status, slot_date, updated_at, owner_user_id, blog_translations(title, locale, reading_time_min), authors!blog_posts_owner_user_id_fkey(display_name)',
        { count: 'exact' },
      )
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (params.status) query = query.eq('status', params.status)
    if (params.locale) query = query.eq('blog_translations.locale', params.locale)
    if (params.q) query = query.ilike('blog_translations.title', `%${params.q}%`)

    const { data: posts, count: total } = await query

    const rows: BlogPostRow[] = (posts ?? []).map((p: Record<string, unknown>) => {
      const translations = p.blog_translations as Array<{ title: string; locale: string; reading_time_min: number | null }> | null
      const authors = p.authors as Array<{ display_name: string }> | null
      return {
        id: String(p.id),
        title: translations?.[0]?.title ?? 'Untitled',
        slug: String(p.slug ?? ''),
        status: String(p.status ?? 'draft'),
        locales: (translations ?? []).map((t) => t.locale),
        authorName: authors?.[0]?.display_name ?? 'Unknown',
        authorInitials: (authors?.[0]?.display_name ?? 'U')
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        updatedAt: new Date(String(p.updated_at)).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        readingTime: translations?.[0]?.reading_time_min ?? 0,
      }
    })

    const sp = new URLSearchParams()
    if (params.status) sp.set('status', params.status)
    if (params.locale) sp.set('locale', params.locale)
    if (params.q) sp.set('q', params.q)

    return {
      posts: rows,
      total: total ?? rows.length,
      page,
      pageSize: PAGE_SIZE,
      currentParams: sp.toString(),
      statusCounts: counts,
    }
  }

  return { list }
}
```

- [ ] **Step 4: Write blog/actions.ts**

Extract from `blog/[id]/edit/actions.ts`. Keep the same logic but use injected config instead of direct imports:

```typescript
import type { CmsAdminConfig, DeleteResult } from '../types.js'
import type { SavePostInput, SavePostResult } from './types.js'
import { compileMdx, uploadContentAsset, isSafeUrl } from '@tn-figueiredo/cms'

export function createBlogActions(config: CmsAdminConfig) {
  async function savePost(
    id: string,
    locale: string,
    input: SavePostInput,
  ): Promise<SavePostResult> {
    if (!input.title.trim()) {
      return { ok: false, error: 'validation_failed', fields: { title: 'required' } }
    }
    if (!input.slug.trim()) {
      return { ok: false, error: 'validation_failed', fields: { slug: 'required' } }
    }
    if (!isSafeUrl(input.og_image_url)) {
      return { ok: false, error: 'validation_failed', fields: { og_image_url: 'invalid_url' } }
    }
    if (!isSafeUrl(input.cover_image_url)) {
      return { ok: false, error: 'validation_failed', fields: { cover_image_url: 'invalid_url' } }
    }

    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()

    let compiled
    try {
      compiled = await compileMdx(input.content_mdx)
    } catch (e) {
      return { ok: false, error: 'compile_failed', message: e instanceof Error ? e.message : String(e) }
    }

    const { error } = await client
      .from('blog_translations')
      .upsert({
        post_id: id,
        locale,
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt ?? null,
        content_mdx: input.content_mdx,
        content_compiled: compiled.compiledSource,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
        ...(input.meta_title !== undefined ? { meta_title: input.meta_title } : {}),
        ...(input.meta_description !== undefined ? { meta_description: input.meta_description } : {}),
        ...(input.og_image_url !== undefined ? { og_image_url: input.og_image_url } : {}),
      }, { onConflict: 'post_id,locale' })

    if (error) return { ok: false, error: 'db_error', message: error.message }

    if (input.cover_image_url !== undefined) {
      await client
        .from('blog_posts')
        .update({ cover_image_url: input.cover_image_url })
        .eq('id', id)
    }

    config.revalidateTag?.(`blog:post:${id}`)
    return { ok: true, postId: id }
  }

  async function publishPost(id: string): Promise<void> {
    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()
    await client
      .from('blog_posts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id)
      .eq('site_id', siteId)
    config.revalidateTag?.(`blog:post:${id}`)
    config.revalidateTag?.(`sitemap:${siteId}`)
  }

  async function unpublishPost(id: string): Promise<void> {
    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()
    await client
      .from('blog_posts')
      .update({ status: 'draft', published_at: null })
      .eq('id', id)
      .eq('site_id', siteId)
    config.revalidateTag?.(`blog:post:${id}`)
    config.revalidateTag?.(`sitemap:${siteId}`)
  }

  async function archivePost(id: string): Promise<void> {
    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()
    await client
      .from('blog_posts')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('site_id', siteId)
    config.revalidateTag?.(`blog:post:${id}`)
    config.revalidateTag?.(`sitemap:${siteId}`)
  }

  async function deletePost(id: string): Promise<DeleteResult> {
    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()

    const { data: post } = await client
      .from('blog_posts')
      .select('status')
      .eq('id', id)
      .eq('site_id', siteId)
      .maybeSingle()

    if (!post) return { ok: false, error: 'not_found' }
    if (post.status !== 'draft' && post.status !== 'archived') {
      return { ok: false, error: 'already_published' }
    }

    const { error } = await client
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: 'db_error', message: error.message }

    config.revalidateTag?.(`blog:post:${id}`)
    config.revalidateTag?.(`sitemap:${siteId}`)
    config.revalidatePath?.('/cms/blog')
    return { ok: true }
  }

  async function compilePreview(source: string) {
    return compileMdx(source)
  }

  async function uploadAsset(file: File, postId: string): Promise<{ url: string }> {
    if (config.requireAuth) await config.requireAuth()
    const client = config.getClient()
    const { siteId } = await config.getSiteContext()
    const result = await uploadContentAsset(client, {
      siteId,
      contentType: 'blog',
      contentId: postId,
      file,
      filename: file.name,
    })
    return { url: result.signedUrl }
  }

  return { savePost, publishPost, unpublishPost, archivePost, deletePost, compilePreview, uploadAsset }
}
```

- [ ] **Step 5: Write blog components**

Create `packages/cms-admin/src/blog/components/posts-table.tsx` — adapted from source at `blog/_components/posts-table.tsx`. Replace `Link` from `next/link` with `useLinkComponent()`:

```typescript
'use client'

import { useLinkComponent } from '../../context.js'
import { StatusBadge } from '@tn-figueiredo/cms-ui/client'
import type { StatusVariant } from '@tn-figueiredo/cms-ui/client'
import type { BlogPostRow } from '../types.js'

interface PostsTableProps {
  posts: BlogPostRow[]
  total: number
  page: number
  pageSize: number
  currentParams?: string
  baseHref?: string
}

function preserveParams(params: string | undefined, newPage: number): string {
  const sp = new URLSearchParams(params ?? '')
  sp.set('page', String(newPage))
  return sp.toString()
}

export function PostsTable({ posts, total, page, pageSize, currentParams, baseHref = '/cms/blog' }: PostsTableProps) {
  const Link = useLinkComponent()

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30" aria-hidden="true">📝</div>
        <h3 className="text-sm font-semibold text-cms-text mb-1">No posts yet</h3>
        <p className="text-xs text-cms-text-muted mb-4">Write your first blog post.</p>
        <Link href={`${baseHref}/new`} className="inline-flex px-4 py-2 bg-cms-accent text-white text-sm rounded-[var(--cms-radius)] font-medium">
          Create first post
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" data-testid="posts-table">
          <thead>
            <tr className="border-b border-cms-border text-left">
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Title</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Status</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Locale</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Author</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Updated</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim w-16" />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-cms-border-subtle hover:bg-cms-surface-hover transition-colors group">
                <td className="py-3 px-4">
                  <Link href={`${baseHref}/${post.id}/edit`} className="block">
                    <div className="text-[13px] font-medium text-cms-text truncate max-w-xs">{post.title}</div>
                    <div className="text-[11px] text-cms-text-dim">/{post.slug} · {post.readingTime} min read</div>
                  </Link>
                </td>
                <td className="py-3 px-4"><StatusBadge variant={post.status as StatusVariant} /></td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    {post.locales.map((l) => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded border border-cms-border text-cms-text-muted">{l}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cms-accent flex items-center justify-center text-[9px] text-white font-semibold">{post.authorInitials}</div>
                    <span className="text-xs text-cms-text-muted">{post.authorName}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-cms-text-dim">{post.updatedAt}</td>
                <td className="py-3 px-4">
                  <Link href={`${baseHref}/${post.id}/edit`} className="text-xs text-cms-accent opacity-0 group-hover:opacity-100 transition-opacity">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {posts.map((post) => (
          <Link key={post.id} href={`${baseHref}/${post.id}/edit`}
            className="block p-3 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] font-medium text-cms-text line-clamp-2">{post.title}</div>
              <StatusBadge variant={post.status as StatusVariant} />
            </div>
            <div className="text-[11px] text-cms-text-dim mt-1">{post.authorName} · {post.updatedAt}</div>
          </Link>
        ))}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 text-xs text-cms-text-muted border-t border-cms-border">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex gap-1">
            {page > 1 && <Link href={`${baseHref}?${preserveParams(currentParams, page - 1)}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Prev</Link>}
            {page * pageSize < total && <Link href={`${baseHref}?${preserveParams(currentParams, page + 1)}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Next</Link>}
          </div>
        </div>
      )}
    </div>
  )
}
```

Create `packages/cms-admin/src/blog/components/posts-filters.tsx` — adapted from source. Replace `useRouter`/`useSearchParams` with callback props:

```typescript
'use client'

import { useCallback, useRef, useState } from 'react'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Review' },
  { value: 'ready', label: 'Ready' },
  { value: 'queued', label: 'Queued' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
] as const

const LOCALE_OPTIONS = ['', 'pt-BR', 'en'] as const

interface PostsFiltersProps {
  counts: Record<string, number>
  currentStatus?: string
  currentLocale?: string
  currentSearch?: string
  onFilterChange: (params: Record<string, string>) => void
}

export function PostsFilters({ counts, currentStatus = '', currentLocale = '', currentSearch = '', onFilterChange }: PostsFiltersProps) {
  const [search, setSearch] = useState(currentSearch)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const updateParam = useCallback((key: string, value: string) => {
    const next: Record<string, string> = {}
    if (key !== 'status' && currentStatus) next.status = currentStatus
    if (key !== 'locale' && currentLocale) next.locale = currentLocale
    if (key !== 'q' && search) next.q = search
    if (value) next[key] = value
    onFilterChange(next)
  }, [currentStatus, currentLocale, search, onFilterChange])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const isActive = currentStatus === tab.value
          const count = tab.value ? (counts[tab.value] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)
          return (
            <button type="button" key={tab.value} onClick={() => updateParam('status', tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${isActive ? 'bg-cms-accent-subtle text-cms-accent' : 'text-cms-text-muted hover:bg-cms-surface-hover'}`}>
              {tab.label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          )
        })}
      </div>
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <input type="search" value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              debounceRef.current = setTimeout(() => updateParam('q', e.target.value), 300)
            }}
            placeholder="Search posts..."
            aria-label="Search posts"
            className="w-full px-3 py-2 text-sm bg-cms-bg border border-cms-border rounded-[var(--cms-radius)] text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none" />
        </div>
        <div className="flex border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
          {LOCALE_OPTIONS.map((loc) => (
            <button type="button" key={loc} onClick={() => updateParam('locale', loc)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${currentLocale === loc ? 'bg-cms-accent-subtle text-cms-accent' : 'text-cms-text-muted hover:bg-cms-surface-hover'}`}>
              {loc || 'All'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

Create `packages/cms-admin/src/blog/components/delete-post-button.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import type { DeleteResult } from '../../types.js'

export interface DeletePostButtonProps {
  postId: string
  postTitle: string
  onDelete: (id: string) => Promise<DeleteResult>
}

export function DeletePostButton({ postId, postTitle, onDelete }: DeletePostButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await onDelete(postId)
      if (result.ok) {
        setDeleted(true)
        setShowConfirm(false)
      } else {
        setError(result.message ?? result.error)
      }
    })
  }

  if (deleted) {
    return <span role="status" className="text-sm text-cms-green">Deleted</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        aria-label={`Delete ${postTitle}`}
        className="inline-flex items-center rounded-md border border-[rgba(239,68,68,.4)] px-2 py-1 text-xs text-cms-red transition-colors hover:bg-cms-red/10"
      >
        Delete
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-cms-text">Delete post?</h3>
            <p className="mt-2 text-sm text-cms-text-muted">This action is permanent. &quot;{postTitle}&quot; will be removed.</p>
            {error && <p role="alert" className="mt-2 text-sm text-cms-red">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={isPending}
                className="px-3 py-1.5 text-sm border border-cms-border rounded-[var(--cms-radius)] hover:bg-cms-surface-hover">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm} disabled={isPending}
                className="px-3 py-1.5 text-sm bg-cms-red text-white rounded-[var(--cms-radius)] hover:opacity-90 disabled:opacity-50">
                {isPending ? 'Deleting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

Create `packages/cms-admin/src/blog/components/posts-page.tsx`:

```typescript
'use client'

import { PostsTable } from './posts-table.js'
import { PostsFilters } from './posts-filters.js'
import type { BlogPostRow } from '../types.js'

export interface PostsPageProps {
  posts: BlogPostRow[]
  total: number
  page: number
  pageSize: number
  currentParams: string
  statusCounts: Record<string, number>
  currentStatus?: string
  currentLocale?: string
  currentSearch?: string
  onFilterChange?: (params: Record<string, string>) => void
  baseHref?: string
}

export function PostsPage({
  posts, total, page, pageSize, currentParams, statusCounts,
  currentStatus, currentLocale, currentSearch,
  onFilterChange, baseHref,
}: PostsPageProps) {
  return (
    <div className="space-y-4">
      <PostsFilters
        counts={statusCounts}
        currentStatus={currentStatus}
        currentLocale={currentLocale}
        currentSearch={currentSearch}
        onFilterChange={onFilterChange ?? (() => {})}
      />
      <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
        <PostsTable
          posts={posts}
          total={total}
          page={page}
          pageSize={pageSize}
          currentParams={currentParams}
          baseHref={baseHref}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write blog barrels**

Create `packages/cms-admin/src/blog/client.ts`:

```typescript
'use client'

export { PostsPage } from './components/posts-page.js'
export type { PostsPageProps } from './components/posts-page.js'
export { PostsTable } from './components/posts-table.js'
export { PostsFilters } from './components/posts-filters.js'
export { DeletePostButton } from './components/delete-post-button.js'
export type { DeletePostButtonProps } from './components/delete-post-button.js'
```

Create `packages/cms-admin/src/blog/index.ts`:

```typescript
export { createBlogQueries } from './queries.js'
export { createBlogActions } from './actions.js'
export type {
  BlogPostRow,
  BlogListParams,
  BlogListResult,
  SavePostInput,
  SavePostResult,
  DeletePostResult,
} from './types.js'
```

- [ ] **Step 7: Write posts-table test**

Create `packages/cms-admin/src/__tests__/blog/components/posts-table.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostsTable } from '../../../blog/components/posts-table.js'
import { CmsAdminProvider } from '../../../context.js'
import type { BlogPostRow } from '../../../blog/types.js'

const mockPosts: BlogPostRow[] = [
  {
    id: '1',
    title: 'Test Post',
    slug: 'test-post',
    status: 'published',
    locales: ['pt-BR', 'en'],
    authorName: 'Test Author',
    authorInitials: 'TA',
    updatedAt: 'Apr 24',
    readingTime: 5,
  },
]

describe('PostsTable', () => {
  it('renders post rows', () => {
    render(
      <CmsAdminProvider>
        <PostsTable posts={mockPosts} total={1} page={1} pageSize={20} />
      </CmsAdminProvider>,
    )
    expect(screen.getByText('Test Post')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('shows empty state when no posts', () => {
    render(
      <CmsAdminProvider>
        <PostsTable posts={[]} total={0} page={1} pageSize={20} />
      </CmsAdminProvider>,
    )
    expect(screen.getByText('No posts yet')).toBeInTheDocument()
  })

  it('shows pagination when total exceeds page size', () => {
    render(
      <CmsAdminProvider>
        <PostsTable posts={mockPosts} total={25} page={1} pageSize={20} />
      </CmsAdminProvider>,
    )
    expect(screen.getByText(/Showing 1–20 of 25/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Run tests**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx vitest run --config packages/cms-admin/vitest.config.ts
```

Expected: All blog tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/cms-admin/src/blog/ packages/cms-admin/src/__tests__/blog/
git commit -m "feat(cms-admin): add blog domain — queries, actions, components"
```

---

### Task 5: Campaigns Domain

**Files:**
- Create: `packages/cms-admin/src/campaigns/types.ts`
- Create: `packages/cms-admin/src/campaigns/queries.ts`
- Create: `packages/cms-admin/src/campaigns/actions.ts`
- Create: `packages/cms-admin/src/campaigns/components/campaign-table.tsx`
- Create: `packages/cms-admin/src/campaigns/components/campaign-kpis.tsx`
- Create: `packages/cms-admin/src/campaigns/components/pdf-upload-form.tsx`
- Create: `packages/cms-admin/src/campaigns/client.ts`
- Create: `packages/cms-admin/src/campaigns/index.ts`
- Create: `packages/cms-admin/src/__tests__/campaigns/components/campaign-table.test.tsx`

**Source files (in bythiagofigueiredo):**
- `campaigns/_components/campaign-table.tsx` — 351 lines (CampaignTable + DesktopRow + MobileCard + TypeBadge + LocaleBadge + SparklineWithDelta + DeleteButton)
- `campaigns/_components/campaign-kpis.tsx` — server component with Supabase queries
- `campaigns/_components/pdf-upload-form.tsx` — PDF upload UI
- `campaigns/[id]/edit/actions.ts` — 181 lines (saveCampaign, publishCampaign, unpublishCampaign, archiveCampaign, deleteCampaign)
- `campaigns/page.tsx` — 293 lines (query + enrichment pattern: submission_count, sparkline_data, submissions_delta, pdf status)

**Key adaptation:**
- `CampaignTable` already follows props pattern (receives `CampaignRow[]` + `onDelete` callback). Minimal adaptation needed — just replace `Link` with `useLinkComponent()`.
- `CampaignKpis` is currently a server component with DB queries. Split: queries go to `queries.ts`, component becomes `'use client'` accepting data via props.
- Campaign queries are more complex — involve campaign_submissions joins for sparkline data.

**Implementation:** Follow same pattern as Task 4. Extract queries from `page.tsx` lines 139-242 into `createCampaignQueries`. Adapt `CampaignTable` to use `useLinkComponent()`. Create `CampaignKpis` as pure client component receiving pre-computed values. Actions mirror the existing `actions.ts` with injected config.

- [ ] **Step 1–9:** Follow the same step structure as Task 4 (create dirs → types → queries → actions → components → barrels → tests → run tests → commit)

Each step should produce exact code. The campaign-table component is the most complex (351 lines with 6 sub-components). Copy the existing sub-components (TypeBadge, LocaleBadge, SparklineWithDelta, NoPdfWarning, DeleteButton) into the campaign-table file as-is — they're already self-contained. Only change: replace `Link` from `next/link` with `useLinkComponent()`.

Commit message: `feat(cms-admin): add campaigns domain — queries, actions, components`

---

### Task 6: Newsletters Domain

**Files:**
- Create: `packages/cms-admin/src/newsletters/types.ts`
- Create: `packages/cms-admin/src/newsletters/queries.ts`
- Create: `packages/cms-admin/src/newsletters/actions.ts`
- Create: `packages/cms-admin/src/newsletters/components/editions-table.tsx`
- Create: `packages/cms-admin/src/newsletters/components/type-cards.tsx`
- Create: `packages/cms-admin/src/newsletters/components/edition-analytics.tsx`
- Create: `packages/cms-admin/src/newsletters/client.ts`
- Create: `packages/cms-admin/src/newsletters/index.ts`

**Source files (in bythiagofigueiredo):**
- `newsletters/_components/editions-table.tsx` — edition list table with status badges
- `newsletters/_components/type-cards.tsx` — newsletter type summary cards
- `newsletters/actions.ts` — 215 lines (saveEdition, createEdition, scheduleEdition, cancelEdition, sendTestEmail, assignToSlot, unslotEdition, updateCadence)
- `newsletters/page.tsx` — edition + type queries
- `newsletters/[id]/edit/page.tsx` — single edition query
- `newsletters/[id]/analytics/page.tsx` — analytics data query

**Key adaptation:**
- `sendTestEmail` action depends on `@react-email/render` and `@/emails/newsletter` — this is app-specific email template rendering. The package action should accept a pre-rendered HTML string OR delegate rendering to a consumer-provided callback. Simplest: the package action takes `{ html: string }` instead of rendering internally. Consumer wraps with their own render call.
- Newsletter actions are complex. `createEdition` needs user ID from cookies — pass via config or accept as param.

**Implementation:** Actions that need app-specific dependencies (email rendering, user client from cookies) are simplified in the package to just do the DB mutation. App-specific logic stays in consumer `'use server'` wrappers.

Commit message: `feat(cms-admin): add newsletters domain — queries, actions, components`

---

### Task 7: Subscribers Domain

**Files:**
- Create: `packages/cms-admin/src/subscribers/types.ts`
- Create: `packages/cms-admin/src/subscribers/queries.ts`
- Create: `packages/cms-admin/src/subscribers/components/subscriber-table.tsx`
- Create: `packages/cms-admin/src/subscribers/components/subscriber-kpis.tsx`
- Create: `packages/cms-admin/src/subscribers/components/subscriber-action-menu.tsx`
- Create: `packages/cms-admin/src/subscribers/components/subscriber-mobile-card.tsx`
- Create: `packages/cms-admin/src/subscribers/components/subscriber-icons.tsx`
- Create: `packages/cms-admin/src/subscribers/components/growth-chart.tsx`
- Create: `packages/cms-admin/src/subscribers/components/engagement-dots.tsx`
- Create: `packages/cms-admin/src/subscribers/client.ts`
- Create: `packages/cms-admin/src/subscribers/index.ts`
- Create: `packages/cms-admin/src/__tests__/subscribers/components/subscriber-table.test.tsx`
- Create: `packages/cms-admin/src/__tests__/subscribers/components/growth-chart.test.tsx`

**Source files (in bythiagofigueiredo):**
- `subscribers/_components/subscriber-table.tsx` — 393 lines (SubscriberTable with filter bar, desktop table, pagination)
- `subscribers/_components/subscriber-kpis.tsx` — 121 lines (server component, 4 KPI cards)
- `subscribers/_components/subscriber-action-menu.tsx` — 105 lines (ActionMenu with click-outside)
- `subscribers/_components/subscriber-mobile-card.tsx` — 56 lines
- `subscribers/_components/subscriber-icons.tsx` — 50 lines (TypeBadge, LgpdLockIcon, ConsentIcon)
- `subscribers/_components/growth-chart.tsx` — 187 lines (bar chart with period selector)
- `subscribers/_components/engagement-dots.tsx` — dot status visualization
- `subscribers/page.tsx` — query pattern for subscriber list with pagination

**Key adaptation:**
- `SubscriberTable` is already a `'use client'` component receiving data via props. Minimal changes — just copy and adapt types.
- `SubscriberKpis` is a server component with 4 DB queries. Convert: queries go to `queries.ts`, component becomes `'use client'` with props.
- `GrowthChart` is already fully client-side — copy as-is.
- Subscribers have no write actions (read-only domain in the package).

Commit message: `feat(cms-admin): add subscribers domain — queries, 7 components`

---

### Task 8: Analytics Domain

**Files:**
- Create: `packages/cms-admin/src/analytics/types.ts`
- Create: `packages/cms-admin/src/analytics/queries.ts`
- Create: `packages/cms-admin/src/analytics/demo-data.ts`
- Create: `packages/cms-admin/src/analytics/components/analytics-tabs.tsx`
- Create: `packages/cms-admin/src/analytics/components/overview-tab.tsx`
- Create: `packages/cms-admin/src/analytics/components/content-tab.tsx`
- Create: `packages/cms-admin/src/analytics/components/newsletters-tab.tsx`
- Create: `packages/cms-admin/src/analytics/components/campaigns-tab.tsx`
- Create: `packages/cms-admin/src/analytics/components/area-chart.tsx`
- Create: `packages/cms-admin/src/analytics/components/donut-chart.tsx`
- Create: `packages/cms-admin/src/analytics/components/heatmap.tsx`
- Create: `packages/cms-admin/src/analytics/components/delivery-funnel.tsx`
- Create: `packages/cms-admin/src/analytics/client.ts`
- Create: `packages/cms-admin/src/__tests__/analytics/components/analytics-tabs.test.tsx`

**Source files (in bythiagofigueiredo):**
- `analytics/_components/analytics-tabs.tsx` — tab container
- `analytics/_components/overview-tab.tsx` — 170 lines
- `analytics/_components/content-tab.tsx` — content performance view
- `analytics/_components/newsletters-tab.tsx` — newsletter analytics view
- `analytics/_components/campaigns-tab.tsx` — 129 lines
- `analytics/_components/area-chart.tsx`, `donut-chart.tsx`, `heatmap.tsx`, `delivery-funnel.tsx` — pure chart components
- `analytics/_data/demo-data.ts` — 197 lines of hardcoded demo data

**Key adaptation:**
- All analytics components are already `'use client'` and receive data via props. Copy as-is.
- `demo-data.ts` is pure data — copy directly.
- `queries.ts` returns demo data (no real DB queries yet — Sprint 8+ will add real analytics tables).
- No `index.ts` barrel (analytics has no server-side queries/actions that need injection).

Commit message: `feat(cms-admin): add analytics domain — 9 chart components + demo data`

---

### Task 9: Schedule Domain

**Files:**
- Create: `packages/cms-admin/src/schedule/types.ts`
- Create: `packages/cms-admin/src/schedule/queries.ts`
- Create: `packages/cms-admin/src/schedule/actions.ts`
- Create: `packages/cms-admin/src/schedule/components/schedule-client.tsx`
- Create: `packages/cms-admin/src/schedule/components/week-view.tsx`
- Create: `packages/cms-admin/src/schedule/components/agenda-view.tsx`
- Create: `packages/cms-admin/src/schedule/components/quick-schedule-dialog.tsx`
- Create: `packages/cms-admin/src/schedule/components/backlog-panel.tsx`
- Create: `packages/cms-admin/src/schedule/client.ts`
- Create: `packages/cms-admin/src/schedule/index.ts`
- Create: `packages/cms-admin/src/__tests__/schedule/components/schedule-client.test.tsx`

**Source files (in bythiagofigueiredo):**
- `schedule/_components/schedule-client.tsx` — 121 lines (main schedule view orchestrator)
- `schedule/_components/week-view.tsx` — calendar week grid
- `schedule/_components/agenda-view.tsx` — agenda list view
- `schedule/_components/quick-schedule-dialog.tsx` — scheduling modal
- `schedule/_components/backlog-panel.tsx` — backlog sidebar
- `content-queue/actions.ts` — 100 lines (assignBlogToSlot, unslotBlogPost, publishBlogNow, markBlogReady, reorderBacklog, updateBlogCadence)
- `content-queue/page.tsx` — content queue queries (backlog + slotted + editions + cadences)

**Key adaptation:**
- `ScheduleClient` is already `'use client'` receiving data via props. Copy with minimal changes.
- Sub-components (WeekView, AgendaView, etc.) are all pure UI — copy as-is.
- Content queue queries extracted into `queries.ts`.
- Content queue actions use the factory injection pattern.

Commit message: `feat(cms-admin): add schedule domain — calendar views + content queue`

---

### Task 10: Contacts Domain

**Files:**
- Create: `packages/cms-admin/src/contacts/types.ts`
- Create: `packages/cms-admin/src/contacts/queries.ts`
- Create: `packages/cms-admin/src/contacts/components/contacts-page.tsx`
- Create: `packages/cms-admin/src/contacts/components/contact-detail.tsx`
- Create: `packages/cms-admin/src/contacts/components/author-card.tsx`
- Create: `packages/cms-admin/src/contacts/client.ts`
- Create: `packages/cms-admin/src/contacts/index.ts`

**Source files (in bythiagofigueiredo):**
- `contacts/page.tsx` — 125 lines (server component with query + table)
- `contacts/[id]/page.tsx` — detail view
- `authors/_components/author-card.tsx` — author display card

**Key adaptation:**
- Contacts page is currently a server component with inline query + table rendering. Split: query → `queries.ts`, table → `ContactsPage` client component.
- `StatusBadge` from `cms-ui` stays as import — no change needed.
- Auth check (`can_admin_site` RPC) stays in consumer — package queries just fetch data.

Commit message: `feat(cms-admin): add contacts domain — contacts + author card`

---

### Task 11: Dashboard Domain

**Files:**
- Create: `packages/cms-admin/src/dashboard/types.ts`
- Create: `packages/cms-admin/src/dashboard/queries.ts`
- Create: `packages/cms-admin/src/dashboard/components/dashboard-kpis.tsx`
- Create: `packages/cms-admin/src/dashboard/components/coming-up.tsx`
- Create: `packages/cms-admin/src/dashboard/components/continue-editing.tsx`
- Create: `packages/cms-admin/src/dashboard/client.ts`

**Source files (in bythiagofigueiredo):**
- `_components/dashboard-kpis.tsx` — 51 lines (server component, 4 KPI queries)
- `_components/coming-up.tsx` — 83 lines (server component, upcoming items)
- `_components/continue-editing.tsx` — 43 lines (client component, localStorage)

**Key adaptation:**
- `DashboardKpis` and `ComingUp` are server components with Supabase queries. Split: queries go to `queries.ts` (factory-injected), components become `'use client'` receiving data via props.
- `ContinueEditing` is already a client component using `localStorage` + `Link`. Replace `Link` with `useLinkComponent()`.

Commit message: `feat(cms-admin): add dashboard domain — KPIs, coming up, continue editing`

---

## Phase 2: Integration + Build (Task 12–13)

### Task 12: Populate Root Barrels + Final Wiring

**Files:**
- Modify: `packages/cms-admin/src/client.ts`
- Modify: `packages/cms-admin/src/index.ts`

**Context:** After all domain tasks complete, update the root barrels to re-export everything.

- [ ] **Step 1: Update client.ts with all domain re-exports**

```typescript
'use client'

export { CmsAdminProvider, useLinkComponent } from './context.js'

// Blog
export { PostsPage, PostsTable, PostsFilters, DeletePostButton } from './blog/client.js'
export type { PostsPageProps, DeletePostButtonProps } from './blog/client.js'

// Campaigns
export { CampaignTable, CampaignKpis, PdfUploadForm } from './campaigns/client.js'

// Newsletters
export { EditionsTable, TypeCards, EditionAnalyticsView } from './newsletters/client.js'

// Subscribers
export { SubscriberTable, SubscriberKpis, GrowthChart, SubscriberActionMenu, SubscriberMobileCard, EngagementDots } from './subscribers/client.js'

// Analytics
export { AnalyticsTabs, OverviewTab, ContentTab, NewslettersTab, CampaignsTab, AreaChart, DonutChart, Heatmap, DeliveryFunnel } from './analytics/client.js'

// Schedule
export { ScheduleClient, WeekView, AgendaView, QuickScheduleDialog, BacklogPanel } from './schedule/client.js'

// Contacts
export { ContactsPage, ContactDetail, AuthorCard } from './contacts/client.js'

// Dashboard
export { DashboardKpis, ComingUp, ContinueEditing } from './dashboard/client.js'
```

- [ ] **Step 2: Commit**

```bash
git add packages/cms-admin/src/client.ts packages/cms-admin/src/index.ts
git commit -m "feat(cms-admin): populate root barrels with all domain exports"
```

---

### Task 13: Build, Test, and Publish

**Files:**
- Create: `packages/cms-admin/CHANGELOG.md`
- Verify: all tests pass, build succeeds, package exports are correct

- [ ] **Step 1: Run all tests**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx vitest run --config packages/cms-admin/vitest.config.ts
```

Expected: All tests pass (target: 30+ tests across factory, blog, campaigns, subscribers, analytics, schedule).

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-admin
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Build**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-admin
npm run build
```

Expected: `dist/` directory created with all entry points.

- [ ] **Step 4: Verify exports**

```bash
ls dist/index.js dist/index.cjs dist/index.d.ts
ls dist/client.js dist/client.cjs dist/client.d.ts
ls dist/blog/index.js dist/blog/client.js
ls dist/campaigns/index.js dist/campaigns/client.js
ls dist/newsletters/index.js dist/newsletters/client.js
ls dist/subscribers/index.js dist/subscribers/client.js
ls dist/analytics/client.js
ls dist/schedule/index.js dist/schedule/client.js
ls dist/contacts/index.js dist/contacts/client.js
ls dist/dashboard/client.js
ls dist/styles.css
```

Expected: All 17 entry point JS + CJS + DTS files exist. `styles.css` exists.

- [ ] **Step 5: Write CHANGELOG**

Create `packages/cms-admin/CHANGELOG.md`:

```markdown
# Changelog

## 0.1.0 (2026-04-24)

### Features

- Initial release
- Factory pattern: `createCmsAdmin(config)` for dependency injection
- 8 domains: blog, campaigns, newsletters, subscribers, analytics, schedule, contacts, dashboard
- 38 components with props-based API (zero Supabase dependency)
- `CmsAdminProvider` for injectable link component
- Subpath exports for tree-shaking (`/blog`, `/blog/client`, etc.)
```

- [ ] **Step 6: Publish**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-admin
npm publish
```

Expected: `@tn-figueiredo/cms-admin@0.1.0` published to GitHub Packages.

- [ ] **Step 7: Final commit + push**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add packages/cms-admin/
git commit -m "feat(cms-admin): v0.1.0 — complete CMS admin package"
git push -u origin feat/cms-admin
```

---

## Phase 3: Consumer Migration (Tasks 14–16)

**Working directory:** `/Users/figueiredo/Workspace/bythiagofigueiredo/`

### Task 14: Install Package + Factory Wiring

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/cms/admin.ts`
- Modify: `apps/web/next.config.ts` (add to transpilePackages)
- Modify: `apps/web/src/app/globals.css` (add CSS import)

- [ ] **Step 1: Install the package**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm install @tn-figueiredo/cms-admin@0.1.0 -w apps/web --save-exact
```

- [ ] **Step 2: Create factory wiring**

Create `apps/web/src/lib/cms/admin.ts`:

```typescript
import { createCmsAdmin } from '@tn-figueiredo/cms-admin'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export const cms = createCmsAdmin({
  getClient: getSupabaseServiceClient,
  getSiteContext,
  requireAuth: async () => {
    const ctx = await getSiteContext()
    const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
    if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  },
  revalidatePath,
  revalidateTag,
})
```

- [ ] **Step 3: Add to transpilePackages in next.config.ts**

Find the `transpilePackages` array in `apps/web/next.config.ts` and add `'@tn-figueiredo/cms-admin'`.

- [ ] **Step 4: Add CSS import**

In `apps/web/src/app/globals.css`, add after the `@tn-figueiredo/cms-ui/styles.css` import:

```css
@import '@tn-figueiredo/cms-admin/styles.css';
```

- [ ] **Step 5: Add CmsAdminProvider to CMS layout**

In `apps/web/src/app/cms/(authed)/layout.tsx`, wrap children with `<CmsAdminProvider linkComponent={Link}>`:

```typescript
import { CmsAdminProvider } from '@tn-figueiredo/cms-admin/client'
import Link from 'next/link'

// In the layout render:
<CmsAdminProvider linkComponent={Link}>
  {children}
</CmsAdminProvider>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/cms/admin.ts apps/web/next.config.ts apps/web/src/app/globals.css apps/web/src/app/cms/\(authed\)/layout.tsx
git commit -m "feat: wire @tn-figueiredo/cms-admin factory + provider"
```

---

### Task 15: Replace CMS Pages with Package Imports

**Files to modify:** All CMS page.tsx files and action wrappers
**Files to delete:** All `_components/` files that moved to the package

This task replaces each CMS domain page. Each replacement follows the same pattern:

```typescript
// BEFORE (inline queries + local component imports)
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { PostsTable } from './_components/posts-table'
// ... 60+ lines of inline queries

// AFTER (~8 lines)
import { cms } from '@/lib/cms/admin'
import { PostsPage } from '@tn-figueiredo/cms-admin/blog/client'
export default async function BlogPage({ searchParams }) {
  const params = await searchParams
  const data = await cms.blog.list(params)
  return <PostsPage {...data} />
}
```

- [ ] **Step 1: Replace blog page**

Rewrite `apps/web/src/app/cms/(authed)/blog/page.tsx` to use `cms.blog.list()` + `PostsPage` component.

- [ ] **Step 2: Replace blog actions**

Thin down `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` to re-export from factory:

```typescript
'use server'
import { cms } from '@/lib/cms/admin'

export const savePost = cms.blog.actions.savePost
export const publishPost = cms.blog.actions.publishPost
export const unpublishPost = cms.blog.actions.unpublishPost
export const archivePost = cms.blog.actions.archivePost
export const deletePost = cms.blog.actions.deletePost
export const compilePreview = cms.blog.actions.compilePreview
export const uploadAsset = cms.blog.actions.uploadAsset
```

- [ ] **Step 3: Delete moved blog components**

```bash
rm apps/web/src/app/cms/\(authed\)/blog/_components/posts-table.tsx
rm apps/web/src/app/cms/\(authed\)/blog/_components/posts-filters.tsx
rm apps/web/src/app/cms/\(authed\)/blog/_components/delete-post-button.tsx
```

- [ ] **Step 4: Repeat for campaigns**

Replace `campaigns/page.tsx`, thin down `campaigns/[id]/edit/actions.ts`, delete `_components/campaign-table.tsx`, `campaign-kpis.tsx`, `pdf-upload-form.tsx`.

- [ ] **Step 5: Repeat for newsletters**

Replace `newsletters/page.tsx`, thin down `newsletters/actions.ts`, delete `_components/editions-table.tsx`, `_components/type-cards.tsx`.

- [ ] **Step 6: Repeat for subscribers**

Replace `subscribers/page.tsx`, delete all `subscribers/_components/*.tsx`.

- [ ] **Step 7: Repeat for analytics**

Replace `analytics/page.tsx`, delete all `analytics/_components/*.tsx` and `analytics/_data/demo-data.ts`.

- [ ] **Step 8: Repeat for schedule**

Replace `schedule/page.tsx`, delete all `schedule/_components/*.tsx`.
Replace `content-queue/page.tsx`, thin down `content-queue/actions.ts`.

- [ ] **Step 9: Repeat for contacts**

Replace `contacts/page.tsx` and `contacts/[id]/page.tsx`.

- [ ] **Step 10: Repeat for dashboard**

Replace dashboard components in `_components/dashboard-kpis.tsx`, `_components/coming-up.tsx`, `_components/continue-editing.tsx` with imports from `@tn-figueiredo/cms-admin/dashboard/client`.

- [ ] **Step 11: Commit**

```bash
git add -A apps/web/src/app/cms/
git commit -m "refactor: replace CMS pages with @tn-figueiredo/cms-admin imports"
```

---

### Task 16: Final Verification + Cleanup

- [ ] **Step 1: Run typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 2: Run all tests**

```bash
npm run test:web
```

Expected: All tests pass. Some tests may need updating if they imported components that moved.

- [ ] **Step 3: Start dev server and smoke test**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run dev -w apps/web
```

Visit in browser:
- `/cms` — Dashboard KPIs render, ComingUp shows scheduled items
- `/cms/blog` — Posts table renders with filters
- `/cms/campaigns` — Campaign table with sparklines
- `/cms/newsletters` — Edition list and type cards
- `/cms/subscribers` — Subscriber table with engagement dots
- `/cms/analytics` — All 4 tabs render with charts
- `/cms/schedule` — Week view calendar loads
- `/cms/contacts` — Contact list with status badges

- [ ] **Step 4: Count lines deleted vs added**

```bash
git diff --stat HEAD~2
```

Expected: ~5,000 lines deleted, ~200 lines of wiring added.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: cleanup after cms-admin migration — remove orphaned files"
```
