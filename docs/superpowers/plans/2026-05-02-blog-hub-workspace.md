# Blog Hub Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-tab Blog Hub workspace at `/cms/blog` with kanban editorial board, dynamic tags, dual filtering, schedule calendar, and isDirty post creation — modeled after the newsletter hub.

**Architecture:** Clone & Adapt from the newsletter hub (`_hub/`, `_tabs/`, `_i18n/`, `_shared/`). Replace `newsletter_types` with `blog_tags` (dynamic CRUD), add locale filter chips alongside tag chips, implement 5-column kanban (Idea→Draft→Ready→Scheduled→Published) with quick-add input in Idea column. Analytics tab is a placeholder.

**Tech Stack:** Next.js 15 (App Router, `unstable_cache`, Suspense), React 19 (`useOptimistic`, `useTransition`), `@dnd-kit/core` + `@dnd-kit/sortable`, Supabase (PostgreSQL), Tailwind 4, Vitest, `@tn-figueiredo/newsletter` (for `generateSlots`).

**Spec:** `docs/superpowers/specs/2026-05-02-blog-hub-design.md`

**Reference architecture:** `apps/web/src/app/cms/(authed)/newsletters/` — hub-client.tsx, hub-queries.ts, hub-types.ts, actions.ts, _tabs/*, _i18n/*, _shared/*

---

### Task 1: Migration — Add `'idea'` to `post_status` enum

**Files:**
- Create: `supabase/migrations/20260503000001_post_status_idea.sql`

- [ ] **Step 1: Create the migration file**

`ALTER TYPE ADD VALUE` cannot run inside a transaction, so this must be its own migration file.

```sql
-- supabase/migrations/20260503000001_post_status_idea.sql
-- Add 'idea' status before 'draft' for blog hub kanban
-- Must be a standalone migration (ALTER TYPE ADD VALUE cannot run in transaction)
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'idea' BEFORE 'draft';
```

- [ ] **Step 2: Verify locally**

Run: `npm run db:reset`
Expected: Migration applies cleanly. Verify with: `SELECT unnest(enum_range(NULL::post_status));` should show `idea` before `draft`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000001_post_status_idea.sql
git commit -m "feat(blog-hub): add 'idea' to post_status enum"
```

---

### Task 2: Migration — `blog_tags` table + `blog_posts.tag_id` FK + backfill

**Files:**
- Create: `supabase/migrations/20260503000002_blog_tags.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260503000002_blog_tags.sql
-- Dynamic blog tags replacing the fixed category CHECK constraint

create table public.blog_tags (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites(id) on delete cascade,
  name        text not null,
  slug        text not null,
  color       text not null default '#6366f1',
  color_dark  text,
  badge       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint blog_tags_site_name_unique unique (site_id, name),
  constraint blog_tags_site_slug_unique unique (site_id, slug),
  constraint blog_tags_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint blog_tags_color_dark_hex check (color_dark is null or color_dark ~ '^#[0-9a-fA-F]{6}$')
);

drop trigger if exists blog_tags_set_updated_at on public.blog_tags;
create trigger blog_tags_set_updated_at
  before update on public.blog_tags
  for each row execute function public.tg_set_updated_at();

alter table public.blog_tags enable row level security;

drop policy if exists "blog_tags_public_read" on public.blog_tags;
create policy "blog_tags_public_read" on public.blog_tags
  for select using (public.site_visible(site_id));

drop policy if exists "blog_tags_staff_all" on public.blog_tags;
create policy "blog_tags_staff_all" on public.blog_tags
  for all using (public.can_edit_site(site_id));

-- Add tag_id FK to blog_posts
alter table public.blog_posts
  add column if not exists tag_id uuid references public.blog_tags(id) on delete restrict;

create index if not exists blog_posts_tag_id_idx on public.blog_posts(tag_id);

-- Backfill: create tags from existing category values
with distinct_cats as (
  select distinct site_id, category
  from public.blog_posts
  where category is not null
)
insert into public.blog_tags (site_id, name, slug, color, sort_order)
select
  site_id,
  category,
  lower(replace(category, ' ', '-')),
  case category
    when 'Tech' then '#6366f1'
    when 'Vida' then '#22c55e'
    else '#9ca3af'
  end,
  row_number() over (partition by site_id order by category)
from distinct_cats
on conflict (site_id, name) do nothing;

-- Wire tag_id from category name
update public.blog_posts bp
set tag_id = bt.id
from public.blog_tags bt
where bt.site_id = bp.site_id
  and bt.name = bp.category
  and bp.category is not null
  and bp.tag_id is null;
```

- [ ] **Step 2: Verify locally**

Run: `npm run db:reset`
Expected: Both migrations apply cleanly. Verify: `\d blog_tags` shows table; `\d blog_posts` shows `tag_id` column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000002_blog_tags.sql
git commit -m "feat(blog-hub): blog_tags table + tag_id FK + category backfill"
```

---

### Task 3: Types — `hub-types.ts`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts`

- [ ] **Step 1: Create the types file**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts`

```typescript
// apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts
export type BlogTabId = 'overview' | 'editorial' | 'schedule' | 'analytics'

export interface BlogTag {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  badge: string | null
  sortOrder: number
  postCount: number
}

export interface BlogHubSharedData {
  tags: BlogTag[]
  tabBadges: { editorial: number }
  siteTimezone: string
  siteName: string
  defaultLocale: string
  supportedLocales: string[]
}

export interface PostCard {
  id: string
  displayId: string
  title: string
  status: 'idea' | 'draft' | 'pending_review' | 'ready' | 'queued' | 'scheduled' | 'published' | 'archived'
  tagId: string | null
  tagName: string | null
  tagColor: string | null
  locales: string[]
  readingTimeMin: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  scheduledFor: string | null
  slotDate: string | null
  snippet: string | null
}

export interface OverviewTabData {
  kpis: {
    totalPosts: number
    totalPostsTrend: number
    published: number
    publishedTrend: number
    avgReadingTime: number
    avgReadingTimeTrend: number
    draftBacklog: number
    draftBacklogTrend: number
  }
  sparklines: Record<'totalPosts' | 'published' | 'avgReadingTime' | 'draftBacklog', number[]>
  tagBreakdown: Array<{ tagId: string | null; tagName: string; tagColor: string; count: number }>
  recentPublications: Array<{
    id: string
    title: string
    tagName: string | null
    tagColor: string | null
    locales: string[]
    publishedAt: string
    readingTimeMin: number | null
  }>
  velocitySparkline: number[]
}

export interface EditorialTabData {
  velocity: {
    throughput: number
    avgIdeaToPublished: number
    movedThisWeek: number
    bottleneck: { column: string; avgDays: number } | null
  }
  posts: PostCard[]
}

export interface ScheduleSlot {
  date: string
  posts: Array<{ id: string; title: string; tagColor: string | null; status: string; locale: string }>
  emptySlots: Array<{ locale: string }>
}

export interface BlogCadenceConfig {
  locale: string
  cadenceDays: number
  preferredSendTime: string
  cadenceStartDate: string | null
  cadencePaused: boolean
  lastPublishedAt: string | null
}

export interface ScheduleTabData {
  healthStrip: {
    fillRate: number
    next7Days: number
    avgReadingTime: number
    activeLocales: number
    totalLocales: number
  }
  calendarSlots: ScheduleSlot[]
  cadenceConfigs: BlogCadenceConfig[]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-types.ts
git commit -m "feat(blog-hub): add hub types"
```

---

### Task 4: Utils — `hub-utils.ts` + transition rules

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts`
- Test: `apps/web/test/cms/blog-hub.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/cms/blog-hub.test.ts
import { describe, it, expect } from 'vitest'
import { isValidTransition, getValidTargets, computeDisplayId, mapStatusToColumn, BLOG_TRANSITIONS } from '../src/app/cms/(authed)/blog/_hub/hub-utils'

describe('blog-hub utils', () => {
  describe('BLOG_TRANSITIONS', () => {
    it('allows idea → draft', () => {
      expect(isValidTransition('idea', 'draft')).toBe(true)
    })

    it('allows idea → archived', () => {
      expect(isValidTransition('idea', 'archived')).toBe(true)
    })

    it('blocks idea → published', () => {
      expect(isValidTransition('idea', 'published')).toBe(false)
    })

    it('allows draft → ready', () => {
      expect(isValidTransition('draft', 'ready')).toBe(true)
    })

    it('allows draft → idea (revert)', () => {
      expect(isValidTransition('draft', 'idea')).toBe(true)
    })

    it('blocks draft → published (skip ready)', () => {
      expect(isValidTransition('draft', 'published')).toBe(false)
    })

    it('allows ready → published', () => {
      expect(isValidTransition('ready', 'published')).toBe(true)
    })

    it('allows published → archived only', () => {
      expect(isValidTransition('published', 'archived')).toBe(true)
      expect(isValidTransition('published', 'draft')).toBe(false)
    })

    it('allows archived → idea or draft', () => {
      expect(isValidTransition('archived', 'idea')).toBe(true)
      expect(isValidTransition('archived', 'draft')).toBe(true)
      expect(isValidTransition('archived', 'published')).toBe(false)
    })

    it('returns valid targets for ready', () => {
      expect(getValidTargets('ready')).toEqual(['draft', 'scheduled', 'queued', 'published', 'archived'])
    })

    it('returns empty for unknown status', () => {
      expect(getValidTargets('unknown')).toEqual([])
    })
  })

  describe('computeDisplayId', () => {
    it('formats with BP prefix and zero-padded number', () => {
      expect(computeDisplayId(1)).toBe('#BP-001')
      expect(computeDisplayId(42)).toBe('#BP-042')
      expect(computeDisplayId(999)).toBe('#BP-999')
      expect(computeDisplayId(1000)).toBe('#BP-1000')
    })
  })

  describe('mapStatusToColumn', () => {
    it('maps idea to idea column', () => {
      expect(mapStatusToColumn('idea')).toBe('idea')
    })

    it('maps draft and pending_review to draft column', () => {
      expect(mapStatusToColumn('draft')).toBe('draft')
      expect(mapStatusToColumn('pending_review')).toBe('draft')
    })

    it('maps ready and queued to ready column', () => {
      expect(mapStatusToColumn('ready')).toBe('ready')
      expect(mapStatusToColumn('queued')).toBe('ready')
    })

    it('maps scheduled to scheduled column', () => {
      expect(mapStatusToColumn('scheduled')).toBe('scheduled')
    })

    it('maps published to published column', () => {
      expect(mapStatusToColumn('published')).toBe('published')
    })

    it('maps archived to archived', () => {
      expect(mapStatusToColumn('archived')).toBe('archived')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --reporter=verbose --testPathPattern=blog-hub`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts
import type { PostCard } from './hub-types'

export const BLOG_TRANSITIONS: Record<string, string[]> = {
  idea:           ['draft', 'archived'],
  draft:          ['idea', 'ready', 'pending_review', 'archived'],
  pending_review: ['draft', 'ready', 'archived'],
  ready:          ['draft', 'scheduled', 'queued', 'published', 'archived'],
  queued:         ['ready', 'scheduled', 'archived'],
  scheduled:      ['ready', 'draft', 'archived'],
  published:      ['archived'],
  archived:       ['idea', 'draft'],
}

export function isValidTransition(from: string, to: string): boolean {
  return BLOG_TRANSITIONS[from]?.includes(to) ?? false
}

export function getValidTargets(status: string): string[] {
  return BLOG_TRANSITIONS[status] ?? []
}

export function computeDisplayId(rowNumber: number): string {
  const padded = rowNumber < 1000 ? String(rowNumber).padStart(3, '0') : String(rowNumber)
  return `#BP-${padded}`
}

export type KanbanColumnId = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published' | 'archived'

export function mapStatusToColumn(status: PostCard['status']): KanbanColumnId {
  switch (status) {
    case 'idea': return 'idea'
    case 'draft':
    case 'pending_review': return 'draft'
    case 'ready':
    case 'queued': return 'ready'
    case 'scheduled': return 'scheduled'
    case 'published': return 'published'
    case 'archived': return 'archived'
  }
}

export function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --reporter=verbose --testPathPattern=blog-hub`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-utils.ts apps/web/test/cms/blog-hub.test.ts
git commit -m "feat(blog-hub): hub utils with transition rules + tests"
```

---

### Task 5: i18n — types + English + Portuguese strings

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_i18n/types.ts`
- Create: `apps/web/src/app/cms/(authed)/blog/_i18n/en.ts`
- Create: `apps/web/src/app/cms/(authed)/blog/_i18n/pt-BR.ts`

- [ ] **Step 1: Create types file**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts`

```typescript
// apps/web/src/app/cms/(authed)/blog/_i18n/types.ts
export interface BlogHubStrings {
  tabs: { overview: string; editorial: string; schedule: string; analytics: string }
  kpi: { totalPosts: string; published: string; avgReadingTime: string; draftBacklog: string }
  actions: { newPost: string; newIdea: string; viewAll: string; configure: string }
  empty: { noData: string; noPosts: string; startWriting: string; addIdea: string; configCadence: string }
  overview: { tagBreakdown: string; recentPublications: string; velocityTrend: string; untagged: string; readingTime: string; publishedAgo: string }
  editorial: {
    throughput: string; avgTime: string; movedForward: string; bottleneck: string
    searchPosts: string
    idea: string; draft: string; ready: string; scheduled: string; published: string
    review: string; queued: string
    none: string; noTag: string; changeTag: string; addLocale: string; reassigned: string
    untitled: string; open: string; moveTo: string; duplicate: string; delete: string
    deleted: string; deleteFailed: string; confirmDelete: string
    quickAddPlaceholder: string; ideaCreated: string; ideaFailed: string
    viewAllPublished: string; archived: string; showArchived: string; hideArchived: string; restore: string
  }
  schedule: {
    fillRate: string; next7Days: string; avgReadingTime: string; activeLocales: string
    cadenceConfig: string; publishTime: string; startDay: string
    resumeCadence: string; pauseCadence: string; save: string; cancelEdit: string
    saved: string; cadenceRangeError: string; timeFormatError: string; updateFailed: string
    daysUnit: string; editCadence: string
    slotDate: string; scheduledFor: string; publishedOn: string
  }
  analytics: { comingSoon: string; comingSoonDescription: string }
  common: { allTags: string; allLocales: string; updatedJustNow: string; showMore: string; moved: string; couldntMove: string; edit: string; posts: string }
  tagDrawer: {
    createTitle: string; editTitle: string
    sectionEssentials: string; sectionAppearance: string
    nameLabel: string; namePlaceholder: string
    slugLabel: string; slugPreview: string; slugWarning: string
    badgeLabel: string; badgePlaceholder: string; badgeHint: string
    colorLabel: string; colorDarkLabel: string; colorDarkHint: string
    clearColor: string
    close: string
    valRequired: string; valMinChars: string; valMaxChars: string
    valInvalidFormat: string; valReservedSlug: string; valInvalidHex: string; valSlugInUse: string
    tagNotFound: string; unknownError: string; typeNameToConfirm: string
    dangerZone: string; deleteButton: string; deleteConfirmDeps: string; deleteNameMismatch: string
    createButton: string; saveButton: string; creating: string; saving: string; cancel: string
    toastCreated: string; toastSaved: string; toastDeleted: string
  }
}
```

- [ ] **Step 2: Create English strings**

```typescript
// apps/web/src/app/cms/(authed)/blog/_i18n/en.ts
import type { BlogHubStrings } from './types'

export const en: BlogHubStrings = {
  tabs: { overview: 'Overview', editorial: 'Editorial', schedule: 'Schedule', analytics: 'Analytics' },
  kpi: { totalPosts: 'Total Posts', published: 'Published', avgReadingTime: 'Avg Reading Time', draftBacklog: 'Draft Backlog' },
  actions: { newPost: 'New Post', newIdea: 'New Idea', viewAll: 'View all', configure: 'Configure' },
  empty: { noData: 'No data yet', noPosts: 'No posts yet', startWriting: 'Start writing your first post', addIdea: 'Add your first idea', configCadence: 'Configure your publishing cadence' },
  overview: { tagBreakdown: 'Posts by Tag', recentPublications: 'Recent Publications', velocityTrend: 'Publishing Velocity', untagged: 'Untagged', readingTime: 'min read', publishedAgo: 'ago' },
  editorial: {
    throughput: 'Throughput', avgTime: 'Avg Idea→Pub', movedForward: 'Moved this week', bottleneck: 'Bottleneck',
    searchPosts: 'Search posts…',
    idea: 'Idea', draft: 'Draft', ready: 'Ready', scheduled: 'Scheduled', published: 'Published',
    review: 'Review', queued: 'Queued',
    none: 'None', noTag: 'No tag', changeTag: 'Change tag', addLocale: 'Add locale', reassigned: 'Tag changed',
    untitled: 'Untitled', open: 'Open', moveTo: 'Move to', duplicate: 'Duplicate', delete: 'Delete',
    deleted: 'Deleted', deleteFailed: "Couldn't delete", confirmDelete: 'Are you sure you want to delete this post?',
    quickAddPlaceholder: 'Quick idea…', ideaCreated: 'Idea created', ideaFailed: "Couldn't create idea",
    viewAllPublished: 'View all published', archived: 'Archived', showArchived: 'Show archived', hideArchived: 'Hide archived', restore: 'Restore',
  },
  schedule: {
    fillRate: 'Fill Rate', next7Days: 'Next 7 Days', avgReadingTime: 'Avg Reading Time', activeLocales: 'Active Locales',
    cadenceConfig: 'Cadence', publishTime: 'Publish time', startDay: 'Start day',
    resumeCadence: 'Resume', pauseCadence: 'Pause', save: 'Save', cancelEdit: 'Cancel',
    saved: 'Saved', cadenceRangeError: 'Must be 1–365 days', timeFormatError: 'Use HH:MM format', updateFailed: 'Update failed',
    daysUnit: 'days', editCadence: 'Edit',
    slotDate: 'Slot', scheduledFor: 'Scheduled', publishedOn: 'Published',
  },
  analytics: { comingSoon: 'Analytics Coming Soon', comingSoonDescription: 'Blog analytics with view tracking, engagement metrics, and referral sources will be available in a future update.' },
  common: { allTags: 'All', allLocales: 'All', updatedJustNow: 'Updated just now', showMore: 'Show more', moved: 'Moved', couldntMove: "Couldn't move", edit: 'Edit', posts: 'Posts' },
  tagDrawer: {
    createTitle: 'New Tag', editTitle: 'Edit Tag',
    sectionEssentials: 'Essentials', sectionAppearance: 'Appearance',
    nameLabel: 'Name', namePlaceholder: 'e.g. Tech, Life, Travel',
    slugLabel: 'Slug', slugPreview: 'Preview:', slugWarning: 'Changing the slug will break existing links',
    badgeLabel: 'Badge', badgePlaceholder: 'e.g. NEW, HOT', badgeHint: 'Short label shown on chips',
    colorLabel: 'Color', colorDarkLabel: 'Dark variant', colorDarkHint: 'Used on dark backgrounds (auto-computed if empty)',
    clearColor: 'Clear',
    close: 'Close',
    valRequired: 'Required', valMinChars: 'At least 2 characters', valMaxChars: 'At most 50 characters',
    valInvalidFormat: 'Only letters, numbers, and hyphens', valReservedSlug: 'This slug is reserved', valInvalidHex: 'Invalid hex color', valSlugInUse: 'This slug is already in use',
    tagNotFound: 'Tag not found', unknownError: 'Something went wrong', typeNameToConfirm: 'Type the tag name to confirm',
    dangerZone: 'Danger Zone', deleteButton: 'Delete tag', deleteConfirmDeps: 'This tag has {count} posts. Reassign them to another tag first.', deleteNameMismatch: 'Name does not match',
    createButton: 'Create tag', saveButton: 'Save changes', creating: 'Creating…', saving: 'Saving…', cancel: 'Cancel',
    toastCreated: 'Tag created', toastSaved: 'Tag saved', toastDeleted: 'Tag deleted',
  },
}
```

- [ ] **Step 3: Create Portuguese strings**

```typescript
// apps/web/src/app/cms/(authed)/blog/_i18n/pt-BR.ts
import type { BlogHubStrings } from './types'

export const ptBR: BlogHubStrings = {
  tabs: { overview: 'Visão Geral', editorial: 'Editorial', schedule: 'Agenda', analytics: 'Analytics' },
  kpi: { totalPosts: 'Total de Posts', published: 'Publicados', avgReadingTime: 'Tempo Médio', draftBacklog: 'Rascunhos' },
  actions: { newPost: 'Novo Post', newIdea: 'Nova Ideia', viewAll: 'Ver todos', configure: 'Configurar' },
  empty: { noData: 'Sem dados ainda', noPosts: 'Nenhum post ainda', startWriting: 'Comece a escrever seu primeiro post', addIdea: 'Adicione sua primeira ideia', configCadence: 'Configure sua cadência de publicação' },
  overview: { tagBreakdown: 'Posts por Tag', recentPublications: 'Publicações Recentes', velocityTrend: 'Velocidade de Publicação', untagged: 'Sem tag', readingTime: 'min leitura', publishedAgo: 'atrás' },
  editorial: {
    throughput: 'Produtividade', avgTime: 'Média Ideia→Pub', movedForward: 'Movidos esta semana', bottleneck: 'Gargalo',
    searchPosts: 'Buscar posts…',
    idea: 'Ideia', draft: 'Rascunho', ready: 'Pronto', scheduled: 'Agendado', published: 'Publicado',
    review: 'Revisão', queued: 'Na fila',
    none: 'Nenhum', noTag: 'Sem tag', changeTag: 'Mudar tag', addLocale: 'Adicionar idioma', reassigned: 'Tag alterada',
    untitled: 'Sem título', open: 'Abrir', moveTo: 'Mover para', duplicate: 'Duplicar', delete: 'Excluir',
    deleted: 'Excluído', deleteFailed: 'Não foi possível excluir', confirmDelete: 'Tem certeza que deseja excluir este post?',
    quickAddPlaceholder: 'Ideia rápida…', ideaCreated: 'Ideia criada', ideaFailed: 'Não foi possível criar',
    viewAllPublished: 'Ver todos os publicados', archived: 'Arquivados', showArchived: 'Mostrar arquivados', hideArchived: 'Ocultar arquivados', restore: 'Restaurar',
  },
  schedule: {
    fillRate: 'Preenchimento', next7Days: 'Próx. 7 Dias', avgReadingTime: 'Tempo Médio', activeLocales: 'Idiomas Ativos',
    cadenceConfig: 'Cadência', publishTime: 'Hora de publicação', startDay: 'Dia de início',
    resumeCadence: 'Retomar', pauseCadence: 'Pausar', save: 'Salvar', cancelEdit: 'Cancelar',
    saved: 'Salvo', cadenceRangeError: 'Deve ser 1–365 dias', timeFormatError: 'Use formato HH:MM', updateFailed: 'Falha ao atualizar',
    daysUnit: 'dias', editCadence: 'Editar',
    slotDate: 'Slot', scheduledFor: 'Agendado', publishedOn: 'Publicado',
  },
  analytics: { comingSoon: 'Analytics em Breve', comingSoonDescription: 'Analytics de blog com rastreamento de visualizações, métricas de engajamento e fontes de referência estarão disponíveis em uma atualização futura.' },
  common: { allTags: 'Todas', allLocales: 'Todos', updatedJustNow: 'Atualizado agora', showMore: 'Ver mais', moved: 'Movido', couldntMove: 'Não foi possível mover', edit: 'Editar', posts: 'Posts' },
  tagDrawer: {
    createTitle: 'Nova Tag', editTitle: 'Editar Tag',
    sectionEssentials: 'Essenciais', sectionAppearance: 'Aparência',
    nameLabel: 'Nome', namePlaceholder: 'ex. Tech, Vida, Viagem',
    slugLabel: 'Slug', slugPreview: 'Preview:', slugWarning: 'Alterar o slug quebrará links existentes',
    badgeLabel: 'Badge', badgePlaceholder: 'ex. NOVO, QUENTE', badgeHint: 'Rótulo curto exibido nos chips',
    colorLabel: 'Cor', colorDarkLabel: 'Variante escura', colorDarkHint: 'Usada em fundos escuros (auto-calculada se vazia)',
    clearColor: 'Limpar',
    close: 'Fechar',
    valRequired: 'Obrigatório', valMinChars: 'Mínimo 2 caracteres', valMaxChars: 'Máximo 50 caracteres',
    valInvalidFormat: 'Apenas letras, números e hifens', valReservedSlug: 'Este slug é reservado', valInvalidHex: 'Cor hexadecimal inválida', valSlugInUse: 'Este slug já está em uso',
    tagNotFound: 'Tag não encontrada', unknownError: 'Algo deu errado', typeNameToConfirm: 'Digite o nome da tag para confirmar',
    dangerZone: 'Zona de Perigo', deleteButton: 'Excluir tag', deleteConfirmDeps: 'Esta tag possui {count} posts. Reatribua-os a outra tag primeiro.', deleteNameMismatch: 'Nome não confere',
    createButton: 'Criar tag', saveButton: 'Salvar alterações', creating: 'Criando…', saving: 'Salvando…', cancel: 'Cancelar',
    toastCreated: 'Tag criada', toastSaved: 'Tag salva', toastDeleted: 'Tag excluída',
  },
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_i18n/
git commit -m "feat(blog-hub): i18n types + en + pt-BR strings"
```

---

### Task 6: Shared components — empty-state, sparkline, health-strip, error boundaries, tab-skeleton

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/empty-state.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/sparkline-svg.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/health-strip.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/section-error-boundary.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/tab-error-boundary.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/tab-skeleton.tsx`

These are direct clones of the newsletter versions. Reference files:
- `apps/web/src/app/cms/(authed)/newsletters/_shared/empty-state.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_shared/sparkline-svg.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_shared/health-strip.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_shared/section-error-boundary.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_shared/tab-error-boundary.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_hub/tab-skeleton.tsx`

- [ ] **Step 1: Clone all 6 shared component files**

Copy each newsletter shared component to the blog equivalent directory. These components are generic and need no content changes — only import paths may differ. Read each source file, copy it to the blog path. The `tab-skeleton.tsx` should be adapted to show 4 tabs (overview/editorial/schedule/analytics) instead of 5.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors from new files

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_shared/ apps/web/src/app/cms/'(authed)'/blog/_hub/tab-skeleton.tsx
git commit -m "feat(blog-hub): shared components (empty-state, sparkline, health-strip, error boundaries, skeleton)"
```

---

### Task 7: Filter chips — tag-filter-chips + locale-filter-chips

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/tag-filter-chips.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/locale-filter-chips.tsx`

- [ ] **Step 1: Create tag-filter-chips**

Clone from `apps/web/src/app/cms/(authed)/newsletters/_shared/type-filter-chips.tsx` and adapt:
- Rename `TypeFilterChips` → `TagFilterChips`
- Rename `types` prop → `tags` with `BlogTag[]` type
- Show `tag.postCount` as badge count instead of `type.subscriberCount`
- Import from `../../_hub/hub-types` instead of newsletter types
- `allLabel` prop for "All" chip text
- `editLabel` prop for edit button text
- `onAdd`, `onEdit`, `onSelect` callbacks

- [ ] **Step 2: Create locale-filter-chips**

Simpler chip bar — no add/edit, just select.

```typescript
// apps/web/src/app/cms/(authed)/blog/_shared/locale-filter-chips.tsx
'use client'

interface LocaleFilterChipsProps {
  locales: string[]
  selectedLocale: string | null
  onSelect: (locale: string | null) => void
  allLabel: string
}

export function LocaleFilterChips({ locales, selectedLocale, onSelect, allLabel }: LocaleFilterChipsProps) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Locale filter">
      <button
        role="radio"
        aria-checked={selectedLocale === null}
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
          selectedLocale === null
            ? 'bg-gray-700 text-gray-100'
            : 'bg-gray-900 text-gray-500 hover:text-gray-300'
        }`}
      >
        {allLabel}
      </button>
      {locales.map((locale) => (
        <button
          key={locale}
          role="radio"
          aria-checked={selectedLocale === locale}
          onClick={() => onSelect(locale)}
          className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase transition-colors ${
            selectedLocale === locale
              ? 'bg-gray-700 text-gray-100'
              : 'bg-gray-900 text-gray-500 hover:text-gray-300'
          }`}
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_shared/tag-filter-chips.tsx apps/web/src/app/cms/'(authed)'/blog/_shared/locale-filter-chips.tsx
git commit -m "feat(blog-hub): tag + locale filter chips"
```

---

### Task 8: Server actions — Tag CRUD

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts`

- [ ] **Step 1: Add tag CRUD actions**

Append to the existing `actions.ts` file (which already has `bulkPublish`, `bulkArchive`, `bulkDelete`, `bulkChangeAuthor`). Add:

```typescript
// ─── Tag CRUD ───────────────────────────────────────────────────────────

export async function createTag(input: {
  name: string
  slug: string
  color: string
  colorDark?: string | null
  badge?: string | null
}): Promise<{ ok: true; tagId: string } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('blog_tags')
    .insert({
      site_id: siteId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      color: input.color,
      color_dark: input.colorDark ?? null,
      badge: input.badge?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'duplicate' }
    return { ok: false, error: error.message }
  }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true, tagId: data.id }
}

export async function updateTag(
  tagId: string,
  patch: {
    name?: string
    slug?: string
    color?: string
    colorDark?: string | null
    badge?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  if (patch.name !== undefined) updateData.name = patch.name.trim()
  if (patch.slug !== undefined) updateData.slug = patch.slug.trim().toLowerCase()
  if (patch.color !== undefined) updateData.color = patch.color
  if (patch.colorDark !== undefined) updateData.color_dark = patch.colorDark
  if (patch.badge !== undefined) updateData.badge = patch.badge?.trim() || null

  const { error } = await supabase
    .from('blog_tags')
    .update(updateData)
    .eq('id', tagId)
    .eq('site_id', siteId)

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'duplicate' }
    return { ok: false, error: error.message }
  }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function deleteTag(
  tagId: string,
): Promise<{ ok: true } | { ok: false; error: string; postCount?: number }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  const { count } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('tag_id', tagId)
    .eq('site_id', siteId)

  if (count && count > 0) {
    return { ok: false, error: 'has_posts', postCount: count }
  }

  const { error } = await supabase
    .from('blog_tags')
    .delete()
    .eq('id', tagId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function reorderTags(
  tagIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  const updates = tagIds.map((id, i) =>
    supabase.from('blog_tags').update({ sort_order: i }).eq('id', id).eq('site_id', siteId),
  )
  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: failed.error.message }

  revalidateTag('blog-hub')
  return { ok: true }
}
```

Note: add `import { revalidateTag } from 'next/cache'` to the existing imports at the top of the file (alongside `revalidatePath`).

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/actions.ts
git commit -m "feat(blog-hub): tag CRUD server actions"
```

---

### Task 9: Server actions — Hub mutations (createPost, movePost, deleteHubPost, reassignTag, addLocale, duplicatePost)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts`

- [ ] **Step 1: Add hub mutation actions**

Append to `actions.ts`:

```typescript
// ─── Hub Mutations ──────────────────────────────────────────────────────

export async function createPost(input: {
  title?: string
  locale: string
  tagId?: string
  status?: 'idea' | 'draft'
}): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  // Resolve author from current user
  const cookieStore = await (await import('next/headers')).cookies()
  const { createServerClient } = await import('@supabase/ssr')
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options as never)
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { data: author } = await supabase
    .from('authors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!author) return { ok: false, error: 'no_author_record' }

  const status = input.status ?? 'draft'
  const isPt = input.locale === 'pt-BR'
  const title = input.title?.trim() || (isPt ? 'Sem título' : 'Untitled')
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`

  const { data: post, error: postError } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      author_id: author.id,
      owner_user_id: user.id,
      status,
      tag_id: input.tagId || null,
    })
    .select('id')
    .single()

  if (postError) return { ok: false, error: postError.message }

  const { error: txError } = await supabase
    .from('blog_translations')
    .insert({
      post_id: post.id,
      locale: input.locale,
      title,
      slug,
      content_mdx: '',
    })

  if (txError) {
    await supabase.from('blog_posts').delete().eq('id', post.id)
    return { ok: false, error: txError.message }
  }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true, postId: post.id }
}

export async function movePost(
  postId: string,
  newStatus: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('blog_posts')
    .select('status')
    .eq('id', postId)
    .single()
  if (!current) return { ok: false, error: 'not_found' }

  const { isValidTransition } = await import('./_hub/hub-utils')
  if (!isValidTransition(current.status, newStatus)) {
    return { ok: false, error: 'invalid_transition' }
  }

  const patch: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'published' && current.status !== 'published') {
    patch.published_at = new Date().toISOString()
  }
  if (current.status === 'published' && newStatus !== 'published') {
    patch.published_at = null
  }

  const { error } = await supabase
    .from('blog_posts')
    .update(patch)
    .eq('id', postId)
    .eq('status', current.status)
  if (error) return { ok: false, error: error.message }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')

  const { data: translations } = await supabase
    .from('blog_translations')
    .select('locale, slug')
    .eq('post_id', postId)
  if (translations) {
    const { siteId } = await getSiteContext()
    for (const tx of translations) {
      revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
    }
  }

  return { ok: true }
}

export async function deleteHubPost(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', postId)
  const supabase = getSupabaseServiceClient()

  const { data: post } = await supabase
    .from('blog_posts')
    .select('status, blog_translations(locale, slug)')
    .eq('id', postId)
    .single()
  if (!post) return { ok: false, error: 'not_found' }

  if (!['idea', 'draft', 'archived'].includes(post.status)) {
    return { ok: false, error: 'must_archive_first' }
  }

  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', postId)
    .eq('status', post.status)
  if (error) return { ok: false, error: error.message }

  const translations = (post as { blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
  for (const tx of translations) {
    revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
  }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function reassignTag(
  postId: string,
  tagId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('blog_posts')
    .update({ tag_id: tagId })
    .eq('id', postId)
  if (error) return { ok: false, error: error.message }

  revalidateTag('blog-hub')
  return { ok: true }
}

export async function addLocale(
  postId: string,
  locale: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  const supabase = getSupabaseServiceClient()

  const isPt = locale === 'pt-BR'
  const title = isPt ? 'Sem título' : 'Untitled'
  const slug = `${isPt ? 'sem-titulo' : 'untitled'}-${Date.now()}`

  const { error } = await supabase
    .from('blog_translations')
    .insert({ post_id: postId, locale, title, slug, content_mdx: '' })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'locale_exists' }
    return { ok: false, error: error.message }
  }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function duplicatePost(
  postId: string,
): Promise<{ ok: true; newPostId: string } | { ok: false; error: string }> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', postId)
  const supabase = getSupabaseServiceClient()

  const { data: original } = await supabase
    .from('blog_posts')
    .select('author_id, owner_user_id, tag_id, blog_translations(locale, title, slug, excerpt, content_mdx)')
    .eq('id', postId)
    .single()
  if (!original) return { ok: false, error: 'not_found' }

  const { data: newPost, error: insertErr } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      author_id: original.author_id,
      owner_user_id: original.owner_user_id,
      status: 'idea',
      tag_id: original.tag_id,
    })
    .select('id')
    .single()
  if (insertErr) return { ok: false, error: insertErr.message }

  const translations = (original as { blog_translations: Array<{ locale: string; title: string; slug: string; excerpt: string | null; content_mdx: string }> }).blog_translations ?? []
  if (translations.length > 0) {
    const txInserts = translations.map((tx) => ({
      post_id: newPost.id,
      locale: tx.locale,
      title: `${tx.title} (copy)`,
      slug: `${tx.slug}-copy-${Date.now()}`,
      excerpt: tx.excerpt,
      content_mdx: tx.content_mdx,
    }))
    await supabase.from('blog_translations').insert(txInserts)
  }

  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  return { ok: true, newPostId: newPost.id }
}
```

Note: add `import { requireSiteAdminForRow } from '@/lib/cms/auth-guards'` to the imports at the top of `actions.ts`.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/actions.ts
git commit -m "feat(blog-hub): hub mutation server actions (create, move, delete, reassign, addLocale, duplicate)"
```

---

### Task 10: Server actions — Cadence + modify existing savePost

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`

- [ ] **Step 1: Add cadence action to actions.ts**

Append to `actions.ts`:

```typescript
// ─── Cadence ────────────────────────────────────────────────────────────

export async function updateBlogCadence(
  locale: string,
  patch: {
    cadence_days?: number
    preferred_send_time?: string
    cadence_paused?: boolean
    cadence_start_date?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  if (patch.cadence_days !== undefined && (patch.cadence_days < 1 || patch.cadence_days > 365)) {
    return { ok: false, error: 'cadence_range' }
  }
  if (patch.preferred_send_time !== undefined && !/^\d{2}:\d{2}$/.test(patch.preferred_send_time)) {
    return { ok: false, error: 'time_format' }
  }

  const { error } = await supabase
    .from('blog_cadence')
    .upsert(
      {
        site_id: siteId,
        locale,
        ...patch,
      },
      { onConflict: 'site_id,locale' },
    )
  if (error) return { ok: false, error: error.message }

  revalidateTag('blog-hub')
  revalidateTag('blog-hub-schedule')
  return { ok: true }
}
```

- [ ] **Step 2: Modify savePost to accept tag_id**

In `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`, add `tag_id` to `SavePostActionInput`:

```typescript
export interface SavePostActionInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_url?: string | null
  tag_id?: string | null  // NEW
}
```

And in the `savePost` function body, after the `postRepo().update(...)` call, add:

```typescript
  // Update tag_id if provided
  if (input.tag_id !== undefined) {
    const supabase = getSupabaseServiceClient()
    await supabase.from('blog_posts').update({ tag_id: input.tag_id }).eq('id', id)
  }
```

Also add `revalidateTag('blog-hub')` import and call it alongside the existing `revalidateBlogPostSeo`.

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: All existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/actions.ts apps/web/src/app/cms/'(authed)'/blog/'[id]'/edit/actions.ts
git commit -m "feat(blog-hub): cadence action + savePost accepts tag_id"
```

---

### Task 11: Data fetching — `hub-queries.ts`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts`

- [ ] **Step 1: Create the queries file**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts`

```typescript
// apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { BlogHubSharedData, BlogTag, PostCard, OverviewTabData, EditorialTabData, ScheduleTabData, ScheduleSlot, BlogCadenceConfig } from './hub-types'
import { computeDisplayId } from './hub-utils'
import { generateSlots } from '@tn-figueiredo/newsletter'

export const fetchBlogSharedData = unstable_cache(
  async (siteId: string): Promise<BlogHubSharedData> => {
    const supabase = getSupabaseServiceClient()

    const [tagsResult, siteResult, badgeResult] = await Promise.all([
      supabase
        .from('blog_tags')
        .select('id, name, slug, color, color_dark, badge, sort_order')
        .eq('site_id', siteId)
        .order('sort_order'),
      supabase
        .from('sites')
        .select('name, timezone, default_locale, supported_locales')
        .eq('id', siteId)
        .single(),
      supabase
        .from('blog_posts')
        .select('id, tag_id, status, created_at')
        .eq('site_id', siteId),
    ])

    const allPosts = badgeResult.data ?? []

    const tagCountMap = new Map<string, number>()
    let staleDrafts = 0
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const p of allPosts) {
      if (p.tag_id) tagCountMap.set(p.tag_id, (tagCountMap.get(p.tag_id) ?? 0) + 1)
      if (['draft', 'idea'].includes(p.status) && new Date(p.created_at).getTime() < sevenDaysAgo) {
        staleDrafts++
      }
    }

    const tags: BlogTag[] = (tagsResult.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      color: t.color,
      colorDark: t.color_dark,
      badge: t.badge,
      sortOrder: t.sort_order,
      postCount: tagCountMap.get(t.id) ?? 0,
    }))

    const site = siteResult.data
    return {
      tags,
      tabBadges: { editorial: staleDrafts },
      siteTimezone: site?.timezone ?? 'America/Sao_Paulo',
      siteName: site?.name ?? '',
      defaultLocale: site?.default_locale ?? 'pt-BR',
      supportedLocales: site?.supported_locales ?? ['pt-BR', 'en'],
    }
  },
  ['blog-shared'],
  { tags: ['blog-hub'], revalidate: 60 },
)

export const fetchOverviewData = unstable_cache(
  async (siteId: string, tagId?: string | null, locale?: string | null): Promise<OverviewTabData> => {
    const supabase = getSupabaseServiceClient()

    let postsQuery = supabase
      .from('blog_posts')
      .select('id, status, tag_id, published_at, created_at, blog_translations(locale, reading_time_min)')
      .eq('site_id', siteId)
    if (tagId) postsQuery = postsQuery.eq('tag_id', tagId)

    const [postsResult, tagsResult] = await Promise.all([
      postsQuery,
      supabase.from('blog_tags').select('id, name, color').eq('site_id', siteId),
    ])

    let posts = postsResult.data ?? []
    if (locale) {
      posts = posts.filter((p: Record<string, unknown>) => {
        const txs = (p as { blog_translations: Array<{ locale: string }> }).blog_translations ?? []
        return txs.some((t) => t.locale === locale)
      })
    }

    const tags = tagsResult.data ?? []
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000

    const totalPosts = posts.length
    const published = posts.filter((p) => p.status === 'published')
    const backlog = posts.filter((p) => ['idea', 'draft', 'pending_review'].includes(p.status as string))

    const publishedReadingTimes = published
      .flatMap((p) => ((p as { blog_translations: Array<{ reading_time_min: number | null }> }).blog_translations ?? []).map((t) => t.reading_time_min))
      .filter((rt): rt is number => rt !== null && rt > 0)
    const avgReadingTime = publishedReadingTimes.length > 0
      ? Math.round((publishedReadingTimes.reduce((a, b) => a + b, 0) / publishedReadingTimes.length) * 10) / 10
      : 0

    const recentCreated = posts.filter((p) => now - new Date(p.created_at).getTime() < 7 * day).length
    const prevCreated = posts.filter((p) => {
      const age = now - new Date(p.created_at).getTime()
      return age >= 7 * day && age < 14 * day
    }).length
    const totalPostsTrend = prevCreated > 0 ? Math.round(((recentCreated - prevCreated) / prevCreated) * 100) : 0

    const tagBreakdown = tags.map((t) => ({
      tagId: t.id as string,
      tagName: t.name as string,
      tagColor: t.color as string,
      count: posts.filter((p) => p.tag_id === t.id).length,
    }))
    const untaggedCount = posts.filter((p) => !p.tag_id).length
    if (untaggedCount > 0) {
      tagBreakdown.push({ tagId: null as unknown as string, tagName: 'Untagged', tagColor: '#6b7280', count: untaggedCount })
    }
    tagBreakdown.sort((a, b) => b.count - a.count)

    const recentPubs = published
      .filter((p) => p.published_at)
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
      .slice(0, 5)
      .map((p) => {
        const txs = (p as { blog_translations: Array<{ locale: string; reading_time_min: number | null }> }).blog_translations ?? []
        const tag = tags.find((t) => t.id === p.tag_id)
        return {
          id: p.id,
          title: txs[0]?.title ?? 'Untitled',
          tagName: (tag?.name as string) ?? null,
          tagColor: (tag?.color as string) ?? null,
          locales: txs.map((t) => t.locale),
          publishedAt: p.published_at!,
          readingTimeMin: txs[0]?.reading_time_min ?? null,
        }
      })

    const weeklyVelocity: number[] = []
    for (let w = 7; w >= 0; w--) {
      const weekStart = now - (w + 1) * 7 * day
      const weekEnd = now - w * 7 * day
      weeklyVelocity.push(
        published.filter((p) => {
          const t = new Date(p.published_at!).getTime()
          return t >= weekStart && t < weekEnd
        }).length,
      )
    }

    return {
      kpis: {
        totalPosts,
        totalPostsTrend,
        published: published.length,
        publishedTrend: 0,
        avgReadingTime,
        avgReadingTimeTrend: 0,
        draftBacklog: backlog.length,
        draftBacklogTrend: 0,
      },
      sparklines: {
        totalPosts: [totalPosts],
        published: [published.length],
        avgReadingTime: [avgReadingTime],
        draftBacklog: [backlog.length],
      },
      tagBreakdown,
      recentPublications: recentPubs,
      velocitySparkline: weeklyVelocity,
    }
  },
  ['blog-overview'],
  { tags: ['blog-hub', 'blog-hub-overview'], revalidate: 60 },
)

export const fetchEditorialData = unstable_cache(
  async (siteId: string, tagId?: string | null, locale?: string | null): Promise<EditorialTabData> => {
    const supabase = getSupabaseServiceClient()

    let query = supabase
      .from('blog_posts')
      .select('id, status, tag_id, published_at, scheduled_for, slot_date, created_at, updated_at, blog_translations(locale, title, slug, reading_time_min, content_mdx), blog_tags(id, name, color)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
    if (tagId) query = query.eq('tag_id', tagId)

    const { data: rawPosts } = await query

    let posts = rawPosts ?? []
    if (locale) {
      posts = posts.filter((p: Record<string, unknown>) => {
        const txs = (p as { blog_translations: Array<{ locale: string }> }).blog_translations ?? []
        return txs.some((t) => t.locale === locale)
      })
    }

    type RawPost = typeof posts[number] & {
      blog_translations: Array<{ locale: string; title: string; slug: string; reading_time_min: number | null; content_mdx: string }>
      blog_tags: { id: string; name: string; color: string } | null
    }

    const cards: PostCard[] = (posts as unknown as RawPost[]).map((p, i) => {
      const txs = p.blog_translations ?? []
      const preferredTx = (locale ? txs.find((t) => t.locale === locale) : null) ?? txs[0]
      return {
        id: p.id,
        displayId: computeDisplayId(posts.length - i),
        title: preferredTx?.title ?? 'Untitled',
        status: p.status as PostCard['status'],
        tagId: p.tag_id,
        tagName: p.blog_tags?.name ?? null,
        tagColor: p.blog_tags?.color ?? null,
        locales: txs.map((t) => t.locale),
        readingTimeMin: preferredTx?.reading_time_min ?? null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        publishedAt: p.published_at,
        scheduledFor: p.scheduled_for,
        slotDate: p.slot_date,
        snippet: preferredTx?.content_mdx?.slice(0, 80) ?? null,
      }
    })

    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const publishedCards = cards.filter((c) => c.status === 'published')
    const throughput = publishedCards.filter(
      (c) => c.publishedAt && now - new Date(c.publishedAt).getTime() < 30 * day,
    ).length

    const completedPosts = publishedCards.filter((c) => c.publishedAt)
    const avgDays = completedPosts.length > 0
      ? Math.round(
          completedPosts.reduce((sum, c) => {
            return sum + (new Date(c.publishedAt!).getTime() - new Date(c.createdAt).getTime()) / day
          }, 0) / completedPosts.length,
        )
      : 0

    const movedThisWeek = cards.filter(
      (c) => now - new Date(c.updatedAt).getTime() < 7 * day && c.status !== 'published',
    ).length

    return {
      velocity: {
        throughput,
        avgIdeaToPublished: avgDays,
        movedThisWeek,
        bottleneck: null,
      },
      posts: cards,
    }
  },
  ['blog-editorial'],
  { tags: ['blog-hub', 'blog-hub-editorial'], revalidate: 30 },
)

export const fetchScheduleData = unstable_cache(
  async (siteId: string, _tagId?: string | null, _locale?: string | null): Promise<ScheduleTabData> => {
    const supabase = getSupabaseServiceClient()

    const [postsResult, cadenceResult, siteResult] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('id, status, tag_id, published_at, scheduled_for, slot_date, blog_translations(locale, title, reading_time_min), blog_tags(color)')
        .eq('site_id', siteId)
        .in('status', ['scheduled', 'queued', 'published', 'ready']),
      supabase
        .from('blog_cadence')
        .select('locale, cadence_days, preferred_send_time, cadence_start_date, cadence_paused, last_published_at')
        .eq('site_id', siteId),
      supabase
        .from('sites')
        .select('supported_locales')
        .eq('id', siteId)
        .single(),
    ])

    const posts = postsResult.data ?? []
    const cadences = cadenceResult.data ?? []
    const supportedLocales: string[] = (siteResult.data?.supported_locales as string[]) ?? ['pt-BR', 'en']

    const cadenceConfigs: BlogCadenceConfig[] = supportedLocales.map((loc) => {
      const c = cadences.find((cd) => cd.locale === loc)
      return {
        locale: loc,
        cadenceDays: c?.cadence_days ?? 7,
        preferredSendTime: c?.preferred_send_time ?? '09:00',
        cadenceStartDate: c?.cadence_start_date ?? null,
        cadencePaused: c?.cadence_paused ?? false,
        lastPublishedAt: c?.last_published_at ?? null,
      }
    })

    const now = new Date()
    const calendarStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const calendarEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const slotsMap = new Map<string, ScheduleSlot>()
    for (let d = new Date(calendarStart); d <= calendarEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0]!
      slotsMap.set(key, { date: key, posts: [], emptySlots: [] })
    }

    type PostWithRelations = typeof posts[number] & {
      blog_translations: Array<{ locale: string; title: string; reading_time_min: number | null }>
      blog_tags: { color: string } | null
    }

    for (const p of posts as unknown as PostWithRelations[]) {
      const dates: string[] = []
      if (p.slot_date) dates.push(p.slot_date)
      if (p.scheduled_for) dates.push(new Date(p.scheduled_for).toISOString().split('T')[0]!)
      if (p.published_at) dates.push(new Date(p.published_at).toISOString().split('T')[0]!)

      for (const dateStr of dates) {
        const slot = slotsMap.get(dateStr)
        if (slot) {
          const txs = p.blog_translations ?? []
          slot.posts.push({
            id: p.id,
            title: txs[0]?.title ?? 'Untitled',
            tagColor: p.blog_tags?.color ?? null,
            status: p.status,
            locale: txs[0]?.locale ?? 'en',
          })
        }
      }
    }

    for (const config of cadenceConfigs) {
      if (config.cadencePaused || !config.cadenceStartDate) continue
      try {
        const slots = generateSlots(
          { cadenceDays: config.cadenceDays, cadenceStartDate: config.cadenceStartDate, cadencePaused: false },
          { from: calendarStart, to: calendarEnd },
        )
        for (const s of slots) {
          const key = s.toISOString().split('T')[0]!
          const slot = slotsMap.get(key)
          if (slot && slot.posts.length === 0) {
            slot.emptySlots.push({ locale: config.locale })
          }
        }
      } catch {
        // generateSlots may throw on invalid config — skip
      }
    }

    const calendarSlots = [...slotsMap.values()]
    const scheduledPosts = posts.filter((p) => ['scheduled', 'queued'].includes(p.status))

    const next7 = scheduledPosts.filter((p) => {
      const d = p.scheduled_for ?? p.slot_date
      if (!d) return false
      const diff = new Date(d).getTime() - now.getTime()
      return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000
    }).length

    const totalSlots = calendarSlots.reduce((sum, s) => sum + (s.emptySlots.length > 0 || s.posts.length > 0 ? 1 : 0), 0)
    const filledSlots = calendarSlots.reduce((sum, s) => sum + (s.posts.length > 0 ? 1 : 0), 0)
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0

    const activeLocales = cadenceConfigs.filter((c) => !c.cadencePaused).length

    const readingTimes = (scheduledPosts as unknown as PostWithRelations[])
      .flatMap((p) => (p.blog_translations ?? []).map((t) => t.reading_time_min))
      .filter((rt): rt is number => rt !== null && rt > 0)
    const avgRT = readingTimes.length > 0
      ? Math.round((readingTimes.reduce((a, b) => a + b, 0) / readingTimes.length) * 10) / 10
      : 0

    return {
      healthStrip: {
        fillRate,
        next7Days: next7,
        avgReadingTime: avgRT,
        activeLocales,
        totalLocales: supportedLocales.length,
      },
      calendarSlots,
      cadenceConfigs,
    }
  },
  ['blog-schedule'],
  { tags: ['blog-hub', 'blog-hub-schedule'], revalidate: 60 },
)
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-queries.ts
git commit -m "feat(blog-hub): data fetching queries (shared, overview, editorial, schedule)"
```

---

### Task 12: Hub hooks — `use-auto-refresh.ts` + `use-hub-shortcuts.ts`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/use-auto-refresh.ts`
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/use-hub-shortcuts.ts`

- [ ] **Step 1: Clone hooks from newsletter hub**

Copy `apps/web/src/app/cms/(authed)/newsletters/_hub/use-auto-refresh.ts` → `apps/web/src/app/cms/(authed)/blog/_hub/use-auto-refresh.ts` (no changes needed — it's generic).

Copy `apps/web/src/app/cms/(authed)/newsletters/_hub/use-hub-shortcuts.ts` → `apps/web/src/app/cms/(authed)/blog/_hub/use-hub-shortcuts.ts`. Adapt:
- Change tab shortcuts from `1-5` to `1-4` (4 tabs instead of 5)
- Change type import from `TabId` to `BlogTabId`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/use-auto-refresh.ts apps/web/src/app/cms/'(authed)'/blog/_hub/use-hub-shortcuts.ts
git commit -m "feat(blog-hub): auto-refresh + keyboard shortcuts hooks"
```

---

### Task 13: Hub client shell — `hub-client.tsx`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_hub/hub-client.tsx`

- [ ] **Step 1: Create hub-client.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx`

Adapt for blog hub:
- 4 tabs instead of 5 (overview, editorial, schedule, analytics)
- Use `BlogTabId` from `./hub-types`
- Use `BlogHubStrings` from `../_i18n/types`
- Two filter chip rows: `TagFilterChips` + `LocaleFilterChips`
- URL params: `?tab=`, `?tag=`, `?locale=`
- "New Post" button instead of "New Edition"
- Bell badge from `tabBadges.editorial`
- `TagDrawer` instead of `TypeDrawer`
- Import hooks from local `./use-auto-refresh` and `./use-hub-shortcuts`

The component should follow the same structure as the newsletter `HubClient`:
- Header with title + refresh indicator + "New Post" button + bell
- Tab bar with icons
- Tag filter chips row
- Locale filter chips row
- Tab panel content via `{children}`
- Tag drawer

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-client.tsx
git commit -m "feat(blog-hub): hub client shell with tabs + dual filter"
```

---

### Task 14: Overview tab components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/overview-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/kpi-strip.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/tag-breakdown.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/recent-publications.tsx`

- [ ] **Step 1: Create kpi-strip.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/overview/kpi-strip.tsx`

4 KPI cards (Total Posts, Published, Avg Reading Time, Draft Backlog) with sparklines and trend arrows. Use `SparklineSvg` from `../../_shared/sparkline-svg`.

- [ ] **Step 2: Create tag-breakdown.tsx**

Horizontal bar chart showing post count per tag. Each bar is color-coded by `tag.color`. Sorted by count descending. "Untagged" row at bottom.

- [ ] **Step 3: Create recent-publications.tsx**

List of last 5 published posts. Each row shows title (linked), tag badge, locale badges, relative date, reading time.

- [ ] **Step 4: Create overview-tab.tsx**

Client component orchestrating KPI strip + tag breakdown + recent publications + velocity sparkline. Wraps each section in `SectionErrorBoundary`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/overview/
git commit -m "feat(blog-hub): overview tab (KPIs, tag breakdown, recent publications)"
```

---

### Task 15: Kanban components — card + column

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-column.tsx`

- [ ] **Step 1: Create kanban-card.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-card.tsx`

Adapt:
- Use `PostCard` type instead of `EditionCard`
- Show `displayId` + tag badge (colored dot + name) in header
- Show `title` (or "Untitled" in gray)
- Show locale badges (e.g., `PT-BR`, `EN`)
- Show reading time + relative date
- Context menu (More `⋯`): Open, Move to (submenu with valid targets), Change tag (submenu), Add locale (submenu), Delete
- Sub-state badges: orange "Review" for `pending_review`, amber "Queued" for `queued`
- `KanbanCardOverlay` for drag overlay (simplified version without context menu)
- Use `useSortable` from `@dnd-kit/sortable`

- [ ] **Step 2: Create kanban-column.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-column.tsx`

Adapt:
- Use `PostCard` type
- Use `SortableContext` with `verticalListSortingStrategy`
- Use `useDroppable` from `@dnd-kit/core`
- Accept `activeId` prop to show visual feedback during drag
- Special handling for published column: show cap footer when `cards.length >= 15`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/kanban-card.tsx apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/kanban-column.tsx
git commit -m "feat(blog-hub): kanban card + column components"
```

---

### Task 16: Kanban board + quick-add + velocity strip

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-board.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/quick-add-input.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/velocity-strip.tsx`

- [ ] **Step 1: Create kanban-board.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-board.tsx`

Adapt for blog:
- 5 columns: idea, draft, ready, scheduled, published
- Use `mapStatusToColumn` from `../../_hub/hub-utils` to bucket posts
- Published column capped at 15 cards with footer link
- Archived section: collapsible below kanban, shows archived cards with "Restore" action
- DnD: same `DndContext` + `DragOverlay` pattern as newsletter
- `useOptimistic` + `localPostsRef` pattern for flicker-free drops
- Props: `posts`, `onMovePost`, `onDeletePost`, `onReassignTag`, `onAddLocale`, `strings`, `tags`

- [ ] **Step 2: Create quick-add-input.tsx**

```typescript
// apps/web/src/app/cms/(authed)/blog/_tabs/editorial/quick-add-input.tsx
'use client'

import { useCallback, useRef, useState, useTransition } from 'react'

interface QuickAddInputProps {
  placeholder: string
  onAdd: (title: string) => Promise<void>
}

export function QuickAddInput({ placeholder, onAdd }: QuickAddInputProps) {
  const [value, setValue] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    setValue('')
    startTransition(async () => {
      await onAdd(trimmed)
    })
  }, [value, onAdd, startTransition])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleSubmit()
        }
      }}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-2.5 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
    />
  )
}
```

- [ ] **Step 3: Create velocity-strip.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/velocity-strip.tsx`

Adapt: show throughput, avg idea→published, moved this week, bottleneck. Use `EditorialTabData['velocity']` type.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/
git commit -m "feat(blog-hub): kanban board + quick-add input + velocity strip"
```

---

### Task 17: Editorial tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab.tsx`

- [ ] **Step 1: Create editorial-tab.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/editorial-tab.tsx`

Client component that orchestrates:
- Velocity strip (top)
- Kanban board with all post cards
- Wires server actions: `movePost`, `deleteHubPost`, `reassignTag`, `addLocale`, `createPost` (for quick-add)
- Filters posts by tag/locale if applied
- SectionErrorBoundary around each section

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/editorial-tab.tsx
git commit -m "feat(blog-hub): editorial tab orchestration"
```

---

### Task 18: Schedule tab components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/schedule/month-calendar.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/schedule/cadence-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/schedule/schedule-tab.tsx`

- [ ] **Step 1: Create month-calendar.tsx**

Clone from `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx`. Adapt:
- Use `ScheduleSlot` from blog types
- Color coding: cyan for slot, purple for scheduled, green for published
- Show post title in popover on cell click

- [ ] **Step 2: Create cadence-card.tsx**

Clone from `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card.tsx`. Adapt:
- Label by locale instead of newsletter type name
- Wire to `updateBlogCadence` action
- Same inline edit mode (cadence_days + preferred_send_time + pause/resume)

- [ ] **Step 3: Create schedule-tab.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx`

Client component with health strip + month calendar + cadence cards. Uses `ScheduleTabData` type.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/schedule/
git commit -m "feat(blog-hub): schedule tab (calendar + cadence cards)"
```

---

### Task 19: Analytics tab placeholder

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_tabs/analytics/analytics-tab.tsx`

- [ ] **Step 1: Create analytics placeholder**

```typescript
// apps/web/src/app/cms/(authed)/blog/_tabs/analytics/analytics-tab.tsx
'use client'

import { TrendingUp } from 'lucide-react'
import { EmptyState } from '../../_shared/empty-state'
import type { BlogHubStrings } from '../../_i18n/types'

interface AnalyticsTabProps {
  strings: BlogHubStrings
}

export function AnalyticsTab({ strings }: AnalyticsTabProps) {
  return (
    <EmptyState
      icon={<TrendingUp className="h-10 w-10 text-gray-600" />}
      heading={strings.analytics.comingSoon}
      description={strings.analytics.comingSoonDescription}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/analytics/
git commit -m "feat(blog-hub): analytics tab placeholder"
```

---

### Task 20: Tag drawer

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_components/tag-drawer.tsx`

- [ ] **Step 1: Create tag-drawer.tsx**

Reference: `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx`

Clone and adapt the newsletter `TypeDrawer`:
- Rename to `TagDrawer`
- 3 sections instead of 4 (Essentials, Appearance, Danger Zone — no Landing Page or Schedule sections)
- Essentials: name, slug, badge
- Appearance: color picker + dark variant
- Danger Zone: delete with name confirmation + post count check
- Wire to `createTag`, `updateTag`, `deleteTag` server actions
- Use `BlogHubStrings['tagDrawer']` for strings
- Slug auto-generation from name (same kebab-case logic as newsletter)
- Validation: hex color, slug format, uniqueness

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_components/tag-drawer.tsx
git commit -m "feat(blog-hub): tag CRUD drawer"
```

---

### Task 21: Page.tsx rewrite — server component hub shell

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the current flat list page with the hub shell. Reference: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`

```typescript
// apps/web/src/app/cms/(authed)/blog/page.tsx
import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import type { BlogTabId } from './_hub/hub-types'
import { fetchBlogSharedData, fetchOverviewData, fetchEditorialData, fetchScheduleData } from './_hub/hub-queries'
import { HubClient } from './_hub/hub-client'
import { TabSkeleton } from './_hub/tab-skeleton'
import { en } from './_i18n/en'
import { ptBR } from './_i18n/pt-BR'
import type { BlogHubStrings } from './_i18n/types'

import { OverviewTab } from './_tabs/overview/overview-tab'
import { EditorialTab } from './_tabs/editorial/editorial-tab'
import { ScheduleTab } from './_tabs/schedule/schedule-tab'
import { AnalyticsTab } from './_tabs/analytics/analytics-tab'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

async function TabContent({
  tab,
  siteId,
  tagId,
  locale,
  strings,
}: {
  tab: BlogTabId
  siteId: string
  tagId: string | null
  locale: string | null
  strings: BlogHubStrings
}) {
  switch (tab) {
    case 'overview': {
      const data = await fetchOverviewData(siteId, tagId, locale)
      return <OverviewTab data={data} strings={strings} />
    }
    case 'editorial': {
      const data = await fetchEditorialData(siteId, tagId, locale)
      return <EditorialTab data={data} strings={strings} siteId={siteId} tagId={tagId} locale={locale} />
    }
    case 'schedule': {
      const data = await fetchScheduleData(siteId, tagId, locale)
      return <ScheduleTab data={data} strings={strings} />
    }
    case 'analytics':
      return <AnalyticsTab strings={strings} />
  }
}

export default async function BlogHubPage({ searchParams }: Props) {
  const params = await searchParams
  const ctx = await getSiteContext()
  const { siteId } = ctx

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const tab = (params.tab as BlogTabId) || 'overview'
  const tagId = params.tag || null
  const filterLocale = params.locale || null

  const [sharedData, strings] = await Promise.all([
    fetchBlogSharedData(siteId),
    Promise.resolve(uiLocale === 'pt-BR' ? ptBR : en),
  ])

  return (
    <HubClient
      sharedData={sharedData}
      defaultTab={tab}
      tabLabels={strings.tabs}
      allTagsLabel={strings.common.allTags}
      allLocalesLabel={strings.common.allLocales}
      editLabel={strings.common.edit}
      locale={uiLocale}
      drawerStrings={strings.tagDrawer}
      commonStrings={strings.common}
      actionStrings={strings.actions}
    >
      <Suspense fallback={<TabSkeleton />}>
        <TabContent tab={tab} siteId={siteId} tagId={tagId} locale={filterLocale} strings={strings} />
      </Suspense>
    </HubClient>
  )
}
```

- [ ] **Step 2: Run typecheck + tests**

Run: `npm run test:web`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/page.tsx
git commit -m "feat(blog-hub): rewrite page.tsx as hub server component"
```

---

### Task 22: New post page — isDirty ephemeral pattern

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/page.tsx`

- [ ] **Step 1: Rewrite new/page.tsx**

Replace the current "create immediately and redirect" page with a client-side isDirty ephemeral pattern. The page renders an empty editor that only persists to DB on first meaningful edit.

```typescript
// apps/web/src/app/cms/(authed)/blog/new/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { NewPostEditor } from './new-post-editor'

export const dynamic = 'force-dynamic'

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getSiteContext()
  const sp = await searchParams
  const locale = typeof sp?.locale === 'string' ? sp.locale : ctx.defaultLocale
  const tagId = typeof sp?.tag === 'string' ? sp.tag : undefined

  return <NewPostEditor locale={locale} tagId={tagId} defaultLocale={ctx.defaultLocale} />
}
```

- [ ] **Step 2: Create client component**

Create `apps/web/src/app/cms/(authed)/blog/new/new-post-editor.tsx`:

```typescript
// apps/web/src/app/cms/(authed)/blog/new/new-post-editor.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PostEditor } from '@tn-figueiredo/cms'
import { createPost } from '../actions'
import { savePost, compilePreview, uploadAsset } from '../[id]/edit/actions'

interface NewPostEditorProps {
  locale: string
  tagId?: string
  defaultLocale: string
}

export function NewPostEditor({ locale, tagId, defaultLocale }: NewPostEditorProps) {
  const router = useRouter()
  const [postId, setPostId] = useState<string | null>(null)
  const creatingRef = useRef(false)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!postId && !creatingRef.current) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [postId])

  const ensurePost = useCallback(
    async (title: string): Promise<string | null> => {
      if (postId) return postId
      if (creatingRef.current) return null
      creatingRef.current = true

      const result = await createPost({ title, locale, tagId, status: 'draft' })
      if (!result.ok) {
        creatingRef.current = false
        return null
      }

      setPostId(result.postId)
      router.replace(`/cms/blog/${result.postId}/edit`, { scroll: false })
      return result.postId
    },
    [postId, locale, tagId, router],
  )

  const handleSave = useCallback(
    async (input: { content_mdx: string; title: string; slug: string; excerpt?: string | null; meta_title?: string | null; meta_description?: string | null; og_image_url?: string | null; cover_image_url?: string | null }) => {
      const hasMeaningfulContent = input.title.trim().length > 0 || input.content_mdx.trim().length > 0
      if (!hasMeaningfulContent) {
        return { ok: true as const }
      }

      const id = await ensurePost(input.title)
      if (!id) return { ok: false as const, error: 'db_error' as const, message: 'Failed to create post' }

      return savePost(id, locale, input)
    },
    [ensurePost, locale],
  )

  const isPt = locale === 'pt-BR'
  return (
    <main>
      <PostEditor
        postId=""
        initialContent=""
        initialTitle=""
        initialSlug=""
        initialExcerpt=""
        initialMetaTitle=""
        initialMetaDescription=""
        initialOgImageUrl=""
        initialCoverImageUrl=""
        locale={locale}
        componentNames={[]}
        onSave={handleSave}
        onPreview={async (source) => compilePreview(source)}
        onUpload={async (file) => {
          const id = postId
          if (!id) throw new Error('Save first')
          return uploadAsset(file, id)
        }}
      />
    </main>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/new/
git commit -m "feat(blog-hub): isDirty ephemeral new post page"
```

---

### Task 23: Hub rendering tests

**Files:**
- Modify: `apps/web/test/cms/blog-hub.test.ts`

- [ ] **Step 1: Add rendering and action tests**

Append to the existing `blog-hub.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('blog-hub action status matrix', () => {
  const validMoves: Array<[string, string]> = [
    ['idea', 'draft'],
    ['idea', 'archived'],
    ['draft', 'idea'],
    ['draft', 'ready'],
    ['draft', 'pending_review'],
    ['draft', 'archived'],
    ['pending_review', 'draft'],
    ['pending_review', 'ready'],
    ['pending_review', 'archived'],
    ['ready', 'draft'],
    ['ready', 'scheduled'],
    ['ready', 'queued'],
    ['ready', 'published'],
    ['ready', 'archived'],
    ['queued', 'ready'],
    ['queued', 'scheduled'],
    ['queued', 'archived'],
    ['scheduled', 'ready'],
    ['scheduled', 'draft'],
    ['scheduled', 'archived'],
    ['published', 'archived'],
    ['archived', 'idea'],
    ['archived', 'draft'],
  ]

  const invalidMoves: Array<[string, string]> = [
    ['idea', 'published'],
    ['idea', 'scheduled'],
    ['draft', 'published'],
    ['draft', 'scheduled'],
    ['published', 'draft'],
    ['published', 'idea'],
    ['archived', 'published'],
    ['archived', 'scheduled'],
  ]

  it.each(validMoves)('%s → %s should be valid', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true)
  })

  it.each(invalidMoves)('%s → %s should be invalid', (from, to) => {
    expect(isValidTransition(from, to)).toBe(false)
  })
})

describe('mapStatusToColumn', () => {
  it('maps all 8 statuses correctly', () => {
    const expected: Record<string, string> = {
      idea: 'idea',
      draft: 'draft',
      pending_review: 'draft',
      ready: 'ready',
      queued: 'ready',
      scheduled: 'scheduled',
      published: 'published',
      archived: 'archived',
    }
    for (const [status, column] of Object.entries(expected)) {
      expect(mapStatusToColumn(status as PostCard['status'])).toBe(column)
    }
  })
})

describe('formatRelativeDate', () => {
  it('returns "now" for dates within last minute', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('now')
  })

  it('returns minutes for recent dates', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelativeDate(fiveMinAgo)).toBe('5m')
  })

  it('returns hours for dates within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(threeHoursAgo)).toBe('3h')
  })

  it('returns days for dates within a month', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(twoDaysAgo)).toBe('2d')
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm run test:web -- --reporter=verbose --testPathPattern=blog-hub`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/blog-hub.test.ts
git commit -m "test(blog-hub): extended unit tests for transitions, column mapping, relative dates"
```

---

### Task 24: Editor page modifications — displayId + tag context

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx`

- [ ] **Step 1: Add displayId and tag info to editor page**

In the editor page, add:
- Query for the post's `tag_id` and join `blog_tags(name, color)` to display the tag badge
- Compute `displayId` from row number
- Pass tag info to the editor header

Add to the existing `EditPostPage` component, after fetching the post:

```typescript
// After: const post = await postRepo().getById(id)
// Add: fetch tag + displayId
const supabase = getSupabaseServiceClient()
const { data: postExtra } = await supabase
  .from('blog_posts')
  .select('tag_id, blog_tags(name, color)')
  .eq('id', id)
  .single()

const { count } = await supabase
  .from('blog_posts')
  .select('id', { count: 'exact', head: true })
  .eq('site_id', ctx.siteId)
  .lte('created_at', post.created_at)

const displayId = computeDisplayId(count ?? 1)
```

Update the header to show `displayId` and tag badge.

- [ ] **Step 2: Run tests**

Run: `npm run test:web`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/'[id]'/edit/page.tsx
git commit -m "feat(blog-hub): editor page shows displayId + tag badge"
```

---

### Task 25: Full integration test + final verification

**Files:**
- Run all tests

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (web + api)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Start dev server and verify**

Run: `npm run dev -w apps/web`
Navigate to `http://localhost:3000/cms/blog`
Verify:
- Hub renders with 4 tabs
- Tag filter chips show existing tags (backfilled from categories)
- Locale filter chips show PT-BR + EN
- Overview tab shows KPIs
- Editorial tab shows kanban with 5 columns
- Quick-add input works in Idea column
- Drag and drop moves cards between columns
- Tag drawer opens via + button
- Schedule tab shows calendar + cadence cards
- Analytics tab shows placeholder

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(blog-hub): final integration verification"
```
