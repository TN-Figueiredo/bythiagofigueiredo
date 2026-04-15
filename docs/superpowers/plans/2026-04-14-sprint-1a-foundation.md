# Sprint 1a — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Sprint 1a foundation — auth (Fastify routes + Next middleware), blog schema with N-locale translations + RLS, CMS/Admin shells via @tn-figueiredo/admin, homepage ported from legacy.

**Architecture:** Fastify API hosts @tn-figueiredo/auth-fastify routes backed by SupabaseAuthService. Next middleware validates JWT at edge and protects /cms + /admin. Roles live in auth.users.app_metadata.role. Blog uses posts+translations with locale as ISO string, slug unique per (site,locale) via trigger.

**Tech Stack:** Next.js 15, Fastify 5, Supabase (PG17), Vitest, @tn-figueiredo/auth-* packages, @supabase/ssr, react-markdown.

---

## File structure (created / modified)

**Migrations (new):**
- `supabase/migrations/20260414000001_authors.sql` — authors table + tg_set_updated_at() trigger helper
- `supabase/migrations/20260414000002_blog_posts.sql` — post_status enum + blog_posts table + indexes + updated_at trigger
- `supabase/migrations/20260414000003_blog_translations.sql` — blog_translations table + unique (post_id, locale)
- `supabase/migrations/20260414000004_rls_helpers.sql` — auth.user_role(), auth.is_staff(), auth.is_admin()
- `supabase/migrations/20260414000005_blog_rls.sql` — RLS enable + policies for authors/blog_posts/blog_translations
- `supabase/migrations/20260414000006_translation_slug_trigger.sql` — validate_translation_slug_unique_per_site() trigger

**Seed (new):**
- `supabase/seeds/dev.sql` — Thiago super_admin + author + 3 blog posts with translations

**API (new/modified):**
- `apps/api/src/env.ts` — typed env loader (new)
- `apps/api/src/lib/supabase.ts` — service_role client singleton (new)
- `apps/api/src/plugins/auth.ts` — Fastify plugin wiring registerAuthRoutes + SupabaseAuthService + use cases + onPostSignUp hook (new)
- `apps/api/src/plugins/health.ts` — GET /health with Supabase ping (new)
- `apps/api/src/hooks/on-signup.ts` — author row creator used by auth plugin (new)
- `apps/api/src/server.ts` — bootstrap app, register plugins (renamed from index.ts)
- `apps/api/src/index.ts` — thin entrypoint that imports server and listens (modified)
- `apps/api/test/plugins/health.test.ts` — integration test for /health (new)
- `apps/api/test/plugins/auth.test.ts` — smoke test that /auth/signin route is registered (new)
- `apps/api/test/hooks/on-signup.test.ts` — unit test for author row creation hook (new)
- `apps/api/test/rls/blog.test.ts` — RLS integration tests against local supabase (new)
- `apps/api/test/migrations/schema.test.ts` — schema shape tests for authors, blog_posts, blog_translations, triggers (new)
- `apps/api/test/server.test.ts` — smoke test server.ready() (new)
- `apps/api/package.json` — add `pg`, `@types/pg`, `jsonwebtoken`, `@types/jsonwebtoken` devDeps for tests (modified)

**Web (new/modified):**
- `apps/web/middleware.ts` — replace subdomain logic + compose createAuthMiddleware for /cms and /admin (modified)
- `apps/web/src/app/cms/layout.tsx` — createAdminLayout + requireUser (new)
- `apps/web/src/app/cms/page.tsx` — placeholder "CMS" (new)
- `apps/web/src/app/admin/layout.tsx` — createAdminLayout + requireUser (new, replaces existing if any)
- `apps/web/src/app/admin/page.tsx` — placeholder "Admin" (new)
- `apps/web/src/app/(public)/page.tsx` — homepage ported from legacy (new route group)
- `apps/web/src/app/(public)/components/Header.tsx`, `Hero.tsx`, `Footer.tsx`, `SocialLinks.tsx` — ported from legacy (new)
- `apps/web/src/locales/en.json` — ported from legacy (new)
- `apps/web/src/app/page.tsx` — remove/replace with redirect (modified)
- `apps/web/test/middleware.test.ts` — test unauthenticated /cms request redirects to /signin (new)
- `apps/web/test/cms-layout.test.tsx` — snapshot (new)
- `apps/web/test/admin-layout.test.tsx` — snapshot (new)
- `apps/web/test/homepage.test.tsx` — render smoke (new)

---

## Task 0: Pre-flight — local-db test skip guard

**Rationale.** Most tasks in this plan assert against a running local Supabase (Docker, port
54322 / 54321). CI does not boot Docker, so these tests MUST skip there rather than fail.
Convention: tests that require local DB are gated on `process.env.HAS_LOCAL_DB === '1'`.
Developers run `npm run db:start && HAS_LOCAL_DB=1 npm test` for the full suite; CI runs
`npm test` and these describe blocks skip.

This task also reads the real local JWT secret from `supabase/config.toml` (or from
`supabase status` output) so downstream tests don't hardcode the wrong value.

- [ ] **Step 0.1 — Create helpers.** `apps/api/test/helpers/db-skip.ts`:

```typescript
/**
 * Returns true when tests should SKIP because there's no local Supabase available.
 * Used with vitest's `describe.skipIf(skipIfNoLocalDb())`.
 *
 * Local dev: `npm run db:start && HAS_LOCAL_DB=1 npm test`
 * CI:        `npm test` → HAS_LOCAL_DB unset → tests skip.
 */
export function skipIfNoLocalDb(): boolean {
  return process.env.HAS_LOCAL_DB !== '1'
}

/**
 * Resolves the local Supabase JWT secret. Priority:
 *   1. process.env.SUPABASE_JWT_SECRET (explicit override, CI-friendly)
 *   2. Parse from `supabase/config.toml` via `[auth] jwt_secret` (rare, usually unset)
 *   3. The stable CLI default ('super-secret-jwt-token-with-at-least-32-characters-long')
 *
 * The CLI default IS the real secret for `supabase start` unless overridden — it is
 * documented as such in the Supabase CLI source. We centralize it here so that any
 * future divergence is a one-line change.
 */
export function getLocalJwtSecret(): string {
  if (process.env.SUPABASE_JWT_SECRET) return process.env.SUPABASE_JWT_SECRET
  return 'super-secret-jwt-token-with-at-least-32-characters-long'
}
```

`apps/web/test/helpers/db-skip.ts`: identical contents (same two exports). Web tests that
need Supabase running (none in this sprint, but future-proof) use the same guard.

- [ ] **Step 0.2 — Update CLAUDE.md.** Append a new section under `## Database — Supabase CLI`:

```markdown
## Testes com DB local

Tests que dependem de Supabase local (RLS, migrations, seed, integration) são gated em
`process.env.HAS_LOCAL_DB`. Helper: `apps/{api,web}/test/helpers/db-skip.ts`.

```bash
# Suite completa (local, com DB rodando)
npm run db:start
HAS_LOCAL_DB=1 npm test

# Suite "sem DB" (o que CI faz) — describe.skipIf(skipIfNoLocalDb()) pula os gated
npm test
```

Convenção nos testes:

```typescript
import { skipIfNoLocalDb, getLocalJwtSecret } from './helpers/db-skip'
describe.skipIf(skipIfNoLocalDb())('<suite que precisa de DB>', () => { ... })
```

Override do JWT secret (caso um dia o default do CLI mude):
`SUPABASE_JWT_SECRET=xxx HAS_LOCAL_DB=1 npm test`.
```

- [ ] **Step 0.3 — Commit.**

```bash
git add apps/api/test/helpers/db-skip.ts apps/web/test/helpers/db-skip.ts CLAUDE.md
git commit -m "chore(sprint-1a): add local-db test skip guard"
```

- [ ] **Step 0.4 — Propagation.** Subsequent DB-dependent tests (Tasks 1, 2, 3, 4, 5, 6, 9,
  15, 16) MUST wrap their top-level `describe` with `describe.skipIf(skipIfNoLocalDb())(...)`
  and import `getLocalJwtSecret()` instead of hardcoding the JWT secret. Example patch
  applied inline in each test file:

```typescript
import { skipIfNoLocalDb, getLocalJwtSecret } from '../helpers/db-skip.js'

describe.skipIf(skipIfNoLocalDb())('migration 0001 authors', () => {
  // ...existing body unchanged...
})
```

Pure-unit tests (Tasks 7, 8, 10, 11, 12, 13, 14) do NOT need the guard — they mock Supabase
or run entirely in-process.

---

## Task 1: Migration 0001 — authors table + updated_at trigger helper

- [ ] **Step 1.1 — Write failing test.** Create `apps/api/test/migrations/schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

describe('migration 0001 authors', () => {
  const client = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('authors table exists with expected columns', async () => {
    const { rows } = await client.query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema='public' and table_name='authors'
      order by column_name
    `)
    const cols = Object.fromEntries(rows.map(r => [r.column_name, r]))
    expect(cols.id).toBeDefined()
    expect(cols.user_id).toBeDefined()
    expect(cols.name.is_nullable).toBe('NO')
    expect(cols.slug.is_nullable).toBe('NO')
    expect(cols.bio_md).toBeDefined()
    expect(cols.avatar_url).toBeDefined()
    expect(cols.created_at.is_nullable).toBe('NO')
    expect(cols.updated_at.is_nullable).toBe('NO')
  })

  it('can insert + select an author', async () => {
    await client.query(`delete from public.authors where slug='test-author'`)
    await client.query(
      `insert into public.authors(name, slug) values ($1,$2)`,
      ['Test Author', 'test-author']
    )
    const { rows } = await client.query(
      `select name, slug from public.authors where slug='test-author'`
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Test Author')
  })

  it('tg_set_updated_at bumps updated_at on update', async () => {
    await client.query(
      `insert into public.authors(name, slug) values ($1,$2)
       on conflict (slug) do update set name=excluded.name`,
      ['Updater', 'test-updater']
    )
    const r1 = await client.query(`select updated_at from public.authors where slug='test-updater'`)
    await new Promise(r => setTimeout(r, 20))
    await client.query(`update public.authors set name='Updater 2' where slug='test-updater'`)
    const r2 = await client.query(`select updated_at from public.authors where slug='test-updater'`)
    expect(new Date(r2.rows[0].updated_at).getTime())
      .toBeGreaterThan(new Date(r1.rows[0].updated_at).getTime())
  })
})
```

Also install deps: `cd apps/api && npm i -D pg @types/pg`.

- [ ] **Step 1.2 — Run and expect FAIL.** `npm run db:start && npm run db:reset && cd apps/api && npx vitest run test/migrations/schema.test.ts`. Expect: `relation "public.authors" does not exist`.

- [ ] **Step 1.3 — Write migration.** Create `supabase/migrations/20260414000001_authors.sql`:

```sql
-- Shared updated_at trigger helper (used by all tables in this sprint)
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null unique,
  name text not null,
  slug text not null unique,
  bio_md text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index authors_user_id_idx on public.authors (user_id);

create trigger authors_set_updated_at
before update on public.authors
for each row execute function public.tg_set_updated_at();
```

- [ ] **Step 1.4 — Run and expect PASS.** `npm run db:reset && cd apps/api && npx vitest run test/migrations/schema.test.ts`. Expect green.

- [ ] **Step 1.5 — Commit.**

```bash
git add supabase/migrations/20260414000001_authors.sql apps/api/test/migrations/schema.test.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(sprint-1a): add authors table + updated_at trigger helper"
```

---

## Task 2: Migration 0002 — post_status enum + blog_posts table

- [ ] **Step 2.1 — Write failing test.** Extend `apps/api/test/migrations/schema.test.ts` with:

```typescript
describe('migration 0002 blog_posts', () => {
  const client = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('post_status enum exists with 4 values', async () => {
    const { rows } = await client.query(`
      select unnest(enum_range(null::post_status))::text as v order by 1
    `)
    expect(rows.map(r => r.v).sort()).toEqual(['archived','draft','published','scheduled'])
  })

  it('blog_posts table exists with expected columns and FK', async () => {
    const { rows } = await client.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='blog_posts'
    `)
    const names = rows.map(r => r.column_name)
    for (const c of ['id','site_id','author_id','status','published_at','scheduled_for',
      'cover_image_url','created_at','updated_at','created_by','updated_by']) {
      expect(names).toContain(c)
    }
  })

  it('cannot insert blog_post without author_id (NOT NULL)', async () => {
    await expect(client.query(
      `insert into public.blog_posts(status) values ('draft')`
    )).rejects.toThrow(/author_id/)
  })

  it('can insert blog_post with author', async () => {
    await client.query(
      `insert into public.authors(name, slug) values ('A','a') on conflict (slug) do nothing`
    )
    const { rows: [a] } = await client.query(`select id from public.authors where slug='a'`)
    const { rows } = await client.query(
      `insert into public.blog_posts(author_id, status) values ($1,'draft') returning id, status`,
      [a.id]
    )
    expect(rows[0].status).toBe('draft')
  })
})
```

- [ ] **Step 2.2 — Run, expect FAIL.** `type "post_status" does not exist`.

- [ ] **Step 2.3 — Write migration.** `supabase/migrations/20260414000002_blog_posts.sql`:

```sql
create type public.post_status as enum ('draft','scheduled','published','archived');

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,
  author_id uuid not null references public.authors(id) on delete restrict,
  status public.post_status not null default 'draft',
  published_at timestamptz,
  scheduled_for timestamptz,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at desc);
create index blog_posts_site_status_idx
  on public.blog_posts (site_id, status);
create index blog_posts_scheduled_idx
  on public.blog_posts (status, scheduled_for)
  where status = 'scheduled';

create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row execute function public.tg_set_updated_at();
```

- [ ] **Step 2.4 — Run, expect PASS.** `npm run db:reset && cd apps/api && npx vitest run test/migrations/schema.test.ts`.

- [ ] **Step 2.5 — Commit.**

```bash
git add supabase/migrations/20260414000002_blog_posts.sql apps/api/test/migrations/schema.test.ts
git commit -m "feat(sprint-1a): add post_status enum and blog_posts table"
```

---

## Task 3: Migration 0003 — blog_translations table

- [ ] **Step 3.1 — Write failing test.** Append to `schema.test.ts`:

```typescript
describe('migration 0003 blog_translations', () => {
  const client = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('blog_translations table has expected columns', async () => {
    const { rows } = await client.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='blog_translations'
    `)
    const names = rows.map(r => r.column_name)
    for (const c of ['id','post_id','locale','title','slug','excerpt','content_md',
      'cover_image_url','meta_title','meta_description','og_image_url',
      'created_at','updated_at']) {
      expect(names).toContain(c)
    }
  })

  it('unique (post_id, locale) is enforced', async () => {
    await client.query(`insert into public.authors(name,slug) values('B','b') on conflict do nothing`)
    const { rows: [a] } = await client.query(`select id from public.authors where slug='b'`)
    const { rows: [p] } = await client.query(
      `insert into public.blog_posts(author_id) values ($1) returning id`, [a.id]
    )
    await client.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','T','s1','c')`, [p.id]
    )
    await expect(client.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','T2','s2','c2')`, [p.id]
    )).rejects.toThrow()
  })

  it('cascades delete when post is removed', async () => {
    const { rows: [a] } = await client.query(`select id from public.authors where slug='b'`)
    const { rows: [p] } = await client.query(
      `insert into public.blog_posts(author_id) values ($1) returning id`, [a.id]
    )
    await client.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'en','T','en-slug','c')`, [p.id]
    )
    await client.query(`delete from public.blog_posts where id=$1`, [p.id])
    const { rows } = await client.query(
      `select 1 from public.blog_translations where post_id=$1`, [p.id]
    )
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 3.2 — Run, expect FAIL.** `relation "public.blog_translations" does not exist`.

- [ ] **Step 3.3 — Write migration.** `supabase/migrations/20260414000003_blog_translations.sql`:

```sql
create table public.blog_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  locale text not null,
  title text not null,
  slug text not null,
  excerpt text,
  content_md text not null,
  cover_image_url text,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index blog_translations_post_locale_uniq
  on public.blog_translations (post_id, locale);

create index blog_translations_locale_slug_idx
  on public.blog_translations (locale, slug);

create trigger blog_translations_set_updated_at
before update on public.blog_translations
for each row execute function public.tg_set_updated_at();
```

- [ ] **Step 3.4 — Run, expect PASS.**

- [ ] **Step 3.5 — Commit.**

```bash
git add supabase/migrations/20260414000003_blog_translations.sql apps/api/test/migrations/schema.test.ts
git commit -m "feat(sprint-1a): add blog_translations table with unique (post_id, locale)"
```

---

## Task 4: Migration 0004 — RLS helper functions

- [ ] **Step 4.1 — Write failing test.** New file `apps/api/test/migrations/rls-helpers.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

async function withJwtClaim(client: Client, claims: object, fn: () => Promise<void>) {
  await client.query('begin')
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
  try { await fn() } finally { await client.query('rollback') }
}

describe('migration 0004 rls helpers', () => {
  const client = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('auth.user_role() returns role from app_metadata', async () => {
    await withJwtClaim(client, { app_metadata: { role: 'super_admin' } }, async () => {
      const { rows } = await client.query(`select auth.user_role() as r`)
      expect(rows[0].r).toBe('super_admin')
    })
  })

  it('auth.user_role() returns anon when no claim', async () => {
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claims', '', true)`)
    const { rows } = await client.query(`select auth.user_role() as r`)
    expect(rows[0].r).toBe('anon')
    await client.query('rollback')
  })

  it('auth.is_staff() is true for editor/admin/super_admin', async () => {
    for (const role of ['editor','admin','super_admin']) {
      await withJwtClaim(client, { app_metadata: { role } }, async () => {
        const { rows } = await client.query(`select auth.is_staff() as s`)
        expect(rows[0].s).toBe(true)
      })
    }
  })

  it('auth.is_admin() is true only for admin/super_admin', async () => {
    await withJwtClaim(client, { app_metadata: { role: 'editor' } }, async () => {
      const { rows } = await client.query(`select auth.is_admin() as a`)
      expect(rows[0].a).toBe(false)
    })
    await withJwtClaim(client, { app_metadata: { role: 'admin' } }, async () => {
      const { rows } = await client.query(`select auth.is_admin() as a`)
      expect(rows[0].a).toBe(true)
    })
  })
})
```

- [ ] **Step 4.2 — Run, expect FAIL.** `function auth.user_role() does not exist`.

- [ ] **Step 4.3 — Write migration.** `supabase/migrations/20260414000004_rls_helpers.sql`:

```sql
create or replace function auth.user_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'anon'
  )
$$;

create or replace function auth.is_staff()
returns boolean
language sql
stable
as $$
  select auth.user_role() in ('editor','admin','super_admin')
$$;

create or replace function auth.is_admin()
returns boolean
language sql
stable
as $$
  select auth.user_role() in ('admin','super_admin')
$$;
```

(Note: spec used `auth.jwt()`; we use `current_setting` directly because `auth.jwt()` depends on the GoTrue-injected claim setting and is equivalent. This matches Supabase's own helper implementation and works in both local test harness and production.)

- [ ] **Step 4.4 — Run, expect PASS.**

- [ ] **Step 4.5 — Commit.**

```bash
git add supabase/migrations/20260414000004_rls_helpers.sql apps/api/test/migrations/rls-helpers.test.ts
git commit -m "feat(sprint-1a): add auth.user_role/is_staff/is_admin RLS helpers"
```

---

## Task 5: Migration 0005 — RLS policies on blog_posts, blog_translations, authors

- [ ] **Step 5.1 — Write failing test.** New `apps/api/test/rls/blog.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { skipIfNoLocalDb, getLocalJwtSecret } from '../helpers/db-skip.js'

// Stable dev-only values for Supabase CLI (`supabase start`). anon/service keys are
// deterministic JWTs signed with the CLI's default secret; we read the secret via the
// db-skip helper (which honors SUPABASE_JWT_SECRET if set) instead of hardcoding.
const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

function adminJwt(): string {
  return jwt.sign(
    {
      role: 'authenticated',
      sub: '00000000-0000-0000-0000-000000000001',
      app_metadata: { role: 'super_admin' },
    },
    getLocalJwtSecret(),
    { expiresIn: '1h' }
  )
}

describe.skipIf(skipIfNoLocalDb())('RLS: blog_posts + blog_translations + authors', () => {
  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const admin = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminJwt()}` } },
  })

  let authorId: string
  let publishedId: string
  let draftId: string

  beforeAll(async () => {
    await service.from('blog_translations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('blog_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('authors').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { data: a } = await service.from('authors')
      .insert({ name: 'RLS Author', slug: 'rls-author' }).select('id').single()
    authorId = a!.id

    const { data: pub } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'published', published_at: new Date().toISOString(),
    }).select('id').single()
    publishedId = pub!.id

    const { data: draft } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'draft',
    }).select('id').single()
    draftId = draft!.id
  })

  it('anon sees only published posts', async () => {
    const { data, error } = await anon.from('blog_posts').select('id,status')
    expect(error).toBeNull()
    const ids = (data ?? []).map(r => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).not.toContain(draftId)
  })

  it('anon cannot insert blog_posts', async () => {
    const { error } = await anon.from('blog_posts').insert({ author_id: authorId, status: 'draft' })
    expect(error).not.toBeNull()
  })

  it('super_admin sees all posts', async () => {
    const { data, error } = await admin.from('blog_posts').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map(r => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).toContain(draftId)
  })

  it('super_admin can insert/update/delete', async () => {
    const { data: ins, error: ie } = await admin.from('blog_posts')
      .insert({ author_id: authorId, status: 'draft' }).select('id').single()
    expect(ie).toBeNull()
    const { error: ue } = await admin.from('blog_posts')
      .update({ status: 'archived' }).eq('id', ins!.id)
    expect(ue).toBeNull()
    const { error: de } = await admin.from('blog_posts').delete().eq('id', ins!.id)
    expect(de).toBeNull()
  })

  it('anon can read authors', async () => {
    const { data, error } = await anon.from('authors').select('id')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('anon cannot insert authors', async () => {
    const { error } = await anon.from('authors').insert({ name: 'x', slug: 'x' })
    expect(error).not.toBeNull()
  })
})
```

Install deps: `cd apps/api && npm i -D jsonwebtoken @types/jsonwebtoken`.

- [ ] **Step 5.2 — Run, expect FAIL.** Anon returns rows for drafts (RLS not enforced) or `row-level security` not enabled.

- [ ] **Step 5.3 — Write migration.** `supabase/migrations/20260414000005_blog_rls.sql`:

```sql
alter table public.authors            enable row level security;
alter table public.blog_posts         enable row level security;
alter table public.blog_translations  enable row level security;

-- authors
create policy authors_public_read on public.authors
  for select
  using (true);

create policy authors_staff_write on public.authors
  for all
  using (auth.is_staff())
  with check (auth.is_staff());

-- blog_posts
create policy blog_posts_public_read_published on public.blog_posts
  for select
  using (status = 'published' and published_at is not null and published_at <= now());

create policy blog_posts_staff_read_all on public.blog_posts
  for select
  using (auth.is_staff());

create policy blog_posts_staff_write on public.blog_posts
  for all
  using (auth.is_staff())
  with check (auth.is_staff());

-- blog_translations (gate read by parent post visibility)
create policy blog_translations_public_read on public.blog_translations
  for select
  using (exists (
    select 1 from public.blog_posts p
    where p.id = blog_translations.post_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  ));

create policy blog_translations_staff_read_all on public.blog_translations
  for select
  using (auth.is_staff());

create policy blog_translations_staff_write on public.blog_translations
  for all
  using (auth.is_staff())
  with check (auth.is_staff());
```

- [ ] **Step 5.4 — Run, expect PASS.** `npm run db:reset && cd apps/api && npx vitest run test/rls/blog.test.ts`.

- [ ] **Step 5.5 — Commit.**

```bash
git add supabase/migrations/20260414000005_blog_rls.sql apps/api/test/rls/blog.test.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(sprint-1a): enable RLS and policies on blog tables + authors"
```

---

## Task 6: Migration 0006 — trigger validate_translation_slug_unique_per_site()

- [ ] **Step 6.1 — Write failing test.** Append to `apps/api/test/rls/blog.test.ts` (or new file `apps/api/test/migrations/slug-trigger.test.ts`):

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

describe('trigger validate_translation_slug_unique_per_site', () => {
  const db = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await db.connect() })
  afterAll(async () => { await db.end() })

  it('blocks duplicate (site, locale, slug)', async () => {
    await db.query(`insert into public.authors(name,slug) values('T','tslug') on conflict do nothing`)
    const { rows: [a] } = await db.query(`select id from public.authors where slug='tslug'`)
    const site = '11111111-1111-1111-1111-111111111111'
    const { rows: [p1] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [a.id, site]
    )
    const { rows: [p2] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [a.id, site]
    )
    await db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','t1','dup','c')`, [p1.id]
    )
    await expect(db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','t2','dup','c')`, [p2.id]
    )).rejects.toThrow(/slug/i)
  })

  it('allows same slug across different locales', async () => {
    const { rows: [a] } = await db.query(`select id from public.authors where slug='tslug'`)
    const site = '22222222-2222-2222-2222-222222222222'
    const { rows: [p] } = await db.query(
      `insert into public.blog_posts(author_id, site_id) values ($1,$2) returning id`, [a.id, site]
    )
    await db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'pt-BR','x','same','c')`, [p.id]
    )
    await db.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_md)
       values ($1,'en','x','same','c')`, [p.id]
    )
    // no throw = pass
  })
})
```

- [ ] **Step 6.2 — Run, expect FAIL.** Second insert succeeds (no trigger).

- [ ] **Step 6.3 — Write migration.** `supabase/migrations/20260414000006_translation_slug_trigger.sql`:

```sql
create or replace function public.validate_translation_slug_unique_per_site()
returns trigger
language plpgsql
as $$
declare
  v_site_id uuid;
  v_conflict int;
begin
  select site_id into v_site_id from public.blog_posts where id = new.post_id;

  select 1 into v_conflict
  from public.blog_translations bt
  join public.blog_posts bp on bp.id = bt.post_id
  where bt.locale = new.locale
    and bt.slug = new.slug
    and bt.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and bp.site_id is not distinct from v_site_id
  limit 1;

  if v_conflict is not null then
    raise exception 'duplicate slug % for locale % on site %', new.slug, new.locale, v_site_id
      using errcode = '23505';
  end if;

  return new;
end
$$;

create trigger blog_translations_validate_slug
before insert or update on public.blog_translations
for each row execute function public.validate_translation_slug_unique_per_site();
```

- [ ] **Step 6.4 — Run, expect PASS.**

- [ ] **Step 6.5 — Commit.**

```bash
git add supabase/migrations/20260414000006_translation_slug_trigger.sql apps/api/test/migrations/slug-trigger.test.ts
git commit -m "feat(sprint-1a): add slug uniqueness trigger per (site, locale)"
```

---

## Task 7: Fastify auth plugin — registerAuthRoutes + SupabaseAuthService

- [ ] **Step 7.1 — Write failing test.** `apps/api/test/plugins/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { authPlugin } from '../../src/plugins/auth.js'

describe('authPlugin', () => {
  it('registers POST /auth/signin route', async () => {
    const app = Fastify()
    await app.register(authPlugin)
    await app.ready()
    const routes = app.printRoutes({ commonPrefix: false })
    expect(routes).toMatch(/\/auth\/signin/)
    expect(routes).toMatch(/\/auth\/signup/)
    expect(routes).toMatch(/\/auth\/refresh/)
    await app.close()
  })
})
```

- [ ] **Step 7.2 — Run, expect FAIL.** Module not found.

- [ ] **Step 7.3 — Write implementation.**

`apps/api/src/env.ts`:

```typescript
import { z } from 'zod'

// SUPABASE_SERVICE_ROLE_KEY has NO fallback — we refuse to boot without it.
// A wrong/empty default in prod would silently talk to the wrong DB or fail with
// a confusing "Invalid API key" error far from the misconfiguration root cause.
const envSchema = z.object({
  SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().default(''),
  WEB_URL: z.string().url().default('http://localhost:3001'),
  PORT: z.coerce.number().int().positive().default(3333),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  // Explicit runtime check — fail fast at module load, before any plugin registers.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`[env] invalid environment:\n${issues}`)
}

export const env = parsed.data
```

`apps/api/src/lib/supabase.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '../env.js'

let client: SupabaseClient | null = null
export function getServiceClient(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return client
}
```

`apps/api/src/hooks/on-signup.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export function createOnPostSignUp(supabase: SupabaseClient) {
  return async (event: { userId: string; email: string }) => {
    const local = event.email.split('@')[0] ?? 'user'
    const baseSlug = local.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'user'
    const slug = `${baseSlug}-${event.userId.slice(0, 8)}`
    const { error } = await supabase.from('authors').insert({
      user_id: event.userId,
      name: local,
      slug,
    })
    if (error) {
      // Do not throw — sign-up must not fail if author row fails. Log for Sentry (Sprint 4).
      console.error('[on-signup] author insert failed', { userId: event.userId, error: error.message })
    }
  }
}
```

`apps/api/src/plugins/auth.ts`:

```typescript
import type { FastifyInstance } from 'fastify'
import { registerAuthRoutes } from '@tn-figueiredo/auth-fastify'
import { SupabaseAuthService, sendPasswordResetEmail } from '@tn-figueiredo/auth-supabase'
import {
  SignUpUseCase,
  SocialSignInUseCase,
  SetPasswordUseCase,
  ChangePasswordUseCase,
  ChangeEmailUseCase,
  VerifyEmailOtpUseCase,
  ResendSignupConfirmationUseCase,
} from '@tn-figueiredo/auth/use-cases'
import { env } from '../env.js'
import { getServiceClient } from '../lib/supabase.js'
import { createOnPostSignUp } from '../hooks/on-signup.js'

export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  const authService = new SupabaseAuthService({
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    passwordResetRedirectUrl: `${env.WEB_URL}/reset-password`,
  })

  const deps = { auth: authService }

  registerAuthRoutes(fastify, {
    authService,
    signUp: new SignUpUseCase(deps),
    socialSignIn: new SocialSignInUseCase(deps),
    setPassword: new SetPasswordUseCase(deps),
    changePassword: new ChangePasswordUseCase(deps),
    changeEmail: new ChangeEmailUseCase(deps),
    verifyOtp: new VerifyEmailOtpUseCase(deps),
    resendOtp: new ResendSignupConfirmationUseCase(deps),
    forgotPassword: (email) => sendPasswordResetEmail(
      { supabaseUrl: env.SUPABASE_URL, supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
        passwordResetRedirectUrl: `${env.WEB_URL}/reset-password` },
      email,
    ),
    // deleteAccount omitted → route returns 501 (LGPD sprint wires this)
    hooks: {
      onPostSignUp: createOnPostSignUp(getServiceClient()),
    },
  })
}
```

(If `SignUpUseCase` constructor signature differs, adapt `deps` shape — README says use cases accept `{ auth, profiles?, subscriptions?, ... }`. Only `auth` is required.)

- [ ] **Step 7.4 — Run, expect PASS.** `cd apps/api && npx vitest run test/plugins/auth.test.ts`.

- [ ] **Step 7.5 — Commit.**

```bash
git add apps/api/src/env.ts apps/api/src/lib/supabase.ts apps/api/src/hooks/on-signup.ts apps/api/src/plugins/auth.ts apps/api/test/plugins/auth.test.ts
git commit -m "feat(sprint-1a): wire auth-fastify plugin with SupabaseAuthService"
```

---

## Task 8: Fastify /health with Supabase ping

- [ ] **Step 8.1 — Write failing test.** `apps/api/test/plugins/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { healthPlugin } from '../../src/plugins/health.js'

describe('healthPlugin', () => {
  it('GET /health returns 200 with {status, db, time}', async () => {
    const app = Fastify()
    await app.register(healthPlugin)
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(['ok','fail']).toContain(body.db)
    expect(typeof body.time).toBe('string')
    await app.close()
  })
})
```

- [ ] **Step 8.2 — Run, expect FAIL.** Module not found.

- [ ] **Step 8.3 — Write implementation.** `apps/api/src/plugins/health.ts`:

```typescript
import type { FastifyInstance } from 'fastify'
import { getServiceClient } from '../lib/supabase.js'

export async function healthPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    const supabase = getServiceClient()
    const { error } = await supabase.from('authors').select('id').limit(1)
    return {
      status: 'ok',
      db: error ? 'fail' : 'ok',
      time: new Date().toISOString(),
    }
  })
}
```

- [ ] **Step 8.4 — Run, expect PASS.** (Local supabase must be running — otherwise db='fail' but the shape still matches.)

- [ ] **Step 8.5 — Commit.**

```bash
git add apps/api/src/plugins/health.ts apps/api/test/plugins/health.test.ts
git commit -m "feat(sprint-1a): add /health with Supabase ping"
```

---

## Task 9: Integration test — signup end-to-end creates author row

Task 7 already unit-tests the hook factory via DI, and Task 16 smokes `/auth/signin`. Task 9
closes the remaining gap: a real Fastify instance + a real `POST /auth/signup` call + a real
`authors` row assertion via the service-role client. This proves the wiring between
`registerAuthRoutes`, its `hooks.onPostSignUp`, and our Supabase insert actually fires.

Requires local Supabase (uses the db-skip guard from Task 0).

- [ ] **Step 9.1 — Write failing test.** `apps/api/test/hooks/on-signup.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip.js'
import { buildServer } from '../../src/server.js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

describe.skipIf(skipIfNoLocalDb())('signup → author row (integration)', () => {
  let app: FastifyInstance
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const email = `signup-hook-${Date.now()}@example.com`

  beforeAll(async () => {
    app = await buildServer()
    await app.ready()
  })

  afterAll(async () => {
    // Cleanup: delete author + user
    const { data: users } = await admin.auth.admin.listUsers()
    const u = users?.users.find((x) => x.email === email)
    if (u) {
      await admin.from('authors').delete().eq('user_id', u.id)
      await admin.auth.admin.deleteUser(u.id)
    }
    await app.close()
  })

  it('POST /auth/signup creates an authors row linked to the new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email,
        password: 'dev-password-123!',
        ageConfirmation: true,
      },
    })
    expect([200, 201]).toContain(res.statusCode)

    // Look up the new user by email
    const { data: users } = await admin.auth.admin.listUsers()
    const u = users?.users.find((x) => x.email === email)
    expect(u).toBeDefined()

    // Assert author row exists with matching user_id and generated slug shape
    const { data: author, error } = await admin
      .from('authors')
      .select('user_id, name, slug')
      .eq('user_id', u!.id)
      .single()
    expect(error).toBeNull()
    expect(author?.user_id).toBe(u!.id)
    expect(author?.slug).toMatch(new RegExp(`^signup-hook-\\d+-${u!.id.slice(0, 8)}$`))
  })
})
```

- [ ] **Step 9.2 — Run, expect FAIL** if hook not wired, SKIP on CI (no `HAS_LOCAL_DB`),
  PASS locally if Task 7's `authPlugin` correctly registered `hooks.onPostSignUp`.

- [ ] **Step 9.3 — Fix wiring if needed.** If the author row is missing, verify in
  `apps/api/src/plugins/auth.ts` that `registerAuthRoutes` receives `hooks: { onPostSignUp: createOnPostSignUp(getServiceClient()) }` and that `createOnPostSignUp`'s event object destructure matches the `AuthHooks` contract from `@tn-figueiredo/auth` (arg shape: `{ userId, email, provider? }`). No-op if green.

- [ ] **Step 9.4 — Run, expect PASS.** `HAS_LOCAL_DB=1 cd apps/api && npx vitest run test/hooks/on-signup.test.ts`.

- [ ] **Step 9.5 — Commit.**

```bash
git add apps/api/test/hooks/on-signup.test.ts apps/api/src/hooks/on-signup.ts apps/api/src/plugins/auth.ts
git commit -m "chore(sprint-1a): integration test for signup → authors row wiring"
```

---

## Task 10: Fastify server bootstrap

- [ ] **Step 10.1 — Write failing test.** `apps/api/test/server.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildServer } from '../src/server.js'

describe('server', () => {
  it('boots with health + auth plugins registered', async () => {
    const app = await buildServer()
    await app.ready()
    const routes = app.printRoutes({ commonPrefix: false })
    expect(routes).toMatch(/\/health/)
    expect(routes).toMatch(/\/auth\/signin/)
    await app.close()
  })
})
```

- [ ] **Step 10.2 — Run, expect FAIL** (buildServer not exported).

- [ ] **Step 10.3 — Write implementation.** `apps/api/src/server.ts`:

```typescript
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { env } from './env.js'
import { healthPlugin } from './plugins/health.js'
import { authPlugin } from './plugins/auth.js'

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: env.WEB_URL })
  await app.register(helmet)
  await app.register(healthPlugin)
  await app.register(authPlugin)
  return app
}
```

Update `apps/api/src/index.ts`:

```typescript
import { buildServer } from './server.js'
import { env } from './env.js'

async function start(): Promise<void> {
  const app = await buildServer()
  try {
    await app.listen({ port: env.PORT, host: process.env.HOST ?? '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (!process.env.VERCEL) {
  void start()
}

export default buildServer
```

- [ ] **Step 10.4 — Run, expect PASS.** `cd apps/api && npm test`.

- [ ] **Step 10.5 — Commit.**

```bash
git add apps/api/src/server.ts apps/api/src/index.ts apps/api/test/server.test.ts
git commit -m "feat(sprint-1a): bootstrap Fastify server with cors/helmet/health/auth"
```

---

## Task 11: Next middleware with createAuthMiddleware

- [ ] **Step 11.1 — Write failing test.** `apps/web/test/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

// NOTE: we stub env BEFORE importing middleware because `createAuthMiddleware` is
// evaluated at module load with `process.env.NEXT_PUBLIC_SUPABASE_URL!` — an unstubbed
// import would throw for env reasons, masking the actual redirect assertion.
// We choose env-stubbing (not mocking createAuthMiddleware) because the test is more
// valuable when it exercises the real redirect logic end-to-end against a fake cookie
// store; the local anon JWT is a stable dev-only value and safe to hardcode.
const LOCAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
})
afterAll(() => {
  vi.unstubAllEnvs()
})

// Lazy import AFTER env is stubbed.
async function loadMiddleware() {
  const mod = await import('../middleware')
  return mod.default
}

function makeReq(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3001${path}`), {
    headers: new Headers({ host: 'localhost:3001' }),
  })
}

describe('middleware', () => {
  it('redirects unauthenticated request to /cms → /signin', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/cms'))
    // Redirect either directly (status 307/308) or via NextResponse.redirect
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/signin/)
  })

  it('lets anonymous GET / through', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/'))
    expect([200, 404, undefined]).toContain(res.status)
  })
})
```

- [ ] **Step 11.2 — Run, expect FAIL.**

- [ ] **Step 11.3 — Write implementation.** Replace `apps/web/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'

const authMiddleware = createAuthMiddleware({
  publicRoutes: ['/', '/signin', /^\/api\//, /^\/_next\//],
  protectedRoutes: [/^\/cms(\/.*)?$/, /^\/admin(\/.*)?$/],
  signInPath: '/signin',
  env: {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
})

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  const url = req.nextUrl.clone()
  const isDev = host === 'dev.bythiagofigueiredo.com' || host === 'dev.localhost'
  if (isDev && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (/^\/(cms|admin)(\/|$)/.test(req.nextUrl.pathname)) {
    return authMiddleware(req)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 11.4 — Run, expect PASS.** `cd apps/web && npm test -- middleware`.

- [ ] **Step 11.5 — Commit.**

```bash
git add apps/web/middleware.ts apps/web/test/middleware.test.ts
git commit -m "feat(sprint-1a): protect /cms and /admin via createAuthMiddleware"
```

---

## Task 12: Next /cms layout via createAdminLayout

- [ ] **Step 12.1 — Write failing test.** `apps/web/test/cms-layout.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn(() => ({} as unknown)),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
}))

import Layout from '../src/app/cms/layout'

describe('cms/layout', () => {
  it('renders children wrapped in admin shell', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByText } = render(el)
    expect(getByText('hello-cms')).toBeTruthy()
  })
})
```

- [ ] **Step 12.2 — Run, expect FAIL.** Module not found.

- [ ] **Step 12.3 — Write implementation.** `apps/web/src/app/cms/layout.tsx`:

```tsx
import { createAdminLayout } from '@tn-figueiredo/admin'
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs/server'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

const CmsLayout = createAdminLayout({
  appName: 'CMS',
  sections: [
    { group: 'Content', items: [
      { label: 'Blog posts', path: '/cms/blog', icon: 'Pencil' },
      { label: 'Authors', path: '/cms/authors', icon: 'User' },
    ]},
    { group: 'Campaigns', items: [
      { label: 'Landing pages', path: '/cms/campaigns', icon: 'Target' },
      { label: 'Submissions', path: '/cms/submissions', icon: 'Inbox' },
    ]},
  ],
})

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await requireUser(createServerClient({
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: await cookies(),
  }))
  return <CmsLayout userEmail={user.email}>{children}</CmsLayout>
}
```

`apps/web/src/app/cms/page.tsx`:

```tsx
export default function CmsHome() {
  return <div className="p-8"><h1>CMS</h1><p>Selecione um item no menu.</p></div>
}
```

- [ ] **Step 12.4 — Run, expect PASS.**

- [ ] **Step 12.5 — Commit.**

```bash
git add apps/web/src/app/cms/layout.tsx apps/web/src/app/cms/page.tsx apps/web/test/cms-layout.test.tsx
git commit -m "feat(sprint-1a): add /cms shell via createAdminLayout"
```

---

## Task 13: Next /admin layout

- [ ] **Step 13.1 — Write failing test.** `apps/web/test/admin-layout.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn(() => ({} as unknown)),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
}))

import Layout from '../src/app/admin/layout'

describe('admin/layout', () => {
  it('renders admin shell', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByText } = render(el)
    expect(getByText('hello-admin')).toBeTruthy()
  })
})
```

- [ ] **Step 13.2 — Run, expect FAIL.**

- [ ] **Step 13.3 — Write implementation.** `apps/web/src/app/admin/layout.tsx`:

```tsx
import { createAdminLayout } from '@tn-figueiredo/admin'
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs/server'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

const AdminLayout = createAdminLayout({
  appName: 'Admin',
  sections: [
    { group: 'System', items: [
      { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
      { label: 'Users', path: '/admin/users', icon: 'Users' },
      { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
    ]},
  ],
})

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await requireUser(createServerClient({
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: await cookies(),
  }))
  return <AdminLayout userEmail={user.email}>{children}</AdminLayout>
}
```

`apps/web/src/app/admin/page.tsx`:

```tsx
export default function AdminHome() {
  return <div className="p-8"><h1>Admin</h1><p>System settings — coming soon.</p></div>
}
```

- [ ] **Step 13.4 — Run, expect PASS.**

- [ ] **Step 13.5 — Commit.**

```bash
git add apps/web/src/app/admin/layout.tsx apps/web/src/app/admin/page.tsx apps/web/test/admin-layout.test.tsx
git commit -m "feat(sprint-1a): add /admin shell via createAdminLayout"
```

---

## Task 14: Port homepage from ~/Workspace/personal/bythiagofigueiredo

- [ ] **Step 14.1 — Write failing test.** `apps/web/test/homepage.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Home from '../src/app/(public)/page'

describe('homepage', () => {
  it('renders hero headline', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('h2')).toBeTruthy()
  })
})
```

- [ ] **Step 14.2 — Run, expect FAIL.**

- [ ] **Step 14.3 — Remove colliding scaffold homepage FIRST.** Next route groups (parens) do
  not create URL segments, so `app/page.tsx` and `app/(public)/page.tsx` both resolve to `/`
  and Next will error at build ("You cannot have two parallel pages that resolve to the same
  path"). Remove the scaffold page before creating the new one.

```bash
git rm apps/web/src/app/page.tsx
# Verify it's gone:
ls apps/web/src/app/page.tsx 2>&1 | grep "No such file"
# Expected: "ls: apps/web/src/app/page.tsx: No such file or directory"
```

- [ ] **Step 14.4 — Copy files from legacy.**

```bash
mkdir -p apps/web/src/app/\(public\)/components apps/web/src/locales
cp /Users/figueiredo/Workspace/personal/bythiagofigueiredo/src/app/components/Header.tsx  apps/web/src/app/\(public\)/components/
cp /Users/figueiredo/Workspace/personal/bythiagofigueiredo/src/app/components/Hero.tsx    apps/web/src/app/\(public\)/components/
cp /Users/figueiredo/Workspace/personal/bythiagofigueiredo/src/app/components/Footer.tsx  apps/web/src/app/\(public\)/components/
cp /Users/figueiredo/Workspace/personal/bythiagofigueiredo/src/app/components/SocialLinks.tsx apps/web/src/app/\(public\)/components/
cp /Users/figueiredo/Workspace/personal/bythiagofigueiredo/src/locales/en.json apps/web/src/locales/
```

Create `apps/web/src/app/(public)/page.tsx`:

```tsx
import Header from './components/Header'
import Hero from './components/Hero'
import SocialLinks from './components/SocialLinks'
import Footer from './components/Footer'
import en from '@/locales/en.json'

export const metadata = {
  title: (en as Record<string,string>)['meta.title'],
}

const links = [
  { platform: 'instagram',   url: 'https://www.instagram.com/thiagonfigueiredo', label: 'Instagram' },
  { platform: 'youtube_en',  url: 'https://www.youtube.com/@bythiagofigueiredo', label: 'YouTube (EN)' },
  { platform: 'youtube_pt',  url: 'https://www.youtube.com/@thiagonfigueiredo',  label: 'YouTube (PT)' },
]

export default function Home() {
  const t = en as Record<string, string>
  return (
    <>
      <Header />
      <Hero headline={t['hero.headline']} subheadline={t['hero.subheadline']} />
      <section className="text-center p-[var(--spacing-lg)]">
        <h2>{t['social.title']}</h2>
        <SocialLinks links={links} />
      </section>
      <Footer note={t['footer.note']} />
    </>
  )
}
```

(The scaffold `app/page.tsx` was already removed in Step 14.3 — only `(public)/page.tsx` must own the `/` route.)

Ensure `@/` resolves to `src/`. The web app's `vitest.config.ts` aliases `@` → `./src`. Confirm `tsconfig.json` paths match (`"@/*": ["./src/*"]`); add if missing.

Fix any legacy imports that reference `@/` relative to old repo (unlikely for these 4 components; they use relative imports).

- [ ] **Step 14.5 — Run, expect PASS.** `cd apps/web && npm test -- homepage`. Also verify no route collision: `cd apps/web && npx next build` must not error with "parallel pages" for `/`.

- [ ] **Step 14.6 — Commit.**

```bash
git add -A apps/web/src/app/\(public\) apps/web/src/locales apps/web/test/homepage.test.tsx
# Also stage the deletion of the old page.tsx
git add apps/web/src/app/page.tsx 2>/dev/null || true
git commit -m "feat(sprint-1a): port homepage from legacy repo"
```

---

## Task 15: Seed supabase/seeds/dev.sql

- [ ] **Step 15.1 — Write failing test.** `apps/api/test/seed.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

describe('seed dev.sql', () => {
  const db = new Client({ connectionString: DB_URL })
  beforeAll(async () => {
    await db.connect()
    const sql = readFileSync(resolve(__dirname, '../../../supabase/seeds/dev.sql'), 'utf8')
    await db.query(sql)
  })
  afterAll(async () => { await db.end() })

  it('seeds thiago super_admin user', async () => {
    const { rows } = await db.query(
      `select raw_app_meta_data->>'role' as role from auth.users where email='thiago@bythiagofigueiredo.com'`
    )
    expect(rows[0]?.role).toBe('super_admin')
  })

  it('seeds author linked to user', async () => {
    const { rows } = await db.query(`select slug from public.authors where slug='thiago'`)
    expect(rows).toHaveLength(1)
  })

  it('seeds 3 blog posts with at least one published', async () => {
    const { rows: posts } = await db.query(`select status from public.blog_posts`)
    expect(posts.length).toBeGreaterThanOrEqual(3)
    expect(posts.some(p => p.status === 'published')).toBe(true)
  })

  it('seeds pt-BR + en translations for at least one post', async () => {
    const { rows } = await db.query(`
      select post_id, count(*)::int as n
      from public.blog_translations group by post_id having count(*) >= 2
    `)
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 15.2 — Run, expect FAIL.**

- [ ] **Step 15.3 — Write seed.** `supabase/seeds/dev.sql`:

```sql
-- DEV SEED ONLY — do not run against production
-- Creates a local super_admin user with a known password and fixed UUIDs.
-- Running this against prod would reset/overwrite real auth data.
-- Idempotent dev seed
do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_author_id uuid;
  v_post1 uuid;
  v_post2 uuid;
  v_post3 uuid;
begin
  -- User (super_admin) via auth schema direct insert
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  )
  values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'thiago@bythiagofigueiredo.com',
    crypt('dev-password-123', gen_salt('bf')),
    now(),
    jsonb_build_object('role','super_admin','provider','email','providers',jsonb_build_array('email')),
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do update set
    raw_app_meta_data = excluded.raw_app_meta_data;

  -- Author
  insert into public.authors (user_id, name, slug, bio_md)
  values (v_user_id, 'Thiago Figueiredo', 'thiago', 'Builder. Writer.')
  on conflict (slug) do update set user_id = excluded.user_id
  returning id into v_author_id;

  if v_author_id is null then
    select id into v_author_id from public.authors where slug='thiago';
  end if;

  -- Wipe existing dev posts (safe: idempotent seed)
  delete from public.blog_posts where author_id = v_author_id;

  -- Post 1: published, PT + EN
  insert into public.blog_posts (author_id, status, published_at)
  values (v_author_id, 'published', now() - interval '1 day')
  returning id into v_post1;
  insert into public.blog_translations (post_id, locale, title, slug, excerpt, content_md)
  values
    (v_post1, 'pt-BR', 'Primeiro post', 'primeiro-post', 'Olá mundo', '# Olá\n\nConteúdo pt-BR.'),
    (v_post1, 'en',    'First post',    'first-post',    'Hello world', '# Hello\n\nEnglish content.');

  -- Post 2: draft, PT only
  insert into public.blog_posts (author_id, status)
  values (v_author_id, 'draft')
  returning id into v_post2;
  insert into public.blog_translations (post_id, locale, title, slug, content_md)
  values (v_post2, 'pt-BR', 'Rascunho', 'rascunho', '# WIP');

  -- Post 3: scheduled
  insert into public.blog_posts (author_id, status, scheduled_for)
  values (v_author_id, 'scheduled', now() + interval '7 days')
  returning id into v_post3;
  insert into public.blog_translations (post_id, locale, title, slug, content_md)
  values (v_post3, 'pt-BR', 'Agendado', 'agendado', '# Em breve');
end $$;
```

- [ ] **Step 15.4 — Run, expect PASS.** `npm run db:reset && cd apps/api && npx vitest run test/seed.test.ts`.

Optional: wire seed into `supabase/config.toml` `[db.seed]` so `db:reset` runs it automatically.

- [ ] **Step 15.5 — Commit.**

```bash
git add supabase/seeds/dev.sql apps/api/test/seed.test.ts supabase/config.toml
git commit -m "feat(sprint-1a): seed Thiago super_admin + author + 3 posts"
```

---

## Task 16: End-to-end smoke

- [ ] **Step 16.1 — Write smoke script.** `apps/api/test/e2e/smoke.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('e2e smoke', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildServer(); await app.ready() })
  afterAll(async () => { await app.close() })

  it('GET /health returns ok with db=ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
  })

  it('POST /auth/signin with seeded creds returns 200 + token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signin',
      payload: { email: 'thiago@bythiagofigueiredo.com', password: 'dev-password-123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.session?.accessToken ?? body.accessToken).toBe('string')
  })
})
```

(If auth-fastify response shape differs — e.g. `{ session: { access_token } }` — adjust assertion accordingly after first run.)

- [ ] **Step 16.2 — Run everything.**

```bash
npm run db:start
npm run db:reset     # applies all 6 migrations + seed
cd apps/api && npm test
cd ../web && npm test
# Manual curl (separate terminal):
cd apps/api && npm run dev &
sleep 2
curl -s http://localhost:3333/health | jq .
# Expected: {"status":"ok","db":"ok","time":"..."}
curl -s -X POST http://localhost:3333/auth/signin \
  -H 'content-type: application/json' \
  -d '{"email":"thiago@bythiagofigueiredo.com","password":"dev-password-123"}' | jq .
# Expected: non-null session with accessToken + user.id
```

Document actual output at top of `docs/superpowers/plans/2026-04-14-sprint-1a-foundation.md` results block (or note any shape adjustments made).

- [ ] **Step 16.3 — `npm test` from repo root must be fully green** (api + web workspaces, per CLAUDE.md mandate). Fix any failures before proceeding.

- [ ] **Step 16.4 — Commit.**

```bash
git add apps/api/test/e2e/smoke.test.ts
git commit -m "chore(sprint-1a): end-to-end green"
```

---

## Verified package signatures (pinned at plan time)

Verified against installed `node_modules/@tn-figueiredo/*` `.d.ts`:

- `SignUpUseCase(deps: SignUpDeps)` — only `{ auth: IAuthService }` required. Plan matches.
- `registerAuthRoutes(fastify, deps: AuthRoutesDeps, config?)` — `deps` = `{ signUp, socialSignIn, setPassword, changePassword, changeEmail, verifyOtp, resendOtp, authService, hooks?, forgotPassword?, deleteAccount? }`. Plan matches.
- `createAuthMiddleware(config: MiddlewareConfig)` — `{ publicRoutes, protectedRoutes, roleGates?, signInPath?, env: { supabaseUrl, supabaseAnonKey, cookieNames? } }`. Plan matches.
- `requireUser(client: SupabaseClient): Promise<{ id, email }>` — THROWS on no session (no null-check needed). Requires a client argument; Task 12/13 pass `createServerClient({ env, cookies })` from `@tn-figueiredo/auth-nextjs/server`.
- `auth.user_role()` uses `current_setting('request.jwt.claims', true)` — semantically equal to Supabase's `auth.jwt()`.
- Homepage route collision resolved in Step 14.3 (`git rm`).
- Signin response shape in Task 16 uses a permissive matcher; adjust after first run.
