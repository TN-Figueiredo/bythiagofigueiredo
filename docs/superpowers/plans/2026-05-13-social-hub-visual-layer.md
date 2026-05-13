# Social Hub Visual Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete UI layer (22 screens) for the Social Hub CMS feature, wiring existing backend infrastructure (server actions, Realtime hooks, OAuth, cron) to interactive React components.

**Architecture:** Server page components fetch data via existing server actions, pass typed props to `'use client'` connected components. Tabs use URL search params. Shared i18n pattern with typed string objects per locale. Supabase Realtime hooks for live delivery/post status updates on the Post Detail page.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind 4 (cms-* CSS vars), TypeScript 5, `@tn-figueiredo/social` types, `@tn-figueiredo/cms-ui` shell/topbar, Vitest + React Testing Library, recharts for charts, lucide-react for icons, @dnd-kit for drag-reorder.

---

## Spec Reference

- Visual design spec: `docs/superpowers/specs/2026-05-13-social-hub-visual-design.md`
- Infrastructure spec: `docs/superpowers/specs/2026-05-12-sprint-5h-social-hub-design.md`
- DB migration: `supabase/migrations/20260513100000_social_hub.sql`

## Phase Dependency Graph

```
Phase 1 (Foundation) ──→ Phase 2 (Core Pages)  ──→ Phase 3 (Composer)
                                │                      Phase 4 (Posts Extensions)
                                │                      Phase 5 (Insights)
                                │                      Phase 6 (YouTube)
                                └──→ Phase 7 (Polish) ← all above
```

Phases 3–6 can run **in parallel** after Phase 2 completes. Within each phase, tasks can also run in parallel unless noted.

## File Structure

```
apps/web/src/app/cms/(authed)/
├── _shared/
│   ├── cms-sections.ts                          ← MODIFY (nav restructure)
│   └── social/                                  ← NEW (shared social components)
│       ├── social-status-badge.tsx
│       ├── platform-icon.tsx
│       └── platform-selector.tsx
├── social/
│   ├── page.tsx                                 ← REPLACE (Posts hub)
│   ├── _i18n/
│   │   ├── types.ts                             ← NEW
│   │   ├── en.ts                                ← NEW
│   │   ├── pt-BR.ts                             ← NEW
│   │   └── index.ts                             ← NEW
│   ├── _components/
│   │   ├── posts-feed.tsx                       ← NEW
│   │   ├── post-card.tsx                        ← NEW
│   │   ├── posts-calendar.tsx                   ← NEW
│   │   ├── posts-queue.tsx                      ← NEW
│   │   ├── posts-drafts.tsx                     ← NEW
│   │   └── bulk-actions-bar.tsx                 ← NEW
│   ├── new/
│   │   ├── page.tsx                             ← REPLACE (Composer)
│   │   └── _components/
│   │       ├── composer-shell.tsx                ← NEW
│   │       ├── composer-editor.tsx               ← NEW
│   │       ├── platform-previews.tsx             ← NEW
│   │       ├── schedule-bar.tsx                  ← NEW
│   │       ├── image-composer.tsx                ← NEW
│   │       ├── video-composer.tsx                ← NEW
│   │       ├── template-picker.tsx               ← NEW
│   │       ├── bilingual-editor.tsx              ← NEW
│   │       └── draft-review-banner.tsx           ← NEW
│   ├── [id]/
│   │   ├── page.tsx                             ← REPLACE (Post Detail)
│   │   └── _components/
│   │       ├── post-detail.tsx                   ← NEW
│   │       ├── delivery-card.tsx                 ← NEW
│   │       └── post-timeline.tsx                 ← NEW
│   ├── insights/
│   │   ├── page.tsx                             ← NEW
│   │   └── _components/
│   │       ├── insights-overview.tsx             ← NEW
│   │       ├── insights-best-of.tsx              ← NEW
│   │       ├── insights-health.tsx               ← NEW
│   │       ├── kpi-card.tsx                      ← NEW
│   │       ├── engagement-chart.tsx              ← NEW
│   │       └── posting-heatmap.tsx               ← NEW
│   └── accounts/
│       ├── page.tsx                              ← NEW
│       └── _components/
│           ├── connections-grid.tsx               ← NEW
│           ├── platform-card.tsx                  ← NEW
│           ├── oauth-button.tsx                   ← NEW
│           ├── automations-list.tsx               ← NEW
│           └── automation-config-modal.tsx        ← NEW
├── youtube/
│   ├── layout.tsx                               ← MODIFY (add Videos + A/B tabs)
│   ├── dashboard-connected.tsx                  ← MODIFY (CTR + A/B badges)
│   └── _components/
│       ├── videos-tab.tsx                        ← NEW
│       ├── ab-lab-tab.tsx                        ← NEW
│       └── seo-breakdown.tsx                     ← NEW
└── settings/social/
    └── page.tsx                                 ← MODIFY (redirect to /cms/social/accounts)

apps/web/src/app/cms/(authed)/_shared/
└── notification-center.tsx                      ← NEW

apps/web/src/lib/social/
└── actions.ts                                   ← MODIFY (add insights + automation actions)

apps/web/test/cms/
├── social-navigation.test.ts                    ← NEW
├── social-status-badge.test.tsx                 ← NEW
├── social-accounts.test.tsx                     ← NEW
├── social-posts-feed.test.tsx                   ← NEW
├── social-post-detail.test.tsx                  ← NEW
├── social-composer.test.tsx                     ← NEW
├── social-insights.test.tsx                     ← NEW
├── social-youtube-enhancements.test.tsx         ← NEW
└── social-notification-center.test.tsx          ← NEW
```

---

## Phase 1: Foundation

### Task 1: Navigation Restructuring

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`
- Modify: `apps/web/src/app/cms/(authed)/settings/social/page.tsx`
- Test: `apps/web/test/cms/social-navigation.test.ts`

- [ ] **Step 1: Write the navigation test**

```ts
// apps/web/test/cms/social-navigation.test.ts
import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — Social Hub nav', () => {
  const sections = buildCmsSections()
  const social = sections.find(s => s.label === 'Social')!
  const content = sections.find(s => s.label === 'Content')!

  it('has a Social section', () => {
    expect(social).toBeDefined()
    expect(social.items.length).toBe(5)
  })

  it('includes YouTube in Social section, not Content', () => {
    const socialHrefs = social.items.map(i => i.href)
    expect(socialHrefs).toContain('/cms/youtube')
    const contentHrefs = content.items.map(i => i.href)
    expect(contentHrefs).not.toContain('/cms/youtube')
  })

  it('has correct nav items in order', () => {
    const labels = social.items.map(i => i.label)
    expect(labels).toEqual(['YouTube', 'Posts', 'Composer', 'Insights', 'Accounts'])
  })

  it('has correct routes', () => {
    const hrefs = social.items.map(i => i.href)
    expect(hrefs).toEqual([
      '/cms/youtube',
      '/cms/social',
      '/cms/social/new',
      '/cms/social/insights',
      '/cms/social/accounts',
    ])
  })

  it('sets reporter minRole for read-only items', () => {
    const postsItem = social.items.find(i => i.label === 'Posts')!
    expect(postsItem.minRole).toBe('reporter')
  })

  it('sets editor minRole for Composer', () => {
    const composerItem = social.items.find(i => i.label === 'Composer')!
    expect(composerItem.minRole).toBe('editor')
  })

  it('sets admin minRole for Accounts', () => {
    const accountsItem = social.items.find(i => i.label === 'Accounts')!
    expect(accountsItem.minRole).toBe('admin')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/social-navigation.test.ts`
Expected: FAIL — YouTube still in Content, Social section only has Calendar + New Post.

- [ ] **Step 3: Update cms-sections.ts**

Replace the full file content of `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`:

```ts
import { DEFAULT_SECTIONS, type SidebarSection } from '@tn-figueiredo/cms-ui'

export function buildCmsSections(): SidebarSection[] {
  const sections = DEFAULT_SECTIONS.map(section => {
    if (section.label === 'Content') {
      const items = [
        ...section.items,
        { icon: '🖼️', label: 'Media', href: '/cms/media', minRole: 'editor' as const },
        { icon: '🔗', label: 'Links', href: '/cms/links', minRole: 'editor' as const },
        { icon: '🎵', label: 'Playlists', href: '/cms/playlists', minRole: 'editor' as const },
      ]
      return { ...section, items }
    }
    return section
  })

  const pipelineSection: SidebarSection = {
    label: 'Pipeline',
    items: [
      { icon: '📊', label: 'Overview', href: '/cms/pipeline', minRole: 'editor' as const },
      { icon: '🎬', label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' as const },
      { icon: '✍️', label: 'Blog', href: '/cms/pipeline/blog_post', minRole: 'editor' as const },
      { icon: '📧', label: 'Newsletter', href: '/cms/pipeline/newsletter', minRole: 'editor' as const },
      { icon: '🎓', label: 'Course', href: '/cms/pipeline/course', minRole: 'editor' as const },
      { icon: '📣', label: 'Campaign', href: '/cms/pipeline/campaign', minRole: 'editor' as const },
      { icon: '📁', label: 'Collections', href: '/cms/pipeline/collections', minRole: 'editor' as const },
      { icon: '📝', label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' as const },
    ],
  }

  const socialSection: SidebarSection = {
    label: 'Social',
    items: [
      { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
      { icon: '📡', label: 'Posts', href: '/cms/social', minRole: 'reporter' as const },
      { icon: '✏️', label: 'Composer', href: '/cms/social/new', minRole: 'editor' as const },
      { icon: '📊', label: 'Insights', href: '/cms/social/insights', minRole: 'reporter' as const },
      { icon: '🔗', label: 'Accounts', href: '/cms/social/accounts', minRole: 'admin' as const },
    ],
  }

  const contentIdx = sections.findIndex(s => s.label === 'Content')
  sections.splice(contentIdx + 1, 0, pipelineSection, socialSection)
  return sections
}
```

- [ ] **Step 4: Redirect settings/social to accounts**

Replace `apps/web/src/app/cms/(authed)/settings/social/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function SettingsSocialRedirect() {
  redirect('/cms/social/accounts')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/social-navigation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/cms-sections.ts apps/web/src/app/cms/(authed)/settings/social/page.tsx apps/web/test/cms/social-navigation.test.ts
git commit -m "feat(social): restructure sidebar nav — YouTube→Social, 5 items, RBAC roles"
```

---

### Task 2: i18n Foundation

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/_i18n/types.ts`
- Create: `apps/web/src/app/cms/(authed)/social/_i18n/en.ts`
- Create: `apps/web/src/app/cms/(authed)/social/_i18n/pt-BR.ts`
- Create: `apps/web/src/app/cms/(authed)/social/_i18n/index.ts`

- [ ] **Step 1: Create types.ts**

```ts
// apps/web/src/app/cms/(authed)/social/_i18n/types.ts
export interface SocialStrings {
  nav: {
    posts: string
    composer: string
    insights: string
    accounts: string
  }
  posts: {
    title: string
    newPost: string
    tabs: { feed: string; calendar: string; queue: string; drafts: string }
    filters: { all: string; published: string; scheduled: string; failed: string; draft: string; cancelled: string }
    emptyFeed: string
    emptyFeedCta: string
    emptyCalendar: string
    emptyQueue: string
    emptyDrafts: string
    emptyDraftsCta: string
    bulk: { reschedule: string; retry: string; moveToQueue: string; delete: string; deleteConfirm: string }
    card: { clicks: string; engagement: string; edit: string; duplicate: string; view: string; cancel: string; retry: string; delete: string }
  }
  composer: {
    title: string
    modes: { text: string; image: string; video: string }
    editor: {
      contentLabel: string
      contentPlaceholder: string
      urlLabel: string
      urlPlaceholder: string
      hashtagsLabel: string
      hashtagsPlaceholder: string
      evergreenLabel: string
      evergreenHelp: string
      overrideLabel: string
      charCount: string
    }
    preview: { facebook: string; instagram: string; bluesky: string; youtube: string }
    schedule: {
      now: string
      scheduled: string
      queue: string
      pickDate: string
      smartSuggestion: string
      publish: string
      scheduleAction: string
      addToQueue: string
    }
    image: {
      addImages: string
      dragReorder: string
      igCarousel: string
      fbMulti: string
      bsSingle: string
      cropWarning: string
      captionLabel: string
    }
    video: {
      uploadZone: string
      uploadProgress: string
      channelLabel: string
      titleLabel: string
      descLabel: string
      categoryLabel: string
      privacyLabel: string
      playlistLabel: string
      tagsLabel: string
      quotaLabel: string
      crossPost: string
      crossPostNote: string
      abTestTitle: string
      abThumbnails: string
      abTitles: string
      rotationPeriod: string
      firstComment: string
    }
    template: {
      title: string
      blogAnnouncement: string
      videoLaunch: string
      newsletterShare: string
      linkShare: string
      evergreenReshare: string
      createCustom: string
    }
    bilingual: {
      enableEn: string
      ptBr: string
      en: string
      autoTranslate: string
      strategy: { separate: string; differentAccounts: string; primaryOnly: string }
    }
    draftReview: {
      banner: string
      source: string
      approve: string
      discard: string
    }
  }
  detail: {
    title: string
    back: string
    edit: string
    duplicate: string
    delete: string
    deleteConfirm: string
    deliveryStatus: string
    published: string
    failed: string
    retrying: string
    skipped: string
    pending: string
    reconnect: string
    retry: string
    viewOn: string
    timeline: string
    linkClicks: string
    metrics: { likes: string; comments: string; shares: string }
  }
  insights: {
    title: string
    tabs: { overview: string; bestOf: string; platformHealth: string }
    kpi: {
      postsPublished: string
      deliverySuccess: string
      linkClicks: string
      avgEngagement: string
      aiDraftsApproved: string
    }
    chart: { clicks: string; engagement: string; postCount: string; period7d: string; period30d: string; period90d: string }
    heatmap: { title: string; peakLabel: string }
    bestOf: {
      topThumbnails: string
      topTitles: string
      topPosts: string
      winner: string
      improvement: string
      autoApplied: string
    }
    health: {
      healthy: string
      expired: string
      warning: string
      tokenExpiry: string
      neverExpires: string
      quotaLabel: string
      deliveryRate: string
      recentErrors: string
      reconnect: string
    }
    empty: string
    emptyCta: string
  }
  accounts: {
    title: string
    tabs: { connections: string; automations: string }
    connections: {
      addAccount: string
      manage: string
      reconnect: string
      disconnect: string
      disconnectConfirm: string
      tokenOk: string
      tokenExpired: string
      tokenNever: string
      quotaLabel: string
      empty: string
    }
    automations: {
      blogPublished: string
      videoPublished: string
      newsletterSent: string
      evergreenTimer: string
      tokenExpiring: string
      postFailed: string
      abTestComplete: string
      playlistUpdated: string
      modeLabel: string
      modeDraft: string
      modeAutoPublish: string
      configure: string
    }
    config: {
      title: string
      triggerLabel: string
      actionMode: string
      targetPlatforms: string
      contentTemplate: string
      scheduling: string
      smartSchedule: string
      fixedDelay: string
      aiEnhance: string
      recentActivity: string
      save: string
      cancel: string
      delete: string
    }
  }
  notifications: {
    title: string
    markAllRead: string
    deliveryFailed: string
    tokenExpiring: string
    aiDraftsReady: string
    abTestComplete: string
    publishedSuccess: string
    empty: string
  }
  status: {
    draft: string
    scheduled: string
    publishing: string
    completed: string
    partial_failure: string
    failed: string
    cancelled: string
    pending: string
    published: string
    retrying: string
    skipped: string
  }
  platforms: {
    youtube: string
    facebook: string
    instagram: string
    bluesky: string
  }
}
```

- [ ] **Step 2: Create en.ts**

```ts
// apps/web/src/app/cms/(authed)/social/_i18n/en.ts
import type { SocialStrings } from './types'

export const en: SocialStrings = {
  nav: { posts: 'Posts', composer: 'Composer', insights: 'Insights', accounts: 'Accounts' },
  posts: {
    title: 'Social Posts',
    newPost: '+ New Post',
    tabs: { feed: 'Feed', calendar: 'Calendar', queue: 'Queue', drafts: 'Drafts' },
    filters: { all: 'All', published: 'Published', scheduled: 'Scheduled', failed: 'Failed', draft: 'Draft', cancelled: 'Cancelled' },
    emptyFeed: 'No social posts yet',
    emptyFeedCta: 'Create your first post',
    emptyCalendar: 'No posts scheduled',
    emptyQueue: 'Queue is empty',
    emptyDrafts: 'No AI drafts pending',
    emptyDraftsCta: 'Configure Automations',
    bulk: { reschedule: 'Reschedule', retry: 'Retry Failed', moveToQueue: 'Move to Queue', delete: 'Delete', deleteConfirm: 'Published posts are removed from CMS only — they remain live on platforms.' },
    card: { clicks: 'clicks', engagement: 'engagement', edit: 'Edit', duplicate: 'Duplicate', view: 'View', cancel: 'Cancel', retry: 'Retry', delete: 'Delete' },
  },
  composer: {
    title: 'New Social Post',
    modes: { text: 'Text / Link', image: 'Image', video: 'Video' },
    editor: {
      contentLabel: 'Content',
      contentPlaceholder: 'Write your post…',
      urlLabel: 'URL',
      urlPlaceholder: 'https://…',
      hashtagsLabel: 'Hashtags',
      hashtagsPlaceholder: 'Add hashtag…',
      evergreenLabel: 'Evergreen',
      evergreenHelp: 'Re-share periodically',
      overrideLabel: 'Override for this platform',
      charCount: '{count}/{max}',
    },
    preview: { facebook: 'Facebook', instagram: 'Instagram', bluesky: 'Bluesky', youtube: 'YouTube' },
    schedule: {
      now: 'Now',
      scheduled: 'Schedule',
      queue: 'Queue',
      pickDate: 'Pick date & time',
      smartSuggestion: 'Best: {day} {time} ({multiplier}× avg)',
      publish: 'Publish Now',
      scheduleAction: 'Schedule Post',
      addToQueue: 'Add to Queue',
    },
    image: {
      addImages: 'Add images',
      dragReorder: 'Drag to reorder',
      igCarousel: 'IG Carousel',
      fbMulti: 'FB Multi-photo',
      bsSingle: 'BS Image (1st only)',
      cropWarning: 'Source is {src} — IG will crop to 4:5',
      captionLabel: 'Caption',
    },
    video: {
      uploadZone: 'Drop video here or click to browse',
      uploadProgress: '{uploaded} / {total} MB',
      channelLabel: 'Channel',
      titleLabel: 'Title',
      descLabel: 'Description',
      categoryLabel: 'Category',
      privacyLabel: 'Privacy',
      playlistLabel: 'Playlist',
      tagsLabel: 'Tags',
      quotaLabel: 'Quota: {used} / {limit} units',
      crossPost: 'Cross-post',
      crossPostNote: 'Cross-posts go to draft queue for review',
      abTestTitle: 'A/B Test',
      abThumbnails: 'Thumbnails',
      abTitles: 'Titles',
      rotationPeriod: 'Rotation period',
      firstComment: 'First comment template',
    },
    template: {
      title: 'Templates',
      blogAnnouncement: 'Blog Announcement',
      videoLaunch: 'Video Launch',
      newsletterShare: 'Newsletter Share',
      linkShare: 'Link Share',
      evergreenReshare: 'Evergreen Re-share',
      createCustom: '+ Create custom',
    },
    bilingual: {
      enableEn: 'Add English version',
      ptBr: 'PT-BR',
      en: 'EN',
      autoTranslate: 'Auto-translate from PT',
      strategy: { separate: 'Separate posts, same platforms', differentAccounts: 'Different accounts per language', primaryOnly: 'Primary only (EN as draft)' },
    },
    draftReview: {
      banner: 'AI Draft — needs review',
      source: 'Source: {source}',
      approve: 'Approve & Schedule',
      discard: 'Discard',
    },
  },
  detail: {
    title: 'Post Detail',
    back: '← Back to posts',
    edit: 'Edit',
    duplicate: 'Duplicate',
    delete: 'Delete',
    deleteConfirm: 'This post and its deliveries will be permanently deleted.',
    deliveryStatus: 'Platform Deliveries',
    published: 'Published',
    failed: 'Failed',
    retrying: 'Retrying',
    skipped: 'Skipped',
    pending: 'Pending',
    reconnect: 'Reconnect',
    retry: 'Retry',
    viewOn: 'View on {platform}',
    timeline: 'Timeline',
    linkClicks: 'Link Clicks',
    metrics: { likes: 'Likes', comments: 'Comments', shares: 'Shares' },
  },
  insights: {
    title: 'Social Insights',
    tabs: { overview: 'Overview', bestOf: 'Best Of', platformHealth: 'Platform Health' },
    kpi: {
      postsPublished: 'Posts Published',
      deliverySuccess: 'Delivery Success',
      linkClicks: 'Link Clicks',
      avgEngagement: 'Avg Engagement',
      aiDraftsApproved: 'AI Drafts Approved',
    },
    chart: { clicks: 'Clicks', engagement: 'Engagement', postCount: 'Posts', period7d: '7 days', period30d: '30 days', period90d: '90 days' },
    heatmap: { title: 'Best Posting Times', peakLabel: 'Peak' },
    bestOf: {
      topThumbnails: 'Top Thumbnails by CTR',
      topTitles: 'Top Titles by CTR',
      topPosts: 'Top Posts by Clicks',
      winner: 'Winner',
      improvement: '{pct}% improvement',
      autoApplied: 'Auto-applied',
    },
    health: {
      healthy: 'Healthy',
      expired: 'Expired',
      warning: 'Warning',
      tokenExpiry: 'Expires in {days} days',
      neverExpires: 'Never expires',
      quotaLabel: 'YouTube Quota',
      deliveryRate: 'Delivery Success Rate',
      recentErrors: 'Recent Errors',
      reconnect: 'Reconnect',
    },
    empty: 'Insights need data',
    emptyCta: 'Create your first post',
  },
  accounts: {
    title: 'Social Accounts',
    tabs: { connections: 'Connections', automations: 'Automations' },
    connections: {
      addAccount: '+ Add account',
      manage: 'Manage',
      reconnect: 'Reconnect',
      disconnect: 'Disconnect',
      disconnectConfirm: 'Disconnect this account? Scheduled posts will not be published.',
      tokenOk: 'Connected',
      tokenExpired: 'Token expired',
      tokenNever: 'Never expires',
      quotaLabel: '{used} / {limit} units today',
      empty: 'No accounts connected',
    },
    automations: {
      blogPublished: 'Blog Published → Social Draft',
      videoPublished: 'Video Published → Cross-post + First Comment',
      newsletterSent: 'Newsletter Sent → Social Draft',
      evergreenTimer: 'Evergreen Timer → Re-share from Queue',
      tokenExpiring: 'Token Expiring (<7d) → Alert + Pause',
      postFailed: 'Post Failed → Auto-retry (3×)',
      abTestComplete: 'A/B Test Complete → Auto-apply Winner',
      playlistUpdated: 'Playlist Updated → Social Draft',
      modeLabel: 'Mode',
      modeDraft: 'Create Draft',
      modeAutoPublish: 'Auto-publish',
      configure: 'Configure',
    },
    config: {
      title: 'Configure Automation',
      triggerLabel: 'Trigger',
      actionMode: 'Action Mode',
      targetPlatforms: 'Target Platforms',
      contentTemplate: 'Content Template',
      scheduling: 'Scheduling',
      smartSchedule: 'Smart Schedule',
      fixedDelay: 'Fixed delay',
      aiEnhance: 'AI Enhancement',
      recentActivity: 'Recent Activity',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete Rule',
    },
  },
  notifications: {
    title: 'Notifications',
    markAllRead: 'Mark all read',
    deliveryFailed: 'Delivery failed on {platform}',
    tokenExpiring: '{platform} token expiring in {days} days',
    aiDraftsReady: '{count} AI drafts ready for review',
    abTestComplete: 'A/B test complete: {winner} won',
    publishedSuccess: 'Published to {platforms}',
    empty: 'No notifications',
  },
  status: {
    draft: 'Draft',
    scheduled: 'Scheduled',
    publishing: 'Publishing',
    completed: 'Published',
    partial_failure: 'Partial Failure',
    failed: 'Failed',
    cancelled: 'Cancelled',
    pending: 'Pending',
    published: 'Published',
    retrying: 'Retrying',
    skipped: 'Skipped',
  },
  platforms: {
    youtube: 'YouTube',
    facebook: 'Facebook',
    instagram: 'Instagram',
    bluesky: 'Bluesky',
  },
}
```

- [ ] **Step 3: Create pt-BR.ts**

```ts
// apps/web/src/app/cms/(authed)/social/_i18n/pt-BR.ts
import type { SocialStrings } from './types'

export const ptBR: SocialStrings = {
  nav: { posts: 'Posts', composer: 'Compositor', insights: 'Métricas', accounts: 'Contas' },
  posts: {
    title: 'Posts Sociais',
    newPost: '+ Novo Post',
    tabs: { feed: 'Feed', calendar: 'Calendário', queue: 'Fila', drafts: 'Rascunhos' },
    filters: { all: 'Todos', published: 'Publicados', scheduled: 'Agendados', failed: 'Falharam', draft: 'Rascunho', cancelled: 'Cancelados' },
    emptyFeed: 'Nenhum post social ainda',
    emptyFeedCta: 'Crie seu primeiro post',
    emptyCalendar: 'Nenhum post agendado',
    emptyQueue: 'Fila vazia',
    emptyDrafts: 'Nenhum rascunho de IA pendente',
    emptyDraftsCta: 'Configurar Automações',
    bulk: { reschedule: 'Reagendar', retry: 'Retentar Falhas', moveToQueue: 'Mover para Fila', delete: 'Excluir', deleteConfirm: 'Posts publicados são removidos apenas do CMS — permanecem ativos nas plataformas.' },
    card: { clicks: 'cliques', engagement: 'engajamento', edit: 'Editar', duplicate: 'Duplicar', view: 'Ver', cancel: 'Cancelar', retry: 'Retentar', delete: 'Excluir' },
  },
  composer: {
    title: 'Novo Post Social',
    modes: { text: 'Texto / Link', image: 'Imagem', video: 'Vídeo' },
    editor: {
      contentLabel: 'Conteúdo',
      contentPlaceholder: 'Escreva seu post…',
      urlLabel: 'URL',
      urlPlaceholder: 'https://…',
      hashtagsLabel: 'Hashtags',
      hashtagsPlaceholder: 'Adicionar hashtag…',
      evergreenLabel: 'Evergreen',
      evergreenHelp: 'Recompartilhar periodicamente',
      overrideLabel: 'Texto específico para esta plataforma',
      charCount: '{count}/{max}',
    },
    preview: { facebook: 'Facebook', instagram: 'Instagram', bluesky: 'Bluesky', youtube: 'YouTube' },
    schedule: {
      now: 'Agora',
      scheduled: 'Agendar',
      queue: 'Fila',
      pickDate: 'Escolher data e hora',
      smartSuggestion: 'Melhor: {day} {time} ({multiplier}× média)',
      publish: 'Publicar Agora',
      scheduleAction: 'Agendar Post',
      addToQueue: 'Adicionar à Fila',
    },
    image: {
      addImages: 'Adicionar imagens',
      dragReorder: 'Arraste para reordenar',
      igCarousel: 'IG Carrossel',
      fbMulti: 'FB Multi-foto',
      bsSingle: 'BS Imagem (só 1ª)',
      cropWarning: 'Origem é {src} — IG vai recortar para 4:5',
      captionLabel: 'Legenda',
    },
    video: {
      uploadZone: 'Solte o vídeo aqui ou clique para buscar',
      uploadProgress: '{uploaded} / {total} MB',
      channelLabel: 'Canal',
      titleLabel: 'Título',
      descLabel: 'Descrição',
      categoryLabel: 'Categoria',
      privacyLabel: 'Privacidade',
      playlistLabel: 'Playlist',
      tagsLabel: 'Tags',
      quotaLabel: 'Cota: {used} / {limit} unidades',
      crossPost: 'Cross-post',
      crossPostNote: 'Cross-posts vão para fila de rascunhos para revisão',
      abTestTitle: 'Teste A/B',
      abThumbnails: 'Thumbnails',
      abTitles: 'Títulos',
      rotationPeriod: 'Período de rotação',
      firstComment: 'Template do primeiro comentário',
    },
    template: {
      title: 'Templates',
      blogAnnouncement: 'Anúncio de Blog',
      videoLaunch: 'Lançamento de Vídeo',
      newsletterShare: 'Compartilhar Newsletter',
      linkShare: 'Compartilhar Link',
      evergreenReshare: 'Recompartilhar Evergreen',
      createCustom: '+ Criar personalizado',
    },
    bilingual: {
      enableEn: 'Adicionar versão em inglês',
      ptBr: 'PT-BR',
      en: 'EN',
      autoTranslate: 'Traduzir automaticamente do PT',
      strategy: { separate: 'Posts separados, mesmas plataformas', differentAccounts: 'Contas diferentes por idioma', primaryOnly: 'Apenas primário (EN como rascunho)' },
    },
    draftReview: {
      banner: 'Rascunho de IA — precisa de revisão',
      source: 'Origem: {source}',
      approve: 'Aprovar e Agendar',
      discard: 'Descartar',
    },
  },
  detail: {
    title: 'Detalhe do Post',
    back: '← Voltar para posts',
    edit: 'Editar',
    duplicate: 'Duplicar',
    delete: 'Excluir',
    deleteConfirm: 'Este post e suas entregas serão permanentemente excluídos.',
    deliveryStatus: 'Entregas por Plataforma',
    published: 'Publicado',
    failed: 'Falhou',
    retrying: 'Retentando',
    skipped: 'Ignorado',
    pending: 'Pendente',
    reconnect: 'Reconectar',
    retry: 'Retentar',
    viewOn: 'Ver no {platform}',
    timeline: 'Linha do Tempo',
    linkClicks: 'Cliques no Link',
    metrics: { likes: 'Curtidas', comments: 'Comentários', shares: 'Compartilhamentos' },
  },
  insights: {
    title: 'Métricas Sociais',
    tabs: { overview: 'Visão Geral', bestOf: 'Melhores', platformHealth: 'Saúde das Plataformas' },
    kpi: {
      postsPublished: 'Posts Publicados',
      deliverySuccess: 'Taxa de Entrega',
      linkClicks: 'Cliques nos Links',
      avgEngagement: 'Engajamento Médio',
      aiDraftsApproved: 'Rascunhos IA Aprovados',
    },
    chart: { clicks: 'Cliques', engagement: 'Engajamento', postCount: 'Posts', period7d: '7 dias', period30d: '30 dias', period90d: '90 dias' },
    heatmap: { title: 'Melhores Horários', peakLabel: 'Pico' },
    bestOf: {
      topThumbnails: 'Melhores Thumbnails por CTR',
      topTitles: 'Melhores Títulos por CTR',
      topPosts: 'Melhores Posts por Cliques',
      winner: 'Vencedor',
      improvement: '{pct}% de melhoria',
      autoApplied: 'Aplicado automaticamente',
    },
    health: {
      healthy: 'Saudável',
      expired: 'Expirado',
      warning: 'Atenção',
      tokenExpiry: 'Expira em {days} dias',
      neverExpires: 'Nunca expira',
      quotaLabel: 'Cota YouTube',
      deliveryRate: 'Taxa de Entrega',
      recentErrors: 'Erros Recentes',
      reconnect: 'Reconectar',
    },
    empty: 'Métricas precisam de dados',
    emptyCta: 'Crie seu primeiro post',
  },
  accounts: {
    title: 'Contas Sociais',
    tabs: { connections: 'Conexões', automations: 'Automações' },
    connections: {
      addAccount: '+ Adicionar conta',
      manage: 'Gerenciar',
      reconnect: 'Reconectar',
      disconnect: 'Desconectar',
      disconnectConfirm: 'Desconectar esta conta? Posts agendados não serão publicados.',
      tokenOk: 'Conectado',
      tokenExpired: 'Token expirado',
      tokenNever: 'Nunca expira',
      quotaLabel: '{used} / {limit} unidades hoje',
      empty: 'Nenhuma conta conectada',
    },
    automations: {
      blogPublished: 'Blog Publicado → Rascunho Social',
      videoPublished: 'Vídeo Publicado → Cross-post + Primeiro Comentário',
      newsletterSent: 'Newsletter Enviada → Rascunho Social',
      evergreenTimer: 'Timer Evergreen → Recompartilhar da Fila',
      tokenExpiring: 'Token Expirando (<7d) → Alerta + Pausar',
      postFailed: 'Post Falhou → Auto-retry (3×)',
      abTestComplete: 'Teste A/B Completo → Aplicar Vencedor',
      playlistUpdated: 'Playlist Atualizada → Rascunho Social',
      modeLabel: 'Modo',
      modeDraft: 'Criar Rascunho',
      modeAutoPublish: 'Auto-publicar',
      configure: 'Configurar',
    },
    config: {
      title: 'Configurar Automação',
      triggerLabel: 'Gatilho',
      actionMode: 'Modo de Ação',
      targetPlatforms: 'Plataformas Alvo',
      contentTemplate: 'Template de Conteúdo',
      scheduling: 'Agendamento',
      smartSchedule: 'Horário Inteligente',
      fixedDelay: 'Atraso fixo',
      aiEnhance: 'Aprimoramento por IA',
      recentActivity: 'Atividade Recente',
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir Regra',
    },
  },
  notifications: {
    title: 'Notificações',
    markAllRead: 'Marcar tudo como lido',
    deliveryFailed: 'Entrega falhou no {platform}',
    tokenExpiring: 'Token do {platform} expira em {days} dias',
    aiDraftsReady: '{count} rascunhos de IA prontos para revisão',
    abTestComplete: 'Teste A/B completo: {winner} venceu',
    publishedSuccess: 'Publicado em {platforms}',
    empty: 'Sem notificações',
  },
  status: {
    draft: 'Rascunho',
    scheduled: 'Agendado',
    publishing: 'Publicando',
    completed: 'Publicado',
    partial_failure: 'Falha Parcial',
    failed: 'Falhou',
    cancelled: 'Cancelado',
    pending: 'Pendente',
    published: 'Publicado',
    retrying: 'Retentando',
    skipped: 'Ignorado',
  },
  platforms: {
    youtube: 'YouTube',
    facebook: 'Facebook',
    instagram: 'Instagram',
    bluesky: 'Bluesky',
  },
}
```

- [ ] **Step 4: Create index.ts**

```ts
// apps/web/src/app/cms/(authed)/social/_i18n/index.ts
import type { SocialStrings } from './types'
import { en } from './en'
import { ptBR } from './pt-BR'

export type { SocialStrings }

export function getSocialStrings(locale: 'en' | 'pt-BR'): SocialStrings {
  return locale === 'pt-BR' ? ptBR : en
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/_i18n/
git commit -m "feat(social): add i18n foundation — types + en + pt-BR for all 22 screens"
```

---

### Task 3: Shared UI Components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/social/social-status-badge.tsx`
- Create: `apps/web/src/app/cms/(authed)/_shared/social/platform-icon.tsx`
- Create: `apps/web/src/app/cms/(authed)/_shared/social/platform-selector.tsx`
- Test: `apps/web/test/cms/social-status-badge.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-status-badge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { PlatformIcon } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'

describe('SocialStatusBadge', () => {
  it('renders Published in green', () => {
    render(<SocialStatusBadge status="completed" label="Published" />)
    const badge = screen.getByText('Published')
    expect(badge.className).toContain('green')
  })

  it('renders Scheduled in blue', () => {
    render(<SocialStatusBadge status="scheduled" label="Scheduled" />)
    const badge = screen.getByText('Scheduled')
    expect(badge.className).toContain('blue')
  })

  it('renders Failed in red', () => {
    render(<SocialStatusBadge status="failed" label="Failed" />)
    const badge = screen.getByText('Failed')
    expect(badge.className).toContain('red')
  })

  it('renders Draft in yellow', () => {
    render(<SocialStatusBadge status="draft" label="Draft" />)
    const badge = screen.getByText('Draft')
    expect(badge.className).toContain('yellow')
  })
})

describe('PlatformIcon', () => {
  it('renders YouTube icon', () => {
    render(<PlatformIcon provider="youtube" />)
    expect(screen.getByTitle('YouTube')).toBeDefined()
  })

  it('renders Bluesky icon', () => {
    render(<PlatformIcon provider="bluesky" />)
    expect(screen.getByTitle('Bluesky')).toBeDefined()
  })
})

describe('PlatformSelector', () => {
  it('renders all 4 platform chips', () => {
    render(
      <PlatformSelector
        selected={['facebook', 'instagram']}
        onChange={() => {}}
        connections={[
          { provider: 'youtube', account_name: 'Ch1' },
          { provider: 'facebook', account_name: 'Page1' },
          { provider: 'instagram', account_name: '@ig' },
          { provider: 'bluesky', account_name: '@bs' },
        ]}
      />
    )
    expect(screen.getByText('YouTube')).toBeDefined()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('highlights selected platforms', () => {
    render(
      <PlatformSelector
        selected={['facebook']}
        onChange={() => {}}
        connections={[{ provider: 'facebook', account_name: 'P' }]}
      />
    )
    const fb = screen.getByText('Facebook').closest('button')!
    expect(fb.className).toContain('ring')
  })
})
```

- [ ] **Step 2: Run test to verify fails**

Run: `cd apps/web && npx vitest run test/cms/social-status-badge.test.tsx`
Expected: FAIL — files don't exist yet.

- [ ] **Step 3: Create social-status-badge.tsx**

```tsx
// apps/web/src/app/cms/(authed)/_shared/social/social-status-badge.tsx
import type { PostStatus, DeliveryStatus } from '@tn-figueiredo/social'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/15 text-yellow-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  publishing: 'bg-blue-500/15 text-blue-400 animate-pulse',
  completed: 'bg-green-500/15 text-green-400',
  published: 'bg-green-500/15 text-green-400',
  partial_failure: 'bg-orange-500/15 text-orange-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-gray-500/15 text-gray-400',
  pending: 'bg-gray-500/15 text-gray-400',
  retrying: 'bg-orange-500/15 text-orange-400 animate-pulse',
  skipped: 'bg-gray-500/15 text-gray-400',
  queued: 'bg-purple-500/15 text-purple-400',
}

interface SocialStatusBadgeProps {
  status: PostStatus | DeliveryStatus | 'queued'
  label: string
  className?: string
}

export function SocialStatusBadge({ status, label, className = '' }: SocialStatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors} ${className}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 4: Create platform-icon.tsx**

```tsx
// apps/web/src/app/cms/(authed)/_shared/social/platform-icon.tsx
import type { Provider } from '@tn-figueiredo/social'

const ICONS: Record<Provider, { emoji: string; color: string }> = {
  youtube: { emoji: '🎬', color: 'text-red-500' },
  facebook: { emoji: '📘', color: 'text-blue-600' },
  instagram: { emoji: '📷', color: 'text-pink-500' },
  bluesky: { emoji: '🦋', color: 'text-sky-500' },
}

interface PlatformIconProps {
  provider: Provider
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlatformIcon({ provider, size = 'md', className = '' }: PlatformIconProps) {
  const icon = ICONS[provider]
  const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base'
  return (
    <span className={`${sizeClass} ${className}`} title={provider.charAt(0).toUpperCase() + provider.slice(1)} role="img">
      {icon.emoji}
    </span>
  )
}

export function platformLabel(provider: Provider): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}
```

- [ ] **Step 5: Create platform-selector.tsx**

```tsx
// apps/web/src/app/cms/(authed)/_shared/social/platform-selector.tsx
'use client'

import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from './platform-icon'

interface MinimalConnection {
  provider: Provider
  account_name: string | null
}

interface PlatformSelectorProps {
  selected: Provider[]
  onChange: (providers: Provider[]) => void
  connections: MinimalConnection[]
  disabled?: Provider[]
  disabledReason?: Record<string, string>
}

export function PlatformSelector({
  selected,
  onChange,
  connections,
  disabled = [],
  disabledReason = {},
}: PlatformSelectorProps) {
  function toggle(provider: Provider) {
    if (disabled.includes(provider)) return
    if (selected.includes(provider)) {
      onChange(selected.filter(p => p !== provider))
    } else {
      onChange([...selected, provider])
    }
  }

  const providers = [...new Set(connections.map(c => c.provider))]

  return (
    <div className="flex flex-wrap gap-2">
      {providers.map(provider => {
        const isSelected = selected.includes(provider)
        const isDisabled = disabled.includes(provider)
        return (
          <button
            key={provider}
            type="button"
            onClick={() => toggle(provider)}
            disabled={isDisabled}
            title={isDisabled ? disabledReason[provider] : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors
              ${isSelected ? 'bg-cms-accent/15 text-cms-accent ring-1 ring-cms-accent/30' : 'bg-cms-surface text-cms-text-muted hover:bg-cms-surface-hover'}
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <PlatformIcon provider={provider} size="sm" />
            {platformLabel(provider)}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-status-badge.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/social/ apps/web/test/cms/social-status-badge.test.tsx
git commit -m "feat(social): add shared components — status badge, platform icon, platform selector"
```

---

## Phase 2: Core Pages

### Task 4: Accounts — Connections Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/accounts/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/accounts/_components/connections-grid.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/accounts/_components/platform-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/accounts/_components/oauth-button.tsx`
- Test: `apps/web/test/cms/social-accounts.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-accounts.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

const mockGetConnections = vi.fn()
const mockDisconnectSocial = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  getConnections: (...args: unknown[]) => mockGetConnections(...args),
  disconnectSocial: (...args: unknown[]) => mockDisconnectSocial(...args),
}))

import { ConnectionsGrid } from '@/app/cms/(authed)/social/accounts/_components/connections-grid'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockConnections = [
  { id: 'c1', provider: 'youtube', account_id: 'ch1', account_name: 'My Channel', token_expires_at: '2026-06-01T00:00:00Z', scopes: ['youtube.upload'], metadata: {}, connected_at: '2026-05-01T00:00:00Z', revoked_at: null },
  { id: 'c2', provider: 'facebook', account_id: 'page1', account_name: 'My Page', token_expires_at: null, scopes: ['pages_manage_posts'], metadata: {}, connected_at: '2026-05-02T00:00:00Z', revoked_at: null },
]

function renderGrid(overrides: Record<string, unknown> = {}) {
  const props = {
    connections: mockConnections,
    siteId: 'site-1',
    strings: en,
    ...overrides,
  }
  return render(<ConnectionsGrid {...props} />)
}

describe('ConnectionsGrid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders platform cards for connected accounts', () => {
    renderGrid()
    expect(screen.getByText('My Channel')).toBeDefined()
    expect(screen.getByText('My Page')).toBeDefined()
  })

  it('shows "Connected" status for active tokens', () => {
    renderGrid()
    expect(screen.getAllByText(en.accounts.connections.tokenOk).length).toBeGreaterThan(0)
  })

  it('shows all 4 platform sections', () => {
    renderGrid()
    expect(screen.getByText('YouTube')).toBeDefined()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('shows Add account button for platforms without connections', () => {
    renderGrid()
    const addButtons = screen.getAllByText(en.accounts.connections.addAccount)
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('shows disconnect confirmation on button click', async () => {
    mockDisconnectSocial.mockResolvedValue({ ok: true })
    renderGrid()
    const manageButtons = screen.getAllByText(en.accounts.connections.manage)
    fireEvent.click(manageButtons[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.connections.disconnect)).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: Run test to verify fails**

Run: `cd apps/web && npx vitest run test/cms/social-accounts.test.tsx`
Expected: FAIL — components don't exist yet.

- [ ] **Step 3: Create oauth-button.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/accounts/_components/oauth-button.tsx
'use client'

import { useCallback, useTransition } from 'react'
import type { Provider } from '@tn-figueiredo/social'

interface OauthButtonProps {
  provider: Provider
  label: string
  className?: string
}

const OAUTH_PROVIDERS: Record<string, string> = {
  youtube: 'google',
  facebook: 'meta',
  instagram: 'meta',
  bluesky: 'bluesky',
}

export function OauthButton({ provider, label, className = '' }: OauthButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleConnect = useCallback(() => {
    startTransition(() => {
      const oauthProvider = OAUTH_PROVIDERS[provider]
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        `/api/social/oauth/${oauthProvider}`,
        'social-oauth',
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'social-oauth-result') {
          window.removeEventListener('message', onMessage)
          popup?.close()
          if (event.data.success) {
            window.location.reload()
          }
        }
      }
      window.addEventListener('message', onMessage)
    })
  }, [provider])

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isPending}
      className={`inline-flex items-center gap-2 rounded-md bg-cms-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50 ${className}`}
    >
      {isPending ? 'Connecting…' : label}
    </button>
  )
}
```

- [ ] **Step 4: Create platform-card.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/accounts/_components/platform-card.tsx
'use client'

import { useState, useTransition } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OauthButton } from './oauth-button'
import { disconnectSocial } from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'

interface SafeConnection {
  id: string
  provider: Provider
  account_id: string
  account_name: string | null
  token_expires_at: string | null
  connected_at: string
  revoked_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
}

interface PlatformCardProps {
  provider: Provider
  connections: SafeConnection[]
  strings: SocialStrings
}

export function PlatformCard({ provider, connections, strings: t }: PlatformCardProps) {
  const [showManage, setShowManage] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDisconnect(connectionId: string) {
    if (!confirm(t.accounts.connections.disconnectConfirm)) return
    startTransition(async () => {
      await disconnectSocial(connectionId)
      window.location.reload()
    })
  }

  function tokenStatus(conn: SafeConnection): { label: string; color: string } {
    if (!conn.token_expires_at) return { label: t.accounts.connections.tokenNever, color: 'text-gray-400' }
    const expires = new Date(conn.token_expires_at)
    if (expires < new Date()) return { label: t.accounts.connections.tokenExpired, color: 'text-red-400' }
    return { label: t.accounts.connections.tokenOk, color: 'text-green-400' }
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformIcon provider={provider} size="lg" />
          <span className="font-semibold text-cms-text">{platformLabel(provider)}</span>
        </div>
        {connections.length > 0 && (
          <button
            type="button"
            onClick={() => setShowManage(!showManage)}
            className="text-sm text-cms-accent hover:underline"
          >
            {t.accounts.connections.manage}
          </button>
        )}
      </div>

      {connections.length === 0 ? (
        <div className="py-4 text-center">
          <OauthButton provider={provider} label={t.accounts.connections.addAccount} />
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map(conn => {
            const status = tokenStatus(conn)
            return (
              <div key={conn.id} className="flex items-center justify-between rounded-md bg-cms-bg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-cms-text">{conn.account_name ?? conn.account_id}</p>
                  <p className={`text-xs ${status.color}`}>{status.label}</p>
                </div>
                {showManage && (
                  <div className="flex gap-2">
                    {status.color === 'text-red-400' && (
                      <OauthButton provider={provider} label={t.accounts.connections.reconnect} className="text-xs px-2 py-1" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleDisconnect(conn.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {t.accounts.connections.disconnect}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {showManage && (
            <OauthButton provider={provider} label={t.accounts.connections.addAccount} className="w-full justify-center" />
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create connections-grid.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/accounts/_components/connections-grid.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { PROVIDERS, type Provider } from '@tn-figueiredo/social'
import { PlatformCard } from './platform-card'
import type { SocialStrings } from '../../_i18n/types'

interface SafeConnection {
  id: string
  provider: Provider
  account_id: string
  account_name: string | null
  token_expires_at: string | null
  connected_at: string
  revoked_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
}

interface ConnectionsGridProps {
  connections: SafeConnection[]
  siteId: string
  strings: SocialStrings
}

export function ConnectionsGrid({ connections, siteId, strings: t }: ConnectionsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {PROVIDERS.map(provider => (
        <PlatformCard
          key={provider}
          provider={provider}
          connections={connections.filter(c => c.provider === provider)}
          strings={t}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create accounts page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/accounts/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getConnections } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { ConnectionsGrid } from './_components/connections-grid'

export const dynamic = 'force-dynamic'

export default async function SocialAccountsPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)

  const result = await getConnections(ctx.siteId)
  const connections = result.ok ? result.data : []

  return (
    <>
      <CmsTopbar title={t.accounts.title} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          <a href="/cms/social/accounts" className="px-3 py-1.5 text-sm font-medium text-cms-accent border-b-2 border-cms-accent">
            {t.accounts.tabs.connections}
          </a>
          <a href="/cms/social/accounts?tab=automations" className="px-3 py-1.5 text-sm font-medium text-cms-text-muted hover:text-cms-text">
            {t.accounts.tabs.automations}
          </a>
        </div>
        <ConnectionsGrid connections={connections} siteId={ctx.siteId} strings={t} />
      </div>
    </>
  )
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-accounts.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/accounts/ apps/web/test/cms/social-accounts.test.tsx
git commit -m "feat(social): Accounts page — connections grid, platform cards, OAuth popup"
```

---

### Task 5: Accounts — Automations Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/accounts/_components/automations-list.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/accounts/_components/automation-config-modal.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/accounts/page.tsx` (add tab routing)

- [ ] **Step 1: Create automations-list.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/accounts/_components/automations-list.tsx
'use client'

import { useState, useTransition } from 'react'
import type { SocialStrings } from '../../_i18n/types'
import { AutomationConfigModal } from './automation-config-modal'

interface AutomationRule {
  id: string
  label: string
  enabled: boolean
  mode: 'draft' | 'auto_publish'
}

const DEFAULT_RULES: AutomationRule[] = [
  { id: 'blog_published', label: 'blogPublished', enabled: false, mode: 'draft' },
  { id: 'video_published', label: 'videoPublished', enabled: false, mode: 'auto_publish' },
  { id: 'newsletter_sent', label: 'newsletterSent', enabled: false, mode: 'draft' },
  { id: 'evergreen_timer', label: 'evergreenTimer', enabled: false, mode: 'draft' },
  { id: 'token_expiring', label: 'tokenExpiring', enabled: true, mode: 'draft' },
  { id: 'post_failed', label: 'postFailed', enabled: true, mode: 'auto_publish' },
  { id: 'ab_test_complete', label: 'abTestComplete', enabled: false, mode: 'auto_publish' },
  { id: 'playlist_updated', label: 'playlistUpdated', enabled: false, mode: 'draft' },
]

interface AutomationsListProps {
  strings: SocialStrings
}

export function AutomationsList({ strings: t }: AutomationsListProps) {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [configRule, setConfigRule] = useState<AutomationRule | null>(null)
  const [, startTransition] = useTransition()

  function handleToggle(id: string) {
    startTransition(() => {
      setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
    })
  }

  return (
    <>
      <div className="space-y-2">
        {rules.map(rule => {
          const label = t.accounts.automations[rule.label as keyof typeof t.accounts.automations] as string
          return (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => handleToggle(rule.id)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${rule.enabled ? 'bg-cms-accent' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-cms-text">{label}</p>
                  <p className="text-xs text-cms-text-muted">
                    {t.accounts.automations.modeLabel}: {rule.mode === 'draft' ? t.accounts.automations.modeDraft : t.accounts.automations.modeAutoPublish}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigRule(rule)}
                className="text-sm text-cms-accent hover:underline"
              >
                {t.accounts.automations.configure}
              </button>
            </div>
          )
        })}
      </div>

      {configRule && (
        <AutomationConfigModal
          rule={configRule}
          strings={t}
          onClose={() => setConfigRule(null)}
          onSave={(updated) => {
            setRules(prev => prev.map(r => r.id === updated.id ? updated : r))
            setConfigRule(null)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Create automation-config-modal.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/accounts/_components/automation-config-modal.tsx
'use client'

import { useState } from 'react'
import type { SocialStrings } from '../../_i18n/types'

interface AutomationRule {
  id: string
  label: string
  enabled: boolean
  mode: 'draft' | 'auto_publish'
}

interface AutomationConfigModalProps {
  rule: AutomationRule
  strings: SocialStrings
  onClose: () => void
  onSave: (rule: AutomationRule) => void
}

export function AutomationConfigModal({ rule, strings: t, onClose, onSave }: AutomationConfigModalProps) {
  const [mode, setMode] = useState(rule.mode)
  const [template, setTemplate] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-cms-surface border border-cms-border p-6 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-label={t.accounts.config.title}>
        <h2 className="text-lg font-semibold text-cms-text">{t.accounts.config.title}</h2>

        <div>
          <label className="text-sm font-medium text-cms-text-muted">{t.accounts.config.triggerLabel}</label>
          <p className="text-sm text-cms-text">{t.accounts.automations[rule.label as keyof typeof t.accounts.automations] as string}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-cms-text-muted">{t.accounts.config.actionMode}</label>
          <div className="flex gap-3 mt-1">
            <label className="flex items-center gap-2 text-sm text-cms-text cursor-pointer">
              <input type="radio" checked={mode === 'draft'} onChange={() => setMode('draft')} className="accent-cms-accent" />
              {t.accounts.automations.modeDraft}
            </label>
            <label className="flex items-center gap-2 text-sm text-cms-text cursor-pointer">
              <input type="radio" checked={mode === 'auto_publish'} onChange={() => setMode('auto_publish')} className="accent-cms-accent" />
              {t.accounts.automations.modeAutoPublish}
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-cms-text-muted">{t.accounts.config.contentTemplate}</label>
          <textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            rows={3}
            placeholder="{title}\n{url}\n{hashtags}"
            className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim"
          />
          <p className="mt-1 text-xs text-cms-text-dim">
            Variables: {'{title}'}, {'{excerpt}'}, {'{short_link}'}, {'{cover_image}'}, {'{author}'}, {'{category}'}, {'{tags}'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-cms-text-muted hover:text-cms-text">
            {t.accounts.config.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...rule, mode })}
            className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
          >
            {t.accounts.config.save}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update accounts page.tsx to support tab routing**

Replace `apps/web/src/app/cms/(authed)/social/accounts/page.tsx`:

```tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getConnections } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { ConnectionsGrid } from './_components/connections-grid'
import { AutomationsList } from './_components/automations-list'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function SocialAccountsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'connections'

  const result = await getConnections(ctx.siteId)
  const connections = result.ok ? result.data : []

  return (
    <>
      <CmsTopbar title={t.accounts.title} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          <a
            href="/cms/social/accounts"
            className={`px-3 py-1.5 text-sm font-medium ${tab === 'connections' ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {t.accounts.tabs.connections}
          </a>
          <a
            href="/cms/social/accounts?tab=automations"
            className={`px-3 py-1.5 text-sm font-medium ${tab === 'automations' ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {t.accounts.tabs.automations}
          </a>
        </div>
        {tab === 'connections' && (
          <ConnectionsGrid connections={connections} siteId={ctx.siteId} strings={t} />
        )}
        {tab === 'automations' && (
          <AutomationsList strings={t} />
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-accounts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/accounts/
git commit -m "feat(social): Automations tab — 8 toggle rules with config modal"
```

---

### Task 6: Posts — Feed View

**Files:**
- Replace: `apps/web/src/app/cms/(authed)/social/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/_components/posts-feed.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/_components/post-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/_components/bulk-actions-bar.tsx`
- Test: `apps/web/test/cms/social-posts-feed.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-posts-feed.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

const mockCancel = vi.fn()
const mockDelete = vi.fn()
const mockRetry = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  cancelSocialPost: (...args: unknown[]) => mockCancel(...args),
  deleteSocialPost: (...args: unknown[]) => mockDelete(...args),
  retrySocialDelivery: (...args: unknown[]) => mockRetry(...args),
}))

import { PostsFeed } from '@/app/cms/(authed)/social/_components/posts-feed'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockPosts = [
  {
    id: 'p1', site_id: 's1', created_by: 'u1', type: 'link' as const, status: 'completed' as const,
    scheduled_at: '2026-05-10T14:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: '2026-05-10T14:01:00Z',
    content: { title: 'Test Post', url: 'https://example.com' }, template_id: null, idempotency_key: 'k1',
    created_at: '2026-05-10T12:00:00Z', updated_at: '2026-05-10T14:01:00Z',
  },
  {
    id: 'p2', site_id: 's1', created_by: 'u1', type: 'text' as const, status: 'scheduled' as const,
    scheduled_at: '2026-05-15T10:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: null,
    content: { description: 'Upcoming post' }, template_id: null, idempotency_key: 'k2',
    created_at: '2026-05-09T12:00:00Z', updated_at: '2026-05-09T12:00:00Z',
  },
  {
    id: 'p3', site_id: 's1', created_by: 'u1', type: 'text' as const, status: 'failed' as const,
    scheduled_at: '2026-05-08T10:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: null,
    content: { description: 'Failed post' }, template_id: null, idempotency_key: 'k3',
    created_at: '2026-05-08T10:00:00Z', updated_at: '2026-05-08T10:00:00Z',
  },
]

function renderFeed(overrides: Record<string, unknown> = {}) {
  return render(<PostsFeed posts={mockPosts} siteId="s1" strings={en} {...overrides} />)
}

describe('PostsFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders post cards', () => {
    renderFeed()
    expect(screen.getByText('Test Post')).toBeDefined()
    expect(screen.getByText('Upcoming post')).toBeDefined()
  })

  it('shows status badges', () => {
    renderFeed()
    expect(screen.getByText('Published')).toBeDefined()
    expect(screen.getByText('Scheduled')).toBeDefined()
    expect(screen.getByText('Failed')).toBeDefined()
  })

  it('shows "New Post" button', () => {
    renderFeed()
    expect(screen.getByText(en.posts.newPost)).toBeDefined()
  })

  it('renders filter tabs', () => {
    renderFeed()
    expect(screen.getByText(en.posts.filters.all)).toBeDefined()
    expect(screen.getByText(en.posts.filters.published)).toBeDefined()
    expect(screen.getByText(en.posts.filters.scheduled)).toBeDefined()
  })

  it('shows empty state when no posts', () => {
    render(<PostsFeed posts={[]} siteId="s1" strings={en} />)
    expect(screen.getByText(en.posts.emptyFeed)).toBeDefined()
  })

  it('shows bulk action bar when posts are selected', () => {
    renderFeed()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(screen.getByText(en.posts.bulk.delete)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify fails**

Run: `cd apps/web && npx vitest run test/cms/social-posts-feed.test.tsx`
Expected: FAIL — components don't exist.

- [ ] **Step 3: Create post-card.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/post-card.tsx
'use client'

import Link from 'next/link'
import type { SocialPost } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostCardProps {
  post: SocialPost
  strings: SocialStrings
  selected: boolean
  onSelect: (id: string) => void
}

export function PostCard({ post, strings: t, selected, onSelect }: PostCardProps) {
  const contentPreview = post.content.title ?? post.content.description ?? '(no content)'
  const statusLabel = t.status[post.status as keyof typeof t.status] ?? post.status
  const dateStr = post.published_at ?? post.scheduled_at ?? post.created_at

  return (
    <div className={`flex items-start gap-3 rounded-lg border bg-cms-surface p-4 transition-colors ${selected ? 'border-cms-accent/50 bg-cms-accent/5' : 'border-cms-border'}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(post.id)}
        className="mt-1 accent-cms-accent"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SocialStatusBadge status={post.status} label={statusLabel} />
          <span className="text-xs text-cms-text-dim">{post.type}</span>
        </div>

        <Link href={`/cms/social/${post.id}`} className="text-sm font-medium text-cms-text hover:text-cms-accent line-clamp-2">
          {contentPreview}
        </Link>

        {post.content.url && (
          <p className="text-xs text-cms-text-muted mt-0.5 truncate">{post.content.url}</p>
        )}

        <p className="text-xs text-cms-text-dim mt-1">
          {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create bulk-actions-bar.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/bulk-actions-bar.tsx
'use client'

import { useTransition } from 'react'
import { cancelSocialPost, deleteSocialPost } from '@/lib/social/actions'
import type { SocialStrings } from '../_i18n/types'

interface BulkActionsBarProps {
  selectedIds: string[]
  strings: SocialStrings
  onDone: () => void
}

export function BulkActionsBar({ selectedIds, strings: t, onDone }: BulkActionsBarProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(t.posts.bulk.deleteConfirm)) return
    startTransition(async () => {
      await Promise.all(selectedIds.map(id => deleteSocialPost(id)))
      onDone()
    })
  }

  function handleRetry() {
    startTransition(async () => {
      onDone()
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 shadow-lg">
      <span className="text-sm text-cms-text-muted">{selectedIds.length} selected</span>
      <div className="flex-1" />
      <button type="button" onClick={handleRetry} disabled={isPending} className="text-sm text-cms-accent hover:underline disabled:opacity-50">
        {t.posts.bulk.retry}
      </button>
      <button type="button" onClick={handleDelete} disabled={isPending} className="text-sm text-red-400 hover:underline disabled:opacity-50">
        {t.posts.bulk.delete}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create posts-feed.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/posts-feed.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { SocialPost, PostStatus } from '@tn-figueiredo/social'
import { PostCard } from './post-card'
import { BulkActionsBar } from './bulk-actions-bar'
import type { SocialStrings } from '../_i18n/types'

interface PostsFeedProps {
  posts: SocialPost[]
  siteId: string
  strings: SocialStrings
}

const FILTER_STATUSES: (PostStatus | 'all')[] = ['all', 'completed', 'scheduled', 'failed', 'draft', 'cancelled']

export function PostsFeed({ posts, siteId, strings: t }: PostsFeedProps) {
  const [filter, setFilter] = useState<PostStatus | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (filter === 'all') return posts
    return posts.filter(p => p.status === filter)
  }, [posts, filter])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function filterLabel(status: PostStatus | 'all'): string {
    if (status === 'all') return t.posts.filters.all
    return t.posts.filters[status as keyof typeof t.posts.filters] ?? status
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-cms-text-muted">{t.posts.emptyFeed}</p>
        <Link href="/cms/social/new" className="mt-4 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover">
          {t.posts.emptyFeedCta}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_STATUSES.map(status => (
          <button
            key={status}
            type="button"
            onClick={() => { setFilter(status); setSelected(new Set()) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${filter === status ? 'bg-cms-accent/15 text-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {filterLabel(status)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(post => (
          <PostCard
            key={post.id}
            post={post}
            strings={t}
            selected={selected.has(post.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      <BulkActionsBar
        selectedIds={[...selected]}
        strings={t}
        onDone={() => { setSelected(new Set()); window.location.reload() }}
      />
    </div>
  )
}
```

- [ ] **Step 6: Replace social/page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listSocialPosts } from '@/lib/social/actions'
import { getSocialStrings } from './_i18n'
import { PostsFeed } from './_components/posts-feed'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function SocialPostsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'feed'

  const result = await listSocialPosts(ctx.siteId)
  const posts = result.ok ? result.data : []

  return (
    <>
      <CmsTopbar title={t.posts.title}>
        <Link href="/cms/social/new" className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover">
          {t.posts.newPost}
        </Link>
      </CmsTopbar>
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          {(['feed', 'calendar', 'queue', 'drafts'] as const).map(tabId => (
            <a
              key={tabId}
              href={tabId === 'feed' ? '/cms/social' : `/cms/social?tab=${tabId}`}
              className={`px-3 py-1.5 text-sm font-medium ${tab === tabId ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
            >
              {t.posts.tabs[tabId]}
            </a>
          ))}
        </div>

        {tab === 'feed' && <PostsFeed posts={posts} siteId={ctx.siteId} strings={t} />}
        {tab === 'calendar' && <p className="text-cms-text-muted">{t.posts.emptyCalendar}</p>}
        {tab === 'queue' && <p className="text-cms-text-muted">{t.posts.emptyQueue}</p>}
        {tab === 'drafts' && <p className="text-cms-text-muted">{t.posts.emptyDrafts}</p>}
      </div>
    </>
  )
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-posts-feed.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/page.tsx apps/web/src/app/cms/(authed)/social/_components/ apps/web/test/cms/social-posts-feed.test.tsx
git commit -m "feat(social): Posts hub — feed view with cards, filters, bulk actions, empty states"
```

---

### Task 7: Post Detail Page

**Files:**
- Replace: `apps/web/src/app/cms/(authed)/social/[id]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/[id]/_components/post-detail.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/[id]/_components/delivery-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/[id]/_components/post-timeline.tsx`
- Test: `apps/web/test/cms/social-post-detail.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-post-detail.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

const mockRetry = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  retrySocialDelivery: (...args: unknown[]) => mockRetry(...args),
  deleteSocialPost: (...args: unknown[]) => mockDelete(...args),
}))

vi.mock('@/lib/social/realtime', () => ({
  useSocialDeliveries: vi.fn(() => []),
  useSocialPostStatus: vi.fn(() => 'completed'),
}))

import { PostDetail } from '@/app/cms/(authed)/social/[id]/_components/post-detail'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockPost = {
  id: 'p1', site_id: 's1', created_by: 'u1', type: 'link' as const, status: 'completed' as const,
  scheduled_at: '2026-05-10T14:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: '2026-05-10T14:01:00Z',
  content: { title: 'Test Post', url: 'https://example.com', description: 'A test' },
  template_id: null, idempotency_key: 'k1',
  created_at: '2026-05-10T12:00:00Z', updated_at: '2026-05-10T14:01:00Z',
  deliveries: [
    { id: 'd1', post_id: 'p1', connection_id: 'c1', provider: 'facebook' as const, status: 'published' as const, platform_post_id: 'fb-123', platform_url: 'https://facebook.com/post/123', content_override: null, attempt: 1, max_attempts: 3, last_error: null, error_type: null, published_at: '2026-05-10T14:01:00Z', created_at: '2026-05-10T14:00:00Z' },
    { id: 'd2', post_id: 'p1', connection_id: 'c2', provider: 'bluesky' as const, status: 'failed' as const, platform_post_id: null, platform_url: null, content_override: null, attempt: 3, max_attempts: 3, last_error: 'Rate limit exceeded', error_type: 'transient' as const, published_at: null, created_at: '2026-05-10T14:00:00Z' },
  ],
}

function renderDetail(overrides: Record<string, unknown> = {}) {
  return render(<PostDetail post={mockPost} strings={en} {...overrides} />)
}

describe('PostDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders post content', () => {
    renderDetail()
    expect(screen.getByText('Test Post')).toBeDefined()
    expect(screen.getByText('https://example.com')).toBeDefined()
  })

  it('shows delivery cards per platform', () => {
    renderDetail()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('shows Published status for successful delivery', () => {
    renderDetail()
    expect(screen.getByText('Published')).toBeDefined()
  })

  it('shows Failed status with error for failed delivery', () => {
    renderDetail()
    expect(screen.getByText('Failed')).toBeDefined()
    expect(screen.getByText('Rate limit exceeded')).toBeDefined()
  })

  it('shows Retry button for failed deliveries', () => {
    renderDetail()
    const retryButtons = screen.getAllByText(en.detail.retry)
    expect(retryButtons.length).toBeGreaterThan(0)
  })

  it('shows back link', () => {
    renderDetail()
    expect(screen.getByText(en.detail.back)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify fails**

Run: `cd apps/web && npx vitest run test/cms/social-post-detail.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create delivery-card.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/[id]/_components/delivery-card.tsx
'use client'

import { useTransition } from 'react'
import type { SocialDelivery } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { retrySocialDelivery } from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'

interface DeliveryCardProps {
  delivery: SocialDelivery
  strings: SocialStrings
}

export function DeliveryCard({ delivery, strings: t }: DeliveryCardProps) {
  const [isPending, startTransition] = useTransition()
  const statusLabel = t.status[delivery.status as keyof typeof t.status] ?? delivery.status

  function handleRetry() {
    startTransition(async () => {
      await retrySocialDelivery(delivery.id)
    })
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformIcon provider={delivery.provider} />
          <span className="font-medium text-cms-text">{platformLabel(delivery.provider)}</span>
        </div>
        <SocialStatusBadge status={delivery.status} label={statusLabel} />
      </div>

      {delivery.status === 'published' && delivery.platform_url && (
        <a href={delivery.platform_url} target="_blank" rel="noopener noreferrer" className="text-sm text-cms-accent hover:underline">
          {t.detail.viewOn.replace('{platform}', platformLabel(delivery.provider))} →
        </a>
      )}

      {delivery.status === 'failed' && (
        <div className="space-y-2">
          {delivery.last_error && (
            <p className="text-sm text-red-400">{delivery.last_error}</p>
          )}
          {delivery.error_type && (
            <span className="inline-block rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{delivery.error_type}</span>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleRetry} disabled={isPending} className="text-sm text-cms-accent hover:underline disabled:opacity-50">
              {t.detail.retry}
            </button>
          </div>
        </div>
      )}

      {delivery.attempt > 0 && (
        <p className="text-xs text-cms-text-dim">Attempt {delivery.attempt}/{delivery.max_attempts}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create post-timeline.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/[id]/_components/post-timeline.tsx
import type { SocialPost, SocialDelivery } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface PostTimelineProps {
  post: SocialPost
  deliveries: SocialDelivery[]
  strings: SocialStrings
}

interface TimelineEvent {
  time: string
  label: string
  color: string
}

export function PostTimeline({ post, deliveries, strings: t }: PostTimelineProps) {
  const events: TimelineEvent[] = [
    { time: post.created_at, label: 'Created', color: 'bg-gray-400' },
  ]

  if (post.scheduled_at) {
    events.push({ time: post.scheduled_at, label: 'Scheduled', color: 'bg-blue-400' })
  }

  for (const d of deliveries) {
    if (d.published_at) {
      events.push({ time: d.published_at, label: `Published on ${d.provider}`, color: 'bg-green-400' })
    }
    if (d.status === 'failed' && d.last_error) {
      events.push({ time: d.created_at, label: `Failed on ${d.provider}: ${d.last_error}`, color: 'bg-red-400' })
    }
  }

  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-cms-text mb-3">{t.detail.timeline}</h3>
      {events.map((event, i) => (
        <div key={i} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className={`h-2.5 w-2.5 rounded-full ${event.color}`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-cms-border" />}
          </div>
          <div className="-mt-0.5">
            <p className="text-sm text-cms-text">{event.label}</p>
            <p className="text-xs text-cms-text-dim">{new Date(event.time).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create post-detail.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/[id]/_components/post-detail.tsx
'use client'

import Link from 'next/link'
import type { SocialPost, SocialDelivery } from '@tn-figueiredo/social'
import { useSocialDeliveries, useSocialPostStatus } from '@/lib/social/realtime'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { DeliveryCard } from './delivery-card'
import { PostTimeline } from './post-timeline'
import type { SocialStrings } from '../../_i18n/types'

interface PostDetailProps {
  post: SocialPost & { deliveries: SocialDelivery[] }
  strings: SocialStrings
}

export function PostDetail({ post, strings: t }: PostDetailProps) {
  const liveDeliveries = useSocialDeliveries(post.id)
  const liveStatus = useSocialPostStatus(post.id)

  const deliveries = liveDeliveries.length > 0 ? liveDeliveries : post.deliveries
  const status = liveStatus ?? post.status
  const statusLabel = t.status[status as keyof typeof t.status] ?? status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/cms/social" className="text-sm text-cms-accent hover:underline">{t.detail.back}</Link>
        <div className="flex items-center gap-2">
          <SocialStatusBadge status={status} label={statusLabel} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {post.content.title && <h2 className="text-xl font-semibold text-cms-text">{post.content.title}</h2>}
          {post.content.description && <p className="text-sm text-cms-text-muted">{post.content.description}</p>}
          {post.content.url && (
            <a href={post.content.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cms-accent hover:underline block">
              {post.content.url}
            </a>
          )}
          {post.content.hashtags && post.content.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.content.hashtags.map(tag => (
                <span key={tag} className="rounded-full bg-cms-accent/10 px-2 py-0.5 text-xs text-cms-accent">{tag}</span>
              ))}
            </div>
          )}

          <div className="pt-4">
            <PostTimeline post={post} deliveries={deliveries} strings={t} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-cms-text">{t.detail.deliveryStatus}</h3>
          {deliveries.map(d => (
            <DeliveryCard key={d.id} delivery={d} strings={t} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Replace social/[id]/page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/[id]/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSocialPost } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { PostDetail } from './_components/post-detail'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SocialPostDetailPage({ params }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const { id } = await params

  const result = await getSocialPost(id)
  if (!result.ok) notFound()

  return (
    <>
      <CmsTopbar title={t.detail.title} />
      <div className="p-6">
        <PostDetail post={result.data} strings={t} />
      </div>
    </>
  )
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-post-detail.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/\[id\]/ apps/web/test/cms/social-post-detail.test.tsx
git commit -m "feat(social): Post Detail — delivery cards, timeline, Realtime wiring"
```

---

## Phase 3: Composer

### Task 8: Composer Shell + Text/Link Mode

**Files:**
- Replace: `apps/web/src/app/cms/(authed)/social/new/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/composer-editor.tsx`
- Test: `apps/web/test/cms/social-composer.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-composer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

const mockCreate = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  createSocialPost: (...args: unknown[]) => mockCreate(...args),
}))

import { ComposerShell } from '@/app/cms/(authed)/social/new/_components/composer-shell'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockConnections = [
  { provider: 'facebook' as const, account_name: 'My Page' },
  { provider: 'instagram' as const, account_name: '@me' },
  { provider: 'bluesky' as const, account_name: '@me.bsky' },
]

function renderComposer(overrides: Record<string, unknown> = {}) {
  return render(
    <ComposerShell
      connections={mockConnections}
      strings={en}
      initialMode="text"
      {...overrides}
    />
  )
}

describe('ComposerShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ ok: true, data: { id: 'new-1' } })
  })

  it('renders mode tabs', () => {
    renderComposer()
    expect(screen.getByText(en.composer.modes.text)).toBeDefined()
    expect(screen.getByText(en.composer.modes.image)).toBeDefined()
    expect(screen.getByText(en.composer.modes.video)).toBeDefined()
  })

  it('renders content textarea in text mode', () => {
    renderComposer()
    expect(screen.getByPlaceholderText(en.composer.editor.contentPlaceholder)).toBeDefined()
  })

  it('renders URL input', () => {
    renderComposer()
    expect(screen.getByPlaceholderText(en.composer.editor.urlPlaceholder)).toBeDefined()
  })

  it('renders platform selector with connected platforms', () => {
    renderComposer()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('renders schedule bar', () => {
    renderComposer()
    expect(screen.getByText(en.composer.schedule.now)).toBeDefined()
    expect(screen.getByText(en.composer.schedule.scheduled)).toBeDefined()
    expect(screen.getByText(en.composer.schedule.queue)).toBeDefined()
  })

  it('submits post on publish', async () => {
    renderComposer()
    const textarea = screen.getByPlaceholderText(en.composer.editor.contentPlaceholder)
    fireEvent.change(textarea, { target: { value: 'Hello world!' } })
    fireEvent.click(screen.getByText('Facebook'))
    fireEvent.click(screen.getByText(en.composer.schedule.publish))
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce()
    })
  })
})
```

- [ ] **Step 2: Run test to verify fails**

Run: `cd apps/web && npx vitest run test/cms/social-composer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create composer-editor.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/composer-editor.tsx
'use client'

import { PLATFORM_LIMITS, type Provider } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface ComposerEditorProps {
  content: string
  url: string
  hashtags: string[]
  selectedPlatforms: Provider[]
  onContentChange: (v: string) => void
  onUrlChange: (v: string) => void
  onHashtagsChange: (v: string[]) => void
  strings: SocialStrings
}

export function ComposerEditor({
  content, url, hashtags, selectedPlatforms,
  onContentChange, onUrlChange, onHashtagsChange,
  strings: t,
}: ComposerEditorProps) {
  const minLimit = selectedPlatforms.reduce((min, p) => {
    const limit = p === 'youtube' ? Infinity
      : p === 'facebook' ? PLATFORM_LIMITS.facebook.text
      : p === 'instagram' ? PLATFORM_LIMITS.instagram.caption
      : PLATFORM_LIMITS.bluesky.text
    return Math.min(min, limit)
  }, Infinity)

  const charWarning = minLimit !== Infinity && content.length > minLimit

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.editor.contentLabel}</label>
        <textarea
          value={content}
          onChange={e => onContentChange(e.target.value)}
          placeholder={t.composer.editor.contentPlaceholder}
          rows={6}
          className={`mt-1 w-full rounded-md border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim ${charWarning ? 'border-red-500' : 'border-cms-border'}`}
        />
        {minLimit !== Infinity && (
          <p className={`text-xs mt-1 ${charWarning ? 'text-red-400' : 'text-cms-text-dim'}`}>
            {content.length} / {minLimit}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.editor.urlLabel}</label>
        <input
          type="url"
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          placeholder={t.composer.editor.urlPlaceholder}
          className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.editor.hashtagsLabel}</label>
        <input
          type="text"
          placeholder={t.composer.editor.hashtagsPlaceholder}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              const val = (e.target as HTMLInputElement).value.trim().replace(/^#/, '')
              if (val) {
                onHashtagsChange([...hashtags, `#${val}`]);
                (e.target as HTMLInputElement).value = ''
              }
            }
          }}
          className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim"
        />
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {hashtags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-cms-accent/10 px-2 py-0.5 text-xs text-cms-accent">
                {tag}
                <button type="button" onClick={() => onHashtagsChange(hashtags.filter((_, j) => j !== i))} className="hover:text-red-400">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create composer-shell.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider, PostType } from '@tn-figueiredo/social'
import { PlatformSelector } from '@/app/cms/(authed)/_shared/social/platform-selector'
import { ComposerEditor } from './composer-editor'
import { createSocialPost } from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'

type ComposerMode = 'text' | 'image' | 'video'

interface MinimalConnection {
  provider: Provider
  account_name: string | null
}

interface ComposerShellProps {
  connections: MinimalConnection[]
  strings: SocialStrings
  initialMode?: ComposerMode
}

export function ComposerShell({ connections, strings: t, initialMode = 'text' }: ComposerShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<ComposerMode>(initialMode)
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<Provider[]>([])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule' | 'queue'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  function handlePublish() {
    if (platforms.length === 0) return
    startTransition(async () => {
      const postType: PostType = mode === 'video' ? 'video' : mode === 'image' ? 'image' : url ? 'link' : 'text'
      const result = await createSocialPost({
        type: postType,
        content: {
          description: content || undefined,
          url: url || undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
        },
        platforms,
        scheduledAt: scheduleMode === 'schedule' ? scheduledAt : undefined,
      })
      if (result.ok) {
        router.push(`/cms/social/${result.data.id}`)
      }
    })
  }

  const publishLabel = scheduleMode === 'now'
    ? t.composer.schedule.publish
    : scheduleMode === 'schedule'
    ? t.composer.schedule.scheduleAction
    : t.composer.schedule.addToQueue

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-cms-border pb-2">
        {(['text', 'image', 'video'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium ${mode === m ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {t.composer.modes[m]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {mode === 'text' && (
            <ComposerEditor
              content={content}
              url={url}
              hashtags={hashtags}
              selectedPlatforms={platforms}
              onContentChange={setContent}
              onUrlChange={setUrl}
              onHashtagsChange={setHashtags}
              strings={t}
            />
          )}

          {mode === 'image' && (
            <div className="rounded-lg border border-dashed border-cms-border p-8 text-center text-cms-text-muted">
              {t.composer.image.addImages}
            </div>
          )}

          {mode === 'video' && (
            <div className="rounded-lg border border-dashed border-cms-border p-8 text-center text-cms-text-muted">
              {t.composer.video.uploadZone}
            </div>
          )}

          <PlatformSelector
            selected={platforms}
            onChange={setPlatforms}
            connections={connections}
            disabled={mode === 'text' ? ['youtube'] : mode === 'video' ? ['instagram'] : []}
            disabledReason={{ youtube: 'Video mode only', instagram: 'Requires image' }}
          />
        </div>

        <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
          <p className="text-sm text-cms-text-muted">Preview</p>
          {platforms.length === 0 && <p className="mt-4 text-center text-xs text-cms-text-dim">Select a platform to see preview</p>}
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
        <div className="flex gap-2">
          {(['now', 'schedule', 'queue'] as const).map(sm => (
            <button
              key={sm}
              type="button"
              onClick={() => setScheduleMode(sm)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${scheduleMode === sm ? 'bg-cms-accent/15 text-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
            >
              {t.composer.schedule[sm]}
            </button>
          ))}
        </div>

        {scheduleMode === 'schedule' && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="rounded-md border border-cms-border bg-cms-bg px-3 py-1.5 text-sm text-cms-text"
          />
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending || platforms.length === 0 || (!content && !url)}
          className="rounded-md bg-cms-accent px-6 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
        >
          {isPending ? '…' : publishLabel}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Replace new/page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getConnections } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { ComposerShell } from './_components/composer-shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ mode?: string }>
}

export default async function SocialComposerPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const mode = (['text', 'image', 'video'].includes(params.mode ?? '') ? params.mode : 'text') as 'text' | 'image' | 'video'

  const result = await getConnections(ctx.siteId)
  const connections = result.ok ? result.data.map(c => ({ provider: c.provider, account_name: c.account_name })) : []

  return (
    <>
      <CmsTopbar title={t.composer.title} />
      <div className="p-6">
        <ComposerShell connections={connections} strings={t} initialMode={mode} />
      </div>
    </>
  )
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-composer.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/new/ apps/web/test/cms/social-composer.test.tsx
git commit -m "feat(social): Composer — shell layout, text/link editor, platform selector, schedule bar"
```

---

### Task 9: Platform Previews

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/platform-previews.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` (wire previews)

- [ ] **Step 1: Create platform-previews.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/platform-previews.tsx
'use client'

import { useState } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { SocialStrings } from '../../_i18n/types'

interface PlatformPreviewsProps {
  content: string
  url: string
  hashtags: string[]
  platforms: Provider[]
  strings: SocialStrings
}

export function PlatformPreviews({ content, url, hashtags, platforms, strings: t }: PlatformPreviewsProps) {
  const [activeTab, setActiveTab] = useState<Provider | null>(platforms[0] ?? null)

  if (platforms.length === 0) {
    return <p className="text-center text-xs text-cms-text-dim py-8">Select a platform to see preview</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-cms-border pb-1">
        {platforms.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveTab(p)}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-t ${activeTab === p ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted'}`}
          >
            <PlatformIcon provider={p} size="sm" />
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {activeTab === 'facebook' && <FacebookPreview content={content} url={url} />}
      {activeTab === 'instagram' && <InstagramPreview content={content} hashtags={hashtags} />}
      {activeTab === 'bluesky' && <BlueskyPreview content={content} url={url} />}
    </div>
  )
}

function FacebookPreview({ content, url }: { content: string; url: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-blue-600" />
        <div>
          <p className="text-xs font-semibold text-gray-200">Your Page</p>
          <p className="text-[10px] text-gray-500">Just now · 🌐</p>
        </div>
      </div>
      {content && <p className="text-sm text-gray-200 whitespace-pre-wrap">{content}</p>}
      {url && (
        <div className="rounded border border-gray-700 bg-gray-900 p-2">
          <p className="text-xs text-gray-400 truncate">{url}</p>
        </div>
      )}
      <div className="flex gap-4 border-t border-gray-700 pt-2 text-xs text-gray-500">
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>
    </div>
  )
}

function InstagramPreview({ content, hashtags }: { content: string; hashtags: string[] }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-yellow-500" />
        <p className="text-xs font-semibold text-gray-200">your_account</p>
      </div>
      <div className="aspect-square rounded bg-gray-700 flex items-center justify-center text-gray-500 text-xs">[Image]</div>
      {content && <p className="text-xs text-gray-200"><strong>your_account</strong> {content}</p>}
      {hashtags.length > 0 && <p className="text-xs text-blue-400">{hashtags.join(' ')}</p>}
    </div>
  )
}

function BlueskyPreview({ content, url }: { content: string; url: string }) {
  const truncated = content.length > 300 ? content.slice(0, 297) + '…' : content
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-sky-500" />
        <div>
          <p className="text-xs font-semibold text-gray-200">You</p>
          <p className="text-[10px] text-gray-500">@you.bsky.social</p>
        </div>
      </div>
      {truncated && <p className="text-sm text-gray-200 whitespace-pre-wrap">{truncated}</p>}
      {url && (
        <div className="rounded border border-gray-700 bg-gray-900 p-2">
          <p className="text-xs text-sky-400 truncate">{url}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire previews into composer-shell.tsx**

In `composer-shell.tsx`, replace the preview placeholder `<div>` (the right column) with:

```tsx
import { PlatformPreviews } from './platform-previews'

// In the grid's right column, replace the placeholder div with:
<div className="rounded-lg border border-cms-border bg-cms-bg p-4">
  <PlatformPreviews content={content} url={url} hashtags={hashtags} platforms={platforms} strings={t} />
</div>
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-composer.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/new/_components/
git commit -m "feat(social): Composer platform previews — Facebook, Instagram, Bluesky renderers"
```

---

### Task 10: Composer — Image Mode

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/image-composer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` (wire image mode)

- [ ] **Step 1: Create image-composer.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/image-composer.tsx
'use client'

import { useState } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface ImageComposerProps {
  images: string[]
  onImagesChange: (urls: string[]) => void
  caption: string
  onCaptionChange: (v: string) => void
  selectedPlatforms: Provider[]
  strings: SocialStrings
}

export function ImageComposer({ images, onImagesChange, caption, onCaptionChange, selectedPlatforms, strings: t }: ImageComposerProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return
    const next = [...images]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(targetIdx, 0, moved)
    onImagesChange(next)
    setDragIdx(null)
  }

  const bsMax = 4
  const igMax = 10

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            className="relative aspect-square rounded-md border border-cms-border bg-cms-bg overflow-hidden cursor-grab"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium">{i + 1}</span>
            <button
              type="button"
              onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed border-cms-border bg-cms-bg text-cms-text-muted text-sm hover:border-cms-accent">
          {t.composer.image.addImages}
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
            const files = e.target.files
            if (files) {
              const urls = Array.from(files).map(f => URL.createObjectURL(f))
              onImagesChange([...images, ...urls])
            }
          }} />
        </label>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {selectedPlatforms.includes('instagram') && images.length > 1 && (
            <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-pink-400">{t.composer.image.igCarousel}</span>
          )}
          {selectedPlatforms.includes('facebook') && images.length > 1 && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-400">{t.composer.image.fbMulti}</span>
          )}
          {selectedPlatforms.includes('bluesky') && images.length > bsMax && (
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-400">BS: max {bsMax} images</span>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.image.captionLabel}</label>
        <textarea
          value={caption}
          onChange={e => onCaptionChange(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into composer-shell.tsx**

In `composer-shell.tsx`, add state for images and caption, replace the image mode placeholder:

```tsx
import { ImageComposer } from './image-composer'

// Add state:
const [images, setImages] = useState<string[]>([])
const [caption, setCaption] = useState('')

// Replace the image mode placeholder:
{mode === 'image' && (
  <ImageComposer
    images={images}
    onImagesChange={setImages}
    caption={caption}
    onCaptionChange={setCaption}
    selectedPlatforms={platforms}
    strings={t}
  />
)}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-composer.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/new/_components/
git commit -m "feat(social): Composer image mode — grid upload, drag reorder, carousel badges"
```

---

### Task 11: Composer — Video Mode

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/video-composer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` (wire video mode)

- [ ] **Step 1: Create video-composer.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/video-composer.tsx
'use client'

import { useState, useRef, useTransition } from 'react'
import { YOUTUBE_DAILY_QUOTA } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface VideoComposerProps {
  strings: SocialStrings
  quotaUsed?: number
}

export function VideoComposer({ strings: t, quotaUsed = 0 }: VideoComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('22')
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private')
  const [tags, setTags] = useState('')
  const [abThumbnails, setAbThumbnails] = useState<string[]>([])
  const [firstComment, setFirstComment] = useState('')
  const [isPending, startTransition] = useTransition()

  const quotaPct = Math.round((quotaUsed / YOUTUBE_DAILY_QUOTA) * 100)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('video/')) setFile(f)
  }

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-cms-border bg-cms-bg py-12 text-cms-text-muted hover:border-cms-accent"
        >
          <p className="text-sm">{t.composer.video.uploadZone}</p>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
        </div>
      ) : (
        <div className="rounded-lg border border-cms-border bg-cms-bg p-3 space-y-2">
          <p className="text-sm text-cms-text font-medium">{file.name}</p>
          <div className="h-2 rounded-full bg-gray-700">
            <div className="h-full rounded-full bg-cms-accent transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-xs text-cms-text-dim">{t.composer.video.uploadProgress.replace('{uploaded}', String(Math.round(uploadProgress * file.size / 100 / 1024 / 1024))).replace('{total}', String(Math.round(file.size / 1024 / 1024)))}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-cms-text">{t.composer.video.titleLabel}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
          <p className="text-xs text-cms-text-dim mt-0.5">{title.length}/100</p>
        </div>
        <div>
          <label className="text-sm font-medium text-cms-text">{t.composer.video.privacyLabel}</label>
          <select value={privacy} onChange={e => setPrivacy(e.target.value as typeof privacy)} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text">
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.video.descLabel}</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={5000} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
        <p className="text-xs text-cms-text-dim mt-0.5">{description.length}/5000</p>
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.video.tagsLabel}</label>
        <input value={tags} onChange={e => setTags(e.target.value)} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" placeholder="tag1, tag2, tag3" />
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.video.firstComment}</label>
        <textarea value={firstComment} onChange={e => setFirstComment(e.target.value)} rows={2} placeholder="{short_link} | {blog_title}" className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim" />
      </div>

      <div className="rounded-lg border border-cms-border bg-cms-bg p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-cms-text">{t.composer.video.quotaLabel.replace('{used}', String(quotaUsed)).replace('{limit}', String(YOUTUBE_DAILY_QUOTA))}</span>
          <span className={`text-xs ${quotaPct > 80 ? 'text-orange-400' : 'text-cms-text-dim'}`}>{quotaPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-700">
          <div className={`h-full rounded-full transition-all ${quotaPct > 80 ? 'bg-orange-500' : 'bg-cms-accent'}`} style={{ width: `${Math.min(quotaPct, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into composer-shell.tsx**

Replace the video mode placeholder in `composer-shell.tsx`:

```tsx
import { VideoComposer } from './video-composer'

// Replace video mode placeholder:
{mode === 'video' && <VideoComposer strings={t} />}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-composer.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/new/_components/
git commit -m "feat(social): Composer video mode — upload zone, metadata, quota bar, first comment"
```

---

## Phase 4: Posts Extensions

### Task 12: Calendar + Queue + Drafts Tabs

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/_components/posts-calendar.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/_components/posts-queue.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/_components/posts-drafts.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/page.tsx` (wire tabs)

- [ ] **Step 1: Create posts-calendar.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/posts-calendar.tsx
'use client'

import { useState, useMemo } from 'react'
import type { SocialPost } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostsCalendarProps {
  posts: SocialPost[]
  strings: SocialStrings
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20', scheduled: 'bg-blue-500/20', draft: 'bg-yellow-500/20',
  failed: 'bg-red-500/20', cancelled: 'bg-gray-500/20', partial_failure: 'bg-orange-500/20',
  publishing: 'bg-blue-500/20',
}

export function PostsCalendar({ posts, strings: t }: PostsCalendarProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const days = useMemo(() => {
    const first = new Date(month.year, month.month, 1)
    const last = new Date(month.year, month.month + 1, 0)
    const startDay = first.getDay()
    const cells: (Date | null)[] = Array.from({ length: startDay }, () => null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(month.year, month.month, d))
    return cells
  }, [month])

  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    for (const p of posts) {
      const date = p.scheduled_at ?? p.published_at ?? p.created_at
      const key = new Date(date).toISOString().slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return map
  }, [posts])

  function prevMonth() { setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 }) }
  function nextMonth() { setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 }) }

  const monthName = new Date(month.year, month.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (posts.length === 0) {
    return <p className="py-12 text-center text-cms-text-muted">{t.posts.emptyCalendar}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="text-sm text-cms-accent hover:underline">← Prev</button>
        <span className="text-sm font-semibold text-cms-text">{monthName}</span>
        <button type="button" onClick={nextMonth} className="text-sm text-cms-accent hover:underline">Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-cms-border rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-cms-surface px-2 py-1 text-center text-xs font-medium text-cms-text-muted">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-cms-bg min-h-[60px]" />
          const key = day.toISOString().slice(0, 10)
          const dayPosts = postsByDay[key] ?? []
          return (
            <div key={key} className="bg-cms-bg min-h-[60px] p-1">
              <span className="text-xs text-cms-text-dim">{day.getDate()}</span>
              {dayPosts.slice(0, 3).map(p => (
                <div key={p.id} className={`mt-0.5 rounded px-1 py-0.5 text-[10px] truncate ${STATUS_COLORS[p.status] ?? ''} text-cms-text`}>
                  {p.content.title ?? p.content.description?.slice(0, 20) ?? p.type}
                </div>
              ))}
              {dayPosts.length > 3 && <p className="text-[10px] text-cms-text-dim">+{dayPosts.length - 3} more</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create posts-queue.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/posts-queue.tsx
'use client'

import type { SocialPost } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostsQueueProps {
  posts: SocialPost[]
  strings: SocialStrings
}

export function PostsQueue({ posts, strings: t }: PostsQueueProps) {
  const queued = posts.filter(p => p.status === 'scheduled').sort((a, b) =>
    new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
  )

  if (queued.length === 0) {
    return <p className="py-12 text-center text-cms-text-muted">{t.posts.emptyQueue}</p>
  }

  return (
    <div className="space-y-2">
      {queued.map((post, i) => (
        <div key={post.id} className="flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/15 text-xs font-medium text-purple-400">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-cms-text truncate">{post.content.title ?? post.content.description ?? post.type}</p>
            <p className="text-xs text-cms-text-dim">
              {post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            </p>
          </div>
          <SocialStatusBadge status="scheduled" label={t.status.scheduled} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create posts-drafts.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/posts-drafts.tsx
'use client'

import Link from 'next/link'
import type { SocialPost } from '@tn-figueiredo/social'
import type { SocialStrings } from '../_i18n/types'

interface PostsDraftsProps {
  posts: SocialPost[]
  strings: SocialStrings
}

export function PostsDrafts({ posts, strings: t }: PostsDraftsProps) {
  const drafts = posts.filter(p => p.status === 'draft')

  if (drafts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-cms-text-muted">{t.posts.emptyDrafts}</p>
        <Link href="/cms/social/accounts?tab=automations" className="mt-2 inline-block text-sm text-cms-accent hover:underline">
          {t.posts.emptyDraftsCta}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {drafts.map(post => (
        <div key={post.id} className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-cms-text truncate">{post.content.title ?? post.content.description ?? 'Untitled draft'}</p>
            <p className="text-xs text-cms-text-dim">{new Date(post.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/cms/social/new?draft=${post.id}`} className="text-sm text-cms-accent hover:underline">
              Review
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Wire tabs into social/page.tsx**

In `social/page.tsx`, import and render the tab components:

```tsx
import { PostsCalendar } from './_components/posts-calendar'
import { PostsQueue } from './_components/posts-queue'
import { PostsDrafts } from './_components/posts-drafts'

// Replace the placeholder tab renders:
{tab === 'calendar' && <PostsCalendar posts={posts} strings={t} />}
{tab === 'queue' && <PostsQueue posts={posts} strings={t} />}
{tab === 'drafts' && <PostsDrafts posts={posts} strings={t} />}
```

- [ ] **Step 5: Run all tests**

Run: `cd apps/web && npx vitest run test/cms/social-posts-feed.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/_components/ apps/web/src/app/cms/(authed)/social/page.tsx
git commit -m "feat(social): Posts calendar, queue, drafts tabs with empty states"
```

---

## Phase 5: Insights

### Task 13: Insights Overview

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/insights/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/insights/_components/insights-overview.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/insights/_components/kpi-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/insights/_components/engagement-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/insights/_components/posting-heatmap.tsx`
- Test: `apps/web/test/cms/social-insights.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-insights.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div />,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
}))

import { InsightsOverview } from '@/app/cms/(authed)/social/insights/_components/insights-overview'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockData = {
  kpis: { postsPublished: 42, deliverySuccessRate: 94.5, linkClicks: 1280, avgEngagement: 3.2, aiDraftsApproved: 7 },
  chartData: [
    { date: '2026-05-01', clicks: 120, engagement: 40, posts: 3 },
    { date: '2026-05-02', clicks: 95, engagement: 32, posts: 2 },
  ],
  heatmapData: Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({ day, hour, value: Math.random() * 10 }))
  ).flat(),
}

describe('InsightsOverview', () => {
  it('renders 5 KPI cards', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByText(en.insights.kpi.postsPublished)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.deliverySuccess)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.linkClicks)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.avgEngagement)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.aiDraftsApproved)).toBeDefined()
  })

  it('renders KPI values', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('94.5%')).toBeDefined()
    expect(screen.getByText('1,280')).toBeDefined()
  })

  it('renders chart area', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByTestId('composed-chart')).toBeDefined()
  })

  it('renders heatmap', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByText(en.insights.heatmap.title)).toBeDefined()
  })
})
```

- [ ] **Step 2: Create kpi-card.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/_components/kpi-card.tsx
interface KpiCardProps {
  label: string
  value: string
  trend?: { direction: 'up' | 'down'; pct: number }
}

export function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <p className="text-xs font-medium text-cms-text-muted">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-2xl font-bold text-cms-text">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.pct}%
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create engagement-chart.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/_components/engagement-chart.tsx
'use client'

import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { SocialStrings } from '../../_i18n/types'

interface ChartDataPoint {
  date: string
  clicks: number
  engagement: number
  posts: number
}

interface EngagementChartProps {
  data: ChartDataPoint[]
  strings: SocialStrings
}

export function EngagementChart({ data, strings: t }: EngagementChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
          <YAxis tick={{ fontSize: 11, fill: '#888' }} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
          <Bar dataKey="posts" fill="#3b82f6" opacity={0.4} name={t.insights.chart.postCount} />
          <Line type="monotone" dataKey="clicks" stroke="#a855f7" strokeWidth={2} name={t.insights.chart.clicks} dot={false} />
          <Line type="monotone" dataKey="engagement" stroke="#22c55e" strokeWidth={2} name={t.insights.chart.engagement} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Create posting-heatmap.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/_components/posting-heatmap.tsx
import type { SocialStrings } from '../../_i18n/types'

interface HeatmapCell {
  day: number
  hour: number
  value: number
}

interface PostingHeatmapProps {
  data: HeatmapCell[]
  strings: SocialStrings
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function PostingHeatmap({ data, strings: t }: PostingHeatmapProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1)

  function intensity(value: number): string {
    const pct = value / maxVal
    if (pct > 0.8) return 'bg-green-500'
    if (pct > 0.6) return 'bg-green-600/70'
    if (pct > 0.3) return 'bg-green-700/40'
    if (pct > 0) return 'bg-green-800/20'
    return 'bg-gray-800'
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-cms-text mb-3">{t.insights.heatmap.title}</h3>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(24, 1fr)` }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[9px] text-cms-text-dim w-5">{h}</div>
          ))}
          {DAYS.map((day, dayIdx) => (
            <>
              <div key={`label-${dayIdx}`} className="text-[10px] text-cms-text-dim pr-1 flex items-center">{day}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = data.find(d => d.day === dayIdx && d.hour === hour)
                return (
                  <div
                    key={`${dayIdx}-${hour}`}
                    className={`h-5 w-5 rounded-sm ${intensity(cell?.value ?? 0)}`}
                    title={`${day} ${hour}:00 — ${(cell?.value ?? 0).toFixed(1)}`}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create insights-overview.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/_components/insights-overview.tsx
'use client'

import { KpiCard } from './kpi-card'
import { EngagementChart } from './engagement-chart'
import { PostingHeatmap } from './posting-heatmap'
import type { SocialStrings } from '../../_i18n/types'

interface InsightsData {
  kpis: { postsPublished: number; deliverySuccessRate: number; linkClicks: number; avgEngagement: number; aiDraftsApproved: number }
  chartData: { date: string; clicks: number; engagement: number; posts: number }[]
  heatmapData: { day: number; hour: number; value: number }[]
}

interface InsightsOverviewProps {
  data: InsightsData
  strings: SocialStrings
}

export function InsightsOverview({ data, strings: t }: InsightsOverviewProps) {
  const { kpis } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label={t.insights.kpi.postsPublished} value={String(kpis.postsPublished)} />
        <KpiCard label={t.insights.kpi.deliverySuccess} value={`${kpis.deliverySuccessRate}%`} />
        <KpiCard label={t.insights.kpi.linkClicks} value={kpis.linkClicks.toLocaleString()} />
        <KpiCard label={t.insights.kpi.avgEngagement} value={String(kpis.avgEngagement)} />
        <KpiCard label={t.insights.kpi.aiDraftsApproved} value={String(kpis.aiDraftsApproved)} />
      </div>

      <EngagementChart data={data.chartData} strings={t} />

      <PostingHeatmap data={data.heatmapData} strings={t} />
    </div>
  )
}
```

- [ ] **Step 6: Create insights/page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSocialStrings } from '../_i18n'
import { InsightsOverview } from './_components/insights-overview'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function SocialInsightsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'overview'

  // TODO: fetch real analytics data from social_posts + social_deliveries + link_clicks
  const data = {
    kpis: { postsPublished: 0, deliverySuccessRate: 0, linkClicks: 0, avgEngagement: 0, aiDraftsApproved: 0 },
    chartData: [],
    heatmapData: [],
  }

  return (
    <>
      <CmsTopbar title={t.insights.title} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          {(['overview', 'best-of', 'platform-health'] as const).map(tabId => {
            const tabKey = tabId === 'best-of' ? 'bestOf' : tabId === 'platform-health' ? 'platformHealth' : 'overview'
            return (
              <a
                key={tabId}
                href={tabId === 'overview' ? '/cms/social/insights' : `/cms/social/insights?tab=${tabId}`}
                className={`px-3 py-1.5 text-sm font-medium ${tab === tabId ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
              >
                {t.insights.tabs[tabKey]}
              </a>
            )
          })}
        </div>

        {tab === 'overview' && <InsightsOverview data={data} strings={t} />}
        {tab === 'best-of' && <p className="py-12 text-center text-cms-text-muted">{t.insights.empty}</p>}
        {tab === 'platform-health' && <p className="py-12 text-center text-cms-text-muted">{t.insights.empty}</p>}
      </div>
    </>
  )
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-insights.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/insights/ apps/web/test/cms/social-insights.test.tsx
git commit -m "feat(social): Insights — KPI cards, engagement chart, posting heatmap, tab routing"
```

---

### Task 14: Insights — Best Of + Platform Health

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/insights/_components/insights-best-of.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/insights/_components/insights-health.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/insights/page.tsx` (wire remaining tabs)

- [ ] **Step 1: Create insights-best-of.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/_components/insights-best-of.tsx
'use client'

import type { SocialStrings } from '../../_i18n/types'

interface LeaderboardItem {
  id: string
  label: string
  value: number
  thumbnailUrl?: string
  badge?: string
}

interface InsightsBestOfProps {
  topThumbnails: LeaderboardItem[]
  topTitles: LeaderboardItem[]
  topPosts: LeaderboardItem[]
  strings: SocialStrings
}

export function InsightsBestOf({ topThumbnails, topTitles, topPosts, strings: t }: InsightsBestOfProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Podium title={t.insights.bestOf.topThumbnails} items={topThumbnails} unit="% CTR" />
      <Podium title={t.insights.bestOf.topTitles} items={topTitles} unit="% CTR" />
      <Podium title={t.insights.bestOf.topPosts} items={topPosts} unit=" clicks" />
    </div>
  )
}

function Podium({ title, items, unit }: { title: string; items: LeaderboardItem[]; unit: string }) {
  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <h3 className="text-sm font-semibold text-cms-text mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-cms-text-dim py-4 text-center">No data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>
                {i + 1}
              </span>
              {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="h-8 w-12 rounded object-cover" />}
              <span className="flex-1 text-sm text-cms-text truncate">{item.label}</span>
              <span className="text-xs font-medium text-cms-accent">{item.value}{unit}</span>
              {item.badge && <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-400">{item.badge}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create insights-health.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/insights/_components/insights-health.tsx
'use client'

import { PROVIDERS, type Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OauthButton } from '../../accounts/_components/oauth-button'
import type { SocialStrings } from '../../_i18n/types'

interface HealthConnection {
  provider: Provider
  account_name: string | null
  token_expires_at: string | null
  revoked_at: string | null
}

interface InsightsHealthProps {
  connections: HealthConnection[]
  quotaUsed?: number
  strings: SocialStrings
}

export function InsightsHealth({ connections, quotaUsed = 0, strings: t }: InsightsHealthProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROVIDERS.map(provider => {
          const conn = connections.find(c => c.provider === provider)
          const isExpired = conn?.token_expires_at && new Date(conn.token_expires_at) < new Date()
          const status = !conn ? 'none' : isExpired ? 'expired' : 'healthy'
          const statusColor = status === 'healthy' ? 'text-green-400' : status === 'expired' ? 'text-red-400' : 'text-gray-500'
          const statusLabel = status === 'healthy' ? t.insights.health.healthy : status === 'expired' ? t.insights.health.expired : '—'

          return (
            <div key={provider} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-2">
              <div className="flex items-center gap-2">
                <PlatformIcon provider={provider} size="lg" />
                <span className="font-semibold text-cms-text">{platformLabel(provider)}</span>
              </div>
              <p className={`text-sm ${statusColor}`}>{statusLabel}</p>
              {conn?.token_expires_at && !isExpired && (
                <p className="text-xs text-cms-text-dim">
                  {t.insights.health.tokenExpiry.replace('{days}', String(Math.ceil((new Date(conn.token_expires_at).getTime() - Date.now()) / 86400000)))}
                </p>
              )}
              {provider === 'youtube' && conn && (
                <div className="space-y-1">
                  <p className="text-xs text-cms-text-dim">{t.insights.health.quotaLabel}</p>
                  <div className="h-1.5 rounded-full bg-gray-700">
                    <div className="h-full rounded-full bg-cms-accent" style={{ width: `${Math.min(quotaUsed / 100, 100)}%` }} />
                  </div>
                </div>
              )}
              {status === 'expired' && <OauthButton provider={provider} label={t.insights.health.reconnect} className="w-full justify-center text-xs" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into insights/page.tsx**

Import and render the new tab components replacing the placeholders in `insights/page.tsx`:

```tsx
import { InsightsBestOf } from './_components/insights-best-of'
import { InsightsHealth } from './_components/insights-health'

// In the tab rendering:
{tab === 'best-of' && <InsightsBestOf topThumbnails={[]} topTitles={[]} topPosts={[]} strings={t} />}
{tab === 'platform-health' && <InsightsHealth connections={[]} strings={t} />}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-insights.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/insights/
git commit -m "feat(social): Insights — Best Of leaderboards + Platform Health cards"
```

---

## Phase 6: YouTube Enhancements

### Task 15: YouTube Layout + Videos Tab

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/layout.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/_components/videos-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/_components/seo-breakdown.tsx`
- Test: `apps/web/test/cms/social-youtube-enhancements.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-youtube-enhancements.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/cms/youtube/videos'),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

import { VideosTab } from '@/app/cms/(authed)/youtube/_components/videos-tab'

const mockVideos = [
  { id: 'v1', youtubeVideoId: 'yt1', title: 'Test Video', channelId: 'ch1', channelLocale: 'pt' as const, categoryId: null, suggestedCategoryId: null, isFeatured: false, isHidden: false, pinnedUntil: null, viewCount: 1000, likeCount: 50, commentCount: 10, publishedAt: '2026-05-01T00:00:00Z' },
]

describe('VideosTab', () => {
  it('renders video list', () => {
    render(<VideosTab videos={mockVideos} />)
    expect(screen.getByText('Test Video')).toBeDefined()
  })

  it('shows view count', () => {
    render(<VideosTab videos={mockVideos} />)
    expect(screen.getByText('1,000 views')).toBeDefined()
  })

  it('shows "Share on Social" action', () => {
    render(<VideosTab videos={mockVideos} />)
    expect(screen.getByText('Share')).toBeDefined()
  })
})

import { SeoBreakdown } from '@/app/cms/(authed)/youtube/_components/seo-breakdown'

describe('SeoBreakdown', () => {
  it('renders SEO score', () => {
    render(<SeoBreakdown title="Test Video" description="A long description here" tags={['tag1', 'tag2']} />)
    expect(screen.getByText(/SEO Score/)).toBeDefined()
  })
})
```

- [ ] **Step 2: Create seo-breakdown.tsx**

```tsx
// apps/web/src/app/cms/(authed)/youtube/_components/seo-breakdown.tsx
interface SeoBreakdownProps {
  title: string
  description: string
  tags: string[]
}

interface SeoRule {
  label: string
  points: number
  pass: boolean
}

export function SeoBreakdown({ title, description, tags }: SeoBreakdownProps) {
  const rules: SeoRule[] = [
    { label: 'Title length 30-60 chars', points: 15, pass: title.length >= 30 && title.length <= 60 },
    { label: 'Description has timestamps', points: 15, pass: /\d{1,2}:\d{2}/.test(description) },
    { label: 'Keywords in title match tags', points: 15, pass: tags.some(t => title.toLowerCase().includes(t.toLowerCase())) },
    { label: 'Description 200+ chars', points: 10, pass: description.length >= 200 },
    { label: 'Power words in title', points: 7, pass: /how|why|best|ultimate|guide|secret|top/i.test(title) },
    { label: 'Links in description', points: 5, pass: /https?:\/\//.test(description) },
    { label: '8-15 tags', points: 10, pass: tags.length >= 8 && tags.length <= 15 },
  ]

  const score = rules.reduce((sum, r) => sum + (r.pass ? r.points : 0), 0)
  const maxScore = rules.reduce((sum, r) => sum + r.points, 0)
  const pct = Math.round((score / maxScore) * 100)

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-cms-text">SEO Score</span>
        <span className={`text-lg font-bold ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}/100</span>
      </div>
      <div className="space-y-1">
        {rules.map(rule => (
          <div key={rule.label} className="flex items-center gap-2 text-xs">
            <span className={rule.pass ? 'text-green-400' : 'text-red-400'}>{rule.pass ? '✓' : '✕'}</span>
            <span className="text-cms-text-muted flex-1">{rule.label}</span>
            <span className={`font-medium ${rule.pass ? 'text-green-400' : 'text-cms-text-dim'}`}>+{rule.points}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create videos-tab.tsx**

```tsx
// apps/web/src/app/cms/(authed)/youtube/_components/videos-tab.tsx
'use client'

import Link from 'next/link'

interface VideoRow {
  id: string
  youtubeVideoId: string
  title: string
  channelId: string
  channelLocale: 'pt' | 'en'
  categoryId: string | null
  suggestedCategoryId: string | null
  isFeatured: boolean
  isHidden: boolean
  pinnedUntil: string | null
  viewCount?: number
  likeCount?: number
  commentCount?: number
  publishedAt?: string
}

interface VideosTabProps {
  videos: VideoRow[]
}

export function VideosTab({ videos }: VideosTabProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 text-xs font-medium text-cms-text-muted px-2">
        <span>Video</span>
        <span>Stats</span>
        <span>Grade</span>
        <span>Actions</span>
      </div>
      {videos.map(video => {
        const views = video.viewCount ?? 0
        return (
          <div key={video.id} className="flex items-center gap-4 rounded-lg border border-cms-border bg-cms-surface p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cms-text truncate">{video.title}</p>
              <p className="text-xs text-cms-text-dim">{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : ''}</p>
            </div>
            <div className="text-xs text-cms-text-muted">{views.toLocaleString()} views</div>
            <div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${views > 10000 ? 'bg-green-500/15 text-green-400' : views > 1000 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-gray-500/15 text-gray-400'}`}>
                {views > 10000 ? 'A+' : views > 1000 ? 'B+' : 'C'}
              </span>
            </div>
            <div className="flex gap-2">
              <Link href={`/cms/social/new?mode=video&ref=${video.youtubeVideoId}`} className="text-xs text-cms-accent hover:underline">
                Share
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Modify youtube/layout.tsx to add new tabs**

Add `Videos` and `A/B Lab` to the TABS array in `apps/web/src/app/cms/(authed)/youtube/layout.tsx`:

```tsx
const TABS = [
  { label: 'Dashboard', href: '/cms/youtube' },
  { label: 'Videos', href: '/cms/youtube/videos' },
  { label: 'A/B Lab', href: '/cms/youtube/ab-lab' },
  { label: 'Categories', href: '/cms/youtube/categories' },
  { label: 'Comments', href: '/cms/youtube/comments' },
  { label: 'Content', href: '/cms/youtube/content' },
]
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-youtube-enhancements.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ apps/web/test/cms/social-youtube-enhancements.test.tsx
git commit -m "feat(social): YouTube — Videos tab with grades, SEO breakdown, layout tabs"
```

---

### Task 16: YouTube A/B Lab + Dashboard Enhancements

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/_components/ab-lab-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/page.tsx`

- [ ] **Step 1: Create ab-lab-tab.tsx**

```tsx
// apps/web/src/app/cms/(authed)/youtube/_components/ab-lab-tab.tsx
'use client'

interface AbTest {
  id: string
  videoTitle: string
  status: 'active' | 'completed'
  variants: { label: string; thumbnailUrl?: string; ctr: number; impressions: number; clicks: number }[]
  confidence: number
  winner?: string
}

interface AbLabTabProps {
  tests: AbTest[]
}

export function AbLabTab({ tests }: AbLabTabProps) {
  const active = tests.filter(t => t.status === 'active')
  const completed = tests.filter(t => t.status === 'completed')

  if (tests.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-cms-text-muted">No A/B tests yet</p>
        <p className="mt-2 text-sm text-cms-text-dim">Go to Videos tab → Start A/B on any video</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Active Tests</h3>
          {active.map(test => (
            <div key={test.id} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-cms-text">{test.videoTitle}</p>
                <span className="text-xs text-cms-accent">Confidence: {test.confidence}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-700">
                <div className="h-full rounded-full bg-cms-accent" style={{ width: `${Math.min(test.confidence, 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {test.variants.map(v => (
                  <div key={v.label} className="rounded-md border border-cms-border bg-cms-bg p-3">
                    <p className="text-xs font-medium text-cms-text-muted">{v.label}</p>
                    <p className="text-lg font-bold text-cms-text">{v.ctr.toFixed(1)}% CTR</p>
                    <p className="text-xs text-cms-text-dim">{v.impressions.toLocaleString()} impressions · {v.clicks.toLocaleString()} clicks</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Completed Tests</h3>
          {completed.map(test => (
            <div key={test.id} className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
              <p className="text-sm text-cms-text">{test.videoTitle}</p>
              <div className="flex items-center gap-2">
                {test.winner && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">Winner: {test.winner}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ab-lab/page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/youtube/ab-lab/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { AbLabTab } from '../_components/ab-lab-tab'

export const dynamic = 'force-dynamic'

export default async function AbLabPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  // TODO: fetch A/B test data from social_posts where metadata contains ab_test config
  const tests: [] = []

  return <AbLabTab tests={tests} />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/
git commit -m "feat(social): YouTube A/B Lab — active/completed test views, confidence bars"
```

---

## Phase 7: Polish

### Task 17: Composer — Template Picker + Bilingual + Draft Review

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/template-picker.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/bilingual-editor.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/draft-review-banner.tsx`

- [ ] **Step 1: Create template-picker.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/template-picker.tsx
'use client'

import { useState } from 'react'
import { DEFAULT_TEMPLATES } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface TemplatePickerProps {
  onSelect: (template: string) => void
  strings: SocialStrings
}

const TEMPLATE_LIST = [
  { id: 'blog-post', key: 'blogAnnouncement' },
  { id: 'video-launch', key: 'videoLaunch' },
  { id: 'link-share', key: 'linkShare' },
  { id: 'newsletter', key: 'newsletterShare' },
  { id: 'evergreen', key: 'evergreenReshare' },
] as const

export function TemplatePicker({ onSelect, strings: t }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-cms-accent hover:underline">
        {t.composer.template.title} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-cms-border bg-cms-surface shadow-lg">
          {TEMPLATE_LIST.map(tmpl => {
            const label = t.composer.template[tmpl.key as keyof typeof t.composer.template] as string
            const text = DEFAULT_TEMPLATES[tmpl.id] ?? ''
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => { onSelect(text); setOpen(false) }}
                className="block w-full px-4 py-2 text-left hover:bg-cms-surface-hover"
              >
                <p className="text-sm font-medium text-cms-text">{label}</p>
                <p className="text-xs text-cms-text-dim truncate">{text}</p>
              </button>
            )
          })}
          <div className="border-t border-cms-border px-4 py-2">
            <button type="button" className="text-xs text-cms-accent hover:underline">{t.composer.template.createCustom}</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create bilingual-editor.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/bilingual-editor.tsx
'use client'

import type { SocialStrings } from '../../_i18n/types'

interface BilingualEditorProps {
  enabled: boolean
  onToggle: (v: boolean) => void
  ptContent: string
  enContent: string
  onPtChange: (v: string) => void
  onEnChange: (v: string) => void
  strings: SocialStrings
}

export function BilingualEditor({ enabled, onToggle, ptContent, enContent, onPtChange, onEnChange, strings: t }: BilingualEditorProps) {
  if (!enabled) {
    return (
      <button type="button" onClick={() => onToggle(true)} className="text-sm text-cms-accent hover:underline">
        {t.composer.bilingual.enableEn}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-cms-text">{t.composer.bilingual.enableEn}</span>
        <button type="button" onClick={() => onToggle(false)} className="text-xs text-cms-text-muted hover:text-red-400">×</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-cms-text-muted">{t.composer.bilingual.ptBr}</label>
          <textarea value={ptContent} onChange={e => onPtChange(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
        </div>
        <div>
          <label className="text-xs font-medium text-cms-text-muted">{t.composer.bilingual.en}</label>
          <textarea value={enContent} onChange={e => onEnChange(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text" />
          <button type="button" className="mt-1 text-xs text-cms-accent hover:underline">{t.composer.bilingual.autoTranslate}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create draft-review-banner.tsx**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/draft-review-banner.tsx
import type { SocialStrings } from '../../_i18n/types'

interface DraftReviewBannerProps {
  source: string
  createdAt: string
  strings: SocialStrings
}

export function DraftReviewBanner({ source, createdAt, strings: t }: DraftReviewBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
      <span className="text-yellow-400 text-lg">⚠</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-300">{t.composer.draftReview.banner}</p>
        <p className="text-xs text-yellow-400/70">
          {t.composer.draftReview.source.replace('{source}', source)} · {new Date(createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/new/_components/
git commit -m "feat(social): Composer polish — template picker, bilingual editor, draft review banner"
```

---

### Task 18: Notification Center

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/notification-center.tsx`
- Test: `apps/web/test/cms/social-notification-center.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/cms/social-notification-center.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { NotificationCenter } from '@/app/cms/(authed)/_shared/notification-center'

const mockNotifications = [
  { id: 'n1', type: 'delivery_failed' as const, message: 'Delivery failed on Instagram', read: false, createdAt: '2026-05-13T10:00:00Z', href: '/cms/social/p1' },
  { id: 'n2', type: 'ab_test_complete' as const, message: 'A/B test complete: Variant B won', read: false, createdAt: '2026-05-13T09:00:00Z', href: '/cms/youtube/ab-lab' },
  { id: 'n3', type: 'published' as const, message: 'Published to Facebook, Bluesky', read: true, createdAt: '2026-05-13T08:00:00Z', href: '/cms/social/p2' },
]

describe('NotificationCenter', () => {
  it('shows unread badge count', () => {
    render(<NotificationCenter notifications={mockNotifications} onMarkAllRead={() => {}} />)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('opens dropdown on bell click', () => {
    render(<NotificationCenter notifications={mockNotifications} onMarkAllRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Delivery failed on Instagram')).toBeDefined()
  })

  it('shows mark all read button', () => {
    render(<NotificationCenter notifications={mockNotifications} onMarkAllRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Mark all read')).toBeDefined()
  })

  it('shows empty state when no notifications', () => {
    render(<NotificationCenter notifications={[]} onMarkAllRead={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('No notifications')).toBeDefined()
  })
})
```

- [ ] **Step 2: Create notification-center.tsx**

```tsx
// apps/web/src/app/cms/(authed)/_shared/notification-center.tsx
'use client'

import { useState } from 'react'

type NotificationType = 'delivery_failed' | 'token_expiring' | 'ai_drafts_ready' | 'ab_test_complete' | 'published'

interface Notification {
  id: string
  type: NotificationType
  message: string
  read: boolean
  createdAt: string
  href: string
}

interface NotificationCenterProps {
  notifications: Notification[]
  onMarkAllRead: () => void
}

const TYPE_COLORS: Record<NotificationType, string> = {
  delivery_failed: 'border-l-red-500',
  token_expiring: 'border-l-yellow-500',
  ai_drafts_ready: 'border-l-purple-500',
  ab_test_complete: 'border-l-green-500',
  published: 'border-l-gray-500',
}

export function NotificationCenter({ notifications, onMarkAllRead }: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative rounded-md p-2 text-cms-text-muted hover:text-cms-text"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-cms-border bg-cms-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-cms-border px-4 py-2">
            <span className="text-sm font-semibold text-cms-text">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead} className="text-xs text-cms-accent hover:underline">Mark all read</button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-cms-text-muted">No notifications</p>
            ) : (
              notifications.map(n => (
                <a
                  key={n.id}
                  href={n.href}
                  className={`block border-l-2 px-4 py-3 hover:bg-cms-surface-hover ${TYPE_COLORS[n.type]} ${n.read ? 'opacity-60' : ''}`}
                >
                  <p className="text-sm text-cms-text">{n.message}</p>
                  <p className="text-xs text-cms-text-dim">{new Date(n.createdAt).toLocaleString()}</p>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/cms/social-notification-center.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/notification-center.tsx apps/web/test/cms/social-notification-center.test.tsx
git commit -m "feat(social): Notification Center — bell icon, unread badge, dropdown with types"
```

---

### Task 19: Final Integration — Run All Tests

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Fix any failures**

If any test fails, fix the issue before proceeding.

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(social): complete Social Hub visual layer — 22 screens across 5 sections"
```

---

## Summary

| Phase | Tasks | Can Parallel | Est. Time |
|-------|-------|-------------|-----------|
| 1: Foundation | 1–3 | Sequential | 45 min |
| 2: Core Pages | 4–7 | All 4 parallel | 1.5 h |
| 3: Composer | 8–11 | After T8, 9–11 parallel | 1.5 h |
| 4: Posts Extensions | 12 | After T6 | 30 min |
| 5: Insights | 13–14 | Both parallel | 1 h |
| 6: YouTube | 15–16 | Both parallel | 1 h |
| 7: Polish | 17–19 | 17–18 parallel, 19 last | 1 h |
| **Total** | **19 tasks** | | **~7 h** |
