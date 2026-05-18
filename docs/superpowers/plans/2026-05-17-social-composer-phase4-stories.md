# Phase 4: Instagram Stories & Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Instagram Story publishing, build the Canvas Editor, add Telegram notifications, create the Ready-to-Post page, and build the Link-in-Bio page.

**Architecture:** Phase 4 bridges the existing Social Hub infrastructure with five new capabilities. The Instagram provider fix corrects story media_type routing so the Graph API receives `STORIES` instead of defaulting to `IMAGE`. The Canvas Editor reuses ~90% of the QR Card Builder from `packages/links-admin` — same `react-konva` rendering, same `useCardComposition` / `useCanvasInteraction` hooks — adapted for fixed social aspect ratios and CMS content auto-population. The notification system implements a tiered delivery chain (Telegram primary, email fallback) to support Instagram's limitation that link stickers cannot be added via API. The Ready-to-Post page is a mobile-first CMS view for manual Story posting. The Link-in-Bio page (`/go/ig`) is a public landing page built on the existing Links Engine.

**Tech Stack:** Next.js 15, React 19, react-konva, Tailwind 4, Supabase, Vercel Blob, Telegram Bot API, Resend, Vitest

**Dependencies:** Phase 2 (template CRUD + server-side Konva renderer) and Phase 3 (composer UI redesign) must be complete. Specifically:
- Phase 2 Task 7 provides `renderTemplate()` for server-side Konva rendering
- Phase 2 Task 5 provides template CRUD actions and `social_templates` table
- Phase 3 Task 12 provides the pre-publish confirmation dialog that integrates with delivery format routing

**Parallel execution:** Tasks 15, 16, 19 are independent and can run in parallel. Task 17 depends on Task 15 (needs delivery format routing). Task 18 depends on Task 17 (needs notification delivery to link to the ready page).

---

## Task 15: Instagram Provider Fix

**Estimated time:** 3h
**Dependencies:** Phase 2 Task 7 (`renderTemplate`)
**Branch:** staging (direct commits)

### Problem

`InstagramProvider.publish()` at line ~125 of `packages/social/src/providers/meta/index.ts` determines `mediaType` exclusively from file extension:

```typescript
const isVideo = firstMedia
  ? /\.(mp4|mov|webm)(\?|$)/i.test(firstMedia)
  : false

const mediaType = isVideo ? 'REELS' as const : undefined
```

This ignores the delivery's `format` field entirely. When `format === 'story'`, the provider should set `media_type='STORIES'` regardless of file extension. Currently, story images are published as regular feed posts.

Additionally, `prepareStoryDelivery()` in `apps/web/src/lib/social/workflows.ts` still uses the legacy `@vercel/og` `generateStoryImage()` instead of the new Konva-based `renderTemplate()` from Phase 2.

### Files

| Action | Path |
|--------|------|
| Modify | `packages/social/src/providers/meta/index.ts` |
| Modify | `packages/social/src/core/types.ts` |
| Modify | `apps/web/src/lib/social/workflows.ts` |
| Create | `packages/social/test/instagram-stories.test.ts` |

### Steps

- [ ] **15.1 — Write failing tests for Instagram story publishing**

Create `packages/social/test/instagram-stories.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the instagram module
vi.mock('../src/providers/meta/instagram.js', () => ({
  publishInstagramMedia: vi.fn().mockResolvedValue({ id: 'ig-media-123' }),
  deleteInstagramMedia: vi.fn().mockResolvedValue(undefined),
}))

import { InstagramProvider } from '../src/providers/meta/index.js'
import { publishInstagramMedia } from '../src/providers/meta/instagram.js'
import type { SocialPost, SocialConnection, SocialDelivery } from '../src/core/types.js'

function makePost(overrides?: Partial<SocialPost>): SocialPost {
  return {
    id: 'post-1',
    site_id: 'site-1',
    created_by: 'user-1',
    type: 'image',
    status: 'publishing',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content: {
      title: 'Test Post',
      media_urls: ['https://blob.vercel.com/stories/test-story.png'],
    },
    template_id: null,
    idempotency_key: 'key-1',
    created_at: '2026-05-17T00:00:00Z',
    updated_at: '2026-05-17T00:00:00Z',
    ...overrides,
  }
}

function makeConnection(): SocialConnection {
  return {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'instagram',
    account_id: 'ig-user-123',
    account_name: 'testaccount',
    access_token_enc: 'enc-token',
    refresh_token_enc: null,
    page_token_enc: 'enc-page-token',
    token_expires_at: null,
    scopes: [],
    metadata: { ig_user_id: '17841400000000' },
    connected_at: '2026-05-17T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-05-17T00:00:00Z',
  }
}

function makeDelivery(overrides?: Partial<SocialDelivery & { format?: string }>): SocialDelivery & { format?: string } {
  return {
    id: 'del-1',
    post_id: 'post-1',
    connection_id: 'conn-1',
    provider: 'instagram',
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-05-17T00:00:00Z',
    ...overrides,
  }
}

describe('InstagramProvider', () => {
  let provider: InstagramProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new InstagramProvider((enc: string) => enc.replace('enc-', ''))
  })

  it('publishes a story with media_type=STORIES when delivery format is story', async () => {
    const post = makePost()
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'story' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        media_type: 'STORIES',
        image_url: 'https://blob.vercel.com/stories/test-story.png',
      }),
    )
  })

  it('publishes a regular image post when delivery format is not story', async () => {
    const post = makePost()
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'image_post' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        image_url: 'https://blob.vercel.com/stories/test-story.png',
      }),
    )
    // media_type should be undefined for regular image posts
    const call = vi.mocked(publishInstagramMedia).mock.calls[0]!
    expect(call[2].media_type).toBeUndefined()
  })

  it('publishes a reel when media is video regardless of format', async () => {
    const post = makePost({
      content: {
        title: 'Video Post',
        media_urls: ['https://blob.vercel.com/videos/reel.mp4'],
      },
    })
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'reel' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        video_url: 'https://blob.vercel.com/videos/reel.mp4',
        media_type: 'REELS',
      }),
    )
  })

  it('defaults to STORIES for story format even with unknown file extension', async () => {
    const post = makePost({
      content: {
        title: 'Story Post',
        media_urls: ['https://blob.vercel.com/stories/generated-image'],
      },
    })
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'story' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        media_type: 'STORIES',
        image_url: 'https://blob.vercel.com/stories/generated-image',
      }),
    )
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run packages/social/test/instagram-stories.test.ts`
Expected: Tests fail because `InstagramProvider.publish()` ignores delivery format.

- [ ] **15.2 — Add `format` field to `SocialDelivery` type**

Modify `packages/social/src/core/types.ts` to add the optional `format` field to the `SocialDelivery` interface:

```typescript
// In SocialDelivery interface, after error_type field:
export interface SocialDelivery {
  id: string
  post_id: string
  connection_id: string
  provider: Provider
  status: DeliveryStatus
  platform_post_id: string | null
  platform_url: string | null
  content_override: Record<string, unknown> | null
  attempt: number
  max_attempts: number
  last_error: string | null
  error_type: ErrorType | null
  published_at: string | null
  created_at: string
  format?: 'link_share' | 'image_post' | 'story' | 'reel' | 'link_card' | 'video_share'
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p packages/social/tsconfig.json`

- [ ] **15.3 — Fix InstagramProvider.publish() to respect delivery format**

Modify `packages/social/src/providers/meta/index.ts`, replacing the `InstagramProvider.publish()` method (lines 113-137):

```typescript
export class InstagramProvider implements ISocialProvider {
  readonly provider = 'instagram' as const

  constructor(
    private readonly decryptToken: (enc: string) => string,
  ) {}

  async publish(
    post: SocialPost,
    connection: SocialConnection,
    delivery: SocialDelivery,
  ): Promise<PlatformResult> {
    const token = this.decryptToken(connection.page_token_enc!)
    const igUserId = (connection.metadata as { ig_user_id: string }).ig_user_id
    const caption = formatInstagramCaption(post.content)

    const mediaUrls = post.content.media_urls ?? []
    const firstMedia = mediaUrls[0]

    const isVideo = firstMedia
      ? /\.(mp4|mov|webm)(\?|$)/i.test(firstMedia)
      : false

    // Determine media_type from delivery format first, then file extension
    let mediaType: 'STORIES' | 'REELS' | undefined
    if (delivery.format === 'story') {
      mediaType = 'STORIES'
    } else if (delivery.format === 'reel' || isVideo) {
      mediaType = 'REELS'
    }

    return publishInstagramMedia(igUserId, token, {
      image_url: !isVideo ? firstMedia : undefined,
      video_url: isVideo ? firstMedia : undefined,
      caption,
      media_type: mediaType,
    })
  }

  // ... rest unchanged (deletePost, validateConnection)
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run packages/social/test/instagram-stories.test.ts`
Expected: All 4 tests pass.

- [ ] **15.4 — Update prepareStoryDelivery() to use Konva renderer**

Modify `apps/web/src/lib/social/workflows.ts`, replacing the `prepareStoryDelivery` function (lines 189-232):

```typescript
async function prepareStoryDelivery(
  post: SocialPost,
  delivery: SocialDelivery & { format?: string; template_config?: Record<string, unknown> | null },
): Promise<SocialPost> {
  if (delivery.format !== 'story') return post

  try {
    const { renderTemplate } = await import('@/lib/social/template-renderer')
    const { put } = await import('@vercel/blob')

    const templateId = delivery.template_config?.templateId as string | undefined

    const buffer = await renderTemplate({
      templateId,
      aspectRatio: '9:16',
      data: {
        title: post.content.title ?? '',
        description: post.content.description,
        cover_image: post.content.media_urls?.[0],
        short_url: post.content.url ?? '',
      },
    })

    const blob = await put(
      `stories/${post.id}-${Date.now()}.png`,
      buffer,
      {
        access: 'public',
        addRandomSuffix: false,
      },
    )

    return {
      ...post,
      content: {
        ...post.content,
        media_urls: [blob.url],
      },
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'prepareStoryDelivery', postId: post.id },
    })
    // Fallback: try legacy generator
    try {
      const { generateStoryImage } = await import('./story-generator')
      const { put } = await import('@vercel/blob')
      const template = (delivery.template_config?.template as string) ?? 'card'
      const storyData = {
        title: post.content.title ?? '',
        description: post.content.description,
        domain: 'bythiagofigueiredo.com',
        shortUrl: post.content.url ?? '',
        coverImageUrl: post.content.media_urls?.[0],
      }
      const buffer = await generateStoryImage(template as 'minimal' | 'card' | 'bold', storyData)
      const blob = await put(`stories/${post.id}-${Date.now()}.png`, buffer, {
        access: 'public',
        addRandomSuffix: false,
      })
      return {
        ...post,
        content: { ...post.content, media_urls: [blob.url] },
      }
    } catch (fallbackErr) {
      Sentry.captureException(fallbackErr, {
        tags: { ...SENTRY_TAG, action: 'prepareStoryDelivery:fallback', postId: post.id },
      })
      return post
    }
  }
}
```

Note: `renderTemplate` is the server-side Konva renderer created in Phase 2 Task 7. The fallback to `generateStoryImage` ensures backward compatibility during the transition.

- [ ] **15.5 — Pass delivery format in createSocialPost action**

Modify `apps/web/src/lib/social/actions/posts.ts` to include `format` when creating delivery rows. Update the delivery row creation (around line 103):

```typescript
if (connections && connections.length > 0) {
  const deliveryRows = connections.map((conn) => ({
    post_id: postId,
    connection_id: conn.id as string,
    provider: conn.provider as Provider,
    status: 'pending' as const,
    attempt: 0,
    max_attempts: 3,
    // Set format based on provider and post type
    format: conn.provider === 'instagram' && parsed.data.storyMode
      ? 'story'
      : conn.provider === 'bluesky'
        ? 'link_card'
        : 'link_share',
  }))

  const { error: deliveryError } = await supabase
    .from('social_deliveries')
    .insert(deliveryRows)
```

Also update the `createPostSchema` to accept `storyMode`:

```typescript
const createPostSchema = z.object({
  type: z.enum(['link', 'video', 'image', 'text']),
  content: SocialPostContentSchema,
  platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])).min(1),
  scheduledAt: z.string().datetime().optional(),
  userTimezone: z.string().optional(),
  templateId: z.string().optional(),
  storyMode: z.boolean().optional(),
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run`
Expected: All existing tests pass, no regressions.

---

## Task 16: Canvas Editor (Social)

**Estimated time:** 6h
**Dependencies:** Phase 2 Task 5 (template CRUD), Phase 3 Task 13 (template carousel)
**Branch:** staging (direct commits)

### Overview

Adapt the QR Card Builder (`packages/links-admin/src/components/qr-card-builder/`) for social template editing. The key difference: fixed aspect ratios (9:16, 1:1, 16:9), template gallery organized by aspect ratio, and auto-population from CMS content. Reuse `useCardComposition` and `useCanvasInteraction` hooks directly from `packages/links-admin`.

### Files

| Action | Path |
|--------|------|
| Create | `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx` |
| Create | `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-canvas.tsx` |
| Create | `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-left-panel.tsx` |
| Create | `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-right-panel.tsx` |
| Create | `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-toolbar.tsx` |
| Create | `apps/web/test/cms/social-canvas-editor.test.tsx` |

### Steps

- [ ] **16.1 — Write failing tests for the Canvas Editor shell**

Create `apps/web/test/cms/social-canvas-editor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock react-konva since jsdom has no canvas
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-stage', ...props }, children as React.ReactNode),
  Layer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'konva-layer' }, children),
  Rect: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `konva-rect-${props['id'] ?? 'bg'}` }),
  Image: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `konva-image-${props['id'] ?? 'bg'}` }),
  Text: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `konva-text-${props['id'] ?? 'unnamed'}` }),
  Group: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'konva-group' }, children),
  Transformer: () => React.createElement('div', { 'data-testid': 'konva-transformer' }),
}))

vi.mock('konva', () => ({}))

// Must import AFTER mocks
const { SocialCanvasEditor } = await import(
  '@/app/cms/(authed)/social/new/_components/canvas-editor/index'
)

const SOCIAL_ASPECT_RATIOS = [
  { name: '9:16', width: 1080, height: 1920, label: 'Story' },
  { name: '1:1', width: 1080, height: 1080, label: 'Square' },
  { name: '16:9', width: 1280, height: 720, label: 'Landscape' },
] as const

describe('SocialCanvasEditor', () => {
  const defaultProps = {
    aspectRatio: '9:16' as const,
    templates: [],
    postData: {
      title: 'My Blog Post Title',
      description: 'A brief description of the post',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      shortUrl: 'go.btf.com/abc123',
    },
    onExport: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.com/story.png' }),
    onSaveTemplate: vi.fn().mockResolvedValue(undefined),
    onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
    onImageUpload: vi.fn().mockResolvedValue('https://blob.vercel.com/uploaded.png'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the three-panel layout', () => {
    render(<SocialCanvasEditor {...defaultProps} />)
    expect(screen.getByRole('application')).toBeInTheDocument()
    expect(screen.getByText('Story')).toBeInTheDocument() // aspect ratio label
  })

  it('displays fixed aspect ratio options without custom sizing', () => {
    render(<SocialCanvasEditor {...defaultProps} />)
    // Should show all 3 preset buttons
    for (const ratio of SOCIAL_ASPECT_RATIOS) {
      expect(screen.getByText(ratio.label)).toBeInTheDocument()
    }
  })

  it('shows canvas dimensions in status bar', () => {
    render(<SocialCanvasEditor {...defaultProps} />)
    expect(screen.getByText('1080×1920')).toBeInTheDocument()
  })

  it('shows viewport-too-small message on narrow screens', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    window.dispatchEvent(new Event('resize'))
    render(<SocialCanvasEditor {...defaultProps} />)
    expect(screen.getByText('Desktop Required')).toBeInTheDocument()
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/social-canvas-editor.test.tsx`
Expected: Tests fail because the component does not exist.

- [ ] **16.2 — Create the SocialToolbar component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-toolbar.tsx`:

```tsx
'use client'
import { useState } from 'react'
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  Grid3X3, Magnet, Save, Download, Move, Scissors,
} from 'lucide-react'

interface SocialToolbarProps {
  aspectRatioLabel: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
  guidesVisible: boolean
  onToggleGuides: () => void
  gridVisible: boolean
  onToggleGrid: () => void
  clipOverflow: boolean
  onToggleClipOverflow: () => void
  isSaving: boolean
  onOpenTemplates: () => void
  onExport: () => void
  onSaveAsTemplate: () => void
  onPositionElement: (position: PositionAnchor) => void
  hasSelection: boolean
}

export type PositionAnchor = 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br'

const POSITION_LABELS: Record<PositionAnchor, string> = {
  tl: 'Top Left', tc: 'Top Center', tr: 'Top Right',
  cl: 'Center Left', cc: 'Center', cr: 'Center Right',
  bl: 'Bottom Left', bc: 'Bottom Center', br: 'Bottom Right',
}

function PositionPopover({ onPosition, onClose }: { onPosition: (p: PositionAnchor) => void; onClose: () => void }) {
  const anchors: PositionAnchor[] = ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br']
  return (
    <div className="absolute top-full mt-1 left-0 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2 z-50">
      <p className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1.5 px-0.5">Position on Canvas</p>
      <div className="grid grid-cols-3 gap-1 w-[84px]">
        {anchors.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => { onPosition(a); onClose() }}
            className="w-6 h-6 rounded border border-neutral-600 hover:border-blue-500 hover:bg-blue-600/20 flex items-center justify-center transition-colors"
            title={POSITION_LABELS[a]}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${a === 'cc' ? 'bg-blue-400' : 'bg-neutral-400'}`} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function SocialToolbar({
  aspectRatioLabel, canUndo, canRedo, onUndo, onRedo,
  zoom, onZoomIn, onZoomOut, onFitToView,
  guidesVisible, onToggleGuides, gridVisible, onToggleGrid,
  clipOverflow, onToggleClipOverflow,
  isSaving, onOpenTemplates, onExport, onSaveAsTemplate,
  onPositionElement, hasSelection,
}: SocialToolbarProps) {
  const [showPosition, setShowPosition] = useState(false)

  return (
    <div className="h-10 bg-neutral-900 border-b border-neutral-800 flex items-center px-3 gap-1">
      <div className="flex items-center gap-1 text-[11px] text-neutral-400 mr-4">
        <span className="hover:text-neutral-200 cursor-pointer">Social</span>
        <span>/</span>
        <span className="text-blue-400">{aspectRatioLabel}</span>
      </div>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Undo" aria-label="Undo">
        <Undo2 size={15} />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Redo" aria-label="Redo">
        <Redo2 size={15} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onZoomOut} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Zoom out" aria-label="Zoom out">
        <ZoomOut size={15} />
      </button>
      <span className="text-[11px] text-neutral-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={onZoomIn} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Zoom in" aria-label="Zoom in">
        <ZoomIn size={15} />
      </button>
      <button type="button" onClick={onFitToView} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Fit to view" aria-label="Fit to view">
        <Maximize size={14} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onToggleGuides} className={`p-1.5 rounded ${guidesVisible ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white`} title="Snap guides" aria-label="Toggle snap guides">
        <Magnet size={14} />
      </button>
      <button type="button" onClick={onToggleGrid} className={`p-1.5 rounded ${gridVisible ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white`} title="Snap to grid" aria-label="Toggle grid">
        <Grid3X3 size={14} />
      </button>
      <button type="button" onClick={onToggleClipOverflow} className={`p-1.5 rounded ${clipOverflow ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white`} title="Clip overflow" aria-label="Toggle clip overflow">
        <Scissors size={14} />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPosition(!showPosition)}
          disabled={!hasSelection}
          className={`p-1.5 rounded ${showPosition ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white disabled:opacity-30`}
          title="Position element"
          aria-label="Position element on canvas"
        >
          <Move size={14} />
        </button>
        {showPosition && hasSelection && (
          <PositionPopover onPosition={onPositionElement} onClose={() => setShowPosition(false)} />
        )}
      </div>

      <div className="flex-1" />

      {isSaving && <span className="text-[10px] text-neutral-500 mr-2">Saving...</span>}

      <button type="button" onClick={onOpenTemplates} className="px-2.5 py-1 rounded border border-neutral-700 text-[11px] text-neutral-300 hover:border-neutral-500 mr-1" aria-label="Templates">
        <Save size={13} className="inline mr-1" />Templates
      </button>
      <button type="button" onClick={onSaveAsTemplate} className="px-2.5 py-1 rounded border border-neutral-700 text-[11px] text-neutral-300 hover:border-neutral-500 mr-1" aria-label="Save as template">
        Save as Template
      </button>
      <button type="button" onClick={onExport} className="px-2.5 py-1 rounded bg-blue-600 text-[11px] text-white hover:bg-blue-500" aria-label="Export">
        <Download size={13} className="inline mr-1" />Export
      </button>
    </div>
  )
}
```

- [ ] **16.3 — Create the SocialLeftPanel component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-left-panel.tsx`:

```tsx
'use client'
import { useState, useCallback } from 'react'
import { Type, ImagePlus, Square, Circle, Loader2 } from 'lucide-react'
import {
  MAX_ELEMENTS,
  createTextElement,
  createImageElement,
  nextElementName,
} from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import type { UseCanvasInteractionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'
import { ColorPicker } from '@tn-figueiredo/links-admin/qr-card-builder/color-picker'
import { LayersPanel } from '@tn-figueiredo/links-admin/qr-card-builder/layers-panel'

export const SOCIAL_ASPECT_RATIOS = [
  { name: '9:16' as const, width: 1080, height: 1920, label: 'Story' },
  { name: '1:1' as const, width: 1080, height: 1080, label: 'Square' },
  { name: '16:9' as const, width: 1280, height: 720, label: 'Landscape' },
] as const

export type SocialAspectRatio = (typeof SOCIAL_ASPECT_RATIOS)[number]['name']

interface SocialLeftPanelProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  onImageUpload: (file: File) => Promise<string>
  onOpenMediaGallery: () => void
  aspectRatio: SocialAspectRatio
  onAspectRatioChange: (ratio: SocialAspectRatio) => void
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  onLoadTemplate: (templateId: string) => void
}

type BgTab = 'solid' | 'image' | 'gradient'

export function SocialLeftPanel({
  comp, interaction, onImageUpload, onOpenMediaGallery,
  aspectRatio, onAspectRatioChange, templates, onLoadTemplate,
}: SocialLeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement, updateElement, removeElement, reorderElements } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(composition.background.type as BgTab)
  const [isUploading, setIsUploading] = useState(false)

  const handleAspectRatio = useCallback((ratio: SocialAspectRatio) => {
    const preset = SOCIAL_ASPECT_RATIOS.find(r => r.name === ratio)
    if (!preset) return
    onAspectRatioChange(ratio)
    setCanvas({ width: preset.width, height: preset.height, aspectRatio: preset.name })
  }, [setCanvas, onAspectRatioChange])

  const handleAddText = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    const name = nextElementName(composition.elements, 'text')
    addElement(createTextElement(id, composition.canvas.width, composition.canvas.height, name))
    select(id)
  }, [composition, addElement, select])

  const handleAddImage = useCallback(async () => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > 5 * 1024 * 1024) return
      setIsUploading(true)
      try {
        const localUrl = URL.createObjectURL(file)
        const { naturalWidth, naturalHeight } = await new Promise<HTMLImageElement>(resolve => {
          const img = new window.Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(img)
          img.src = localUrl
        })
        URL.revokeObjectURL(localUrl)
        const remoteUrl = await onImageUpload(file)
        if (!remoteUrl) return
        const id = crypto.randomUUID()
        const name = nextElementName(composition.elements, 'image')
        addElement(createImageElement(id, remoteUrl, composition.canvas.width, composition.canvas.height, naturalWidth, naturalHeight, name))
        select(id)
      } finally {
        setIsUploading(false)
      }
    }
    input.click()
  }, [composition, addElement, select, onImageUpload])

  const handleSolidColor = useCallback((color: string) => {
    setBackground({ type: 'solid', color })
  }, [setBackground])

  const filteredTemplates = templates.filter(t => t.aspectRatio === aspectRatio)
  const bg = composition.background

  return (
    <aside className="w-[252px] shrink-0 bg-neutral-900 border-r border-neutral-800 overflow-y-auto flex flex-col">
      {/* Aspect Ratio — fixed presets only, no custom */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Aspect Ratio</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {SOCIAL_ASPECT_RATIOS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleAspectRatio(preset.name)}
              className={`p-1.5 rounded text-[10px] text-center border ${
                aspectRatio === preset.name
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
              }`}
            >
              <div className="font-medium">{preset.label}</div>
              <div className="text-neutral-500">{preset.width}x{preset.height}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Add Elements */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Add to Canvas</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleAddText} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Type size={18} />Text
          </button>
          <button type="button" onClick={handleAddImage} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS || isUploading}>
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {isUploading ? 'Uploading...' : 'Image'}
          </button>
          <button type="button" onClick={onOpenMediaGallery} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Square size={18} />Gallery
          </button>
        </div>
      </section>

      {/* Background */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Background</h3>
        <div className="flex gap-1 mb-2">
          {(['solid', 'image', 'gradient'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setBgTab(tab)
                if (tab === 'solid' && bg.type !== 'solid') setBackground({ type: 'solid', color: '#0a0a0a' })
                if (tab === 'gradient' && bg.type !== 'gradient') setBackground({ type: 'gradient', angle: 180, stops: [{ color: '#0a0a0a', position: 0 }, { color: '#1a1a2e', position: 1 }] })
              }}
              className={`flex-1 py-1 rounded text-[10px] ${bgTab === tab ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {bgTab === 'solid' && bg.type === 'solid' && (
          <ColorPicker value={bg.color} onChange={handleSolidColor} label="Color" />
        )}
      </section>

      {/* Template Gallery */}
      {filteredTemplates.length > 0 && (
        <section className="p-3 border-b border-neutral-800">
          <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Templates</h3>
          <div className="grid grid-cols-2 gap-2">
            {filteredTemplates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onLoadTemplate(t.id)}
                className="rounded border border-neutral-700 hover:border-blue-500 overflow-hidden"
              >
                {t.thumbnailUrl ? (
                  <img src={t.thumbnailUrl} alt={t.name} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-500">
                    {t.name}
                  </div>
                )}
                <p className="text-[9px] text-neutral-400 px-1 py-0.5 truncate">{t.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Layers */}
      <section className="p-3 flex-1">
        <LayersPanel
          elements={composition.elements}
          selectedIds={selectedIds}
          onSelect={select}
          onReorder={reorderElements}
          onUpdateElement={updateElement}
        />
      </section>
    </aside>
  )
}
```

- [ ] **16.4 — Create the SocialRightPanel component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-right-panel.tsx`:

```tsx
'use client'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import { TextInspector } from '@tn-figueiredo/links-admin/qr-card-builder/text-inspector'
import { ImageInspector } from '@tn-figueiredo/links-admin/qr-card-builder/image-inspector'
import { MultiInspector } from '@tn-figueiredo/links-admin/qr-card-builder/multi-inspector'

interface SocialRightPanelProps {
  composition: CardComposition
  selectedIds: Set<string>
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
  onRemoveElement: (id: string) => void
  onReplaceImage: (elementId: string) => void
}

export function SocialRightPanel({
  composition, selectedIds,
  onUpdateElement, onRemoveElement, onReplaceImage,
}: SocialRightPanelProps) {
  const selectedElements = composition.elements.filter(el => selectedIds.has(el.id))

  if (selectedElements.length === 0) {
    return (
      <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <div className="mt-8 text-center">
          <p className="text-[11px] text-neutral-500">Select an element to edit its properties</p>
          <p className="text-[10px] text-neutral-600 mt-2">Tip: Use the left panel to add text, images, or load a template</p>
        </div>
      </aside>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <MultiInspector
          elements={selectedElements}
          onUpdateAll={patch => selectedElements.forEach(el => onUpdateElement(el.id, patch))}
          onDeleteAll={() => selectedElements.forEach(el => onRemoveElement(el.id))}
          onLockAll={() => selectedElements.forEach(el => onUpdateElement(el.id, { locked: true }))}
          onAlign={() => {}}
        />
      </aside>
    )
  }

  const element = selectedElements[0]!

  return (
    <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
      <h3 className="text-sm font-medium text-neutral-200 truncate mb-3">
        {element.name || (element.type === 'text' ? 'Text' : 'Image')}
      </h3>
      {element.type === 'text' && (
        <TextInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'image' && (
        <ImageInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onReplaceImage={() => onReplaceImage(element.id)}
        />
      )}
    </aside>
  )
}
```

- [ ] **16.5 — Create the SocialCanvas component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-canvas.tsx`.

This is a streamlined version of the QR Card Builder's `canvas-editor.tsx` without QR-specific nodes. Import from `react-konva` and reuse the same `BackgroundRect`, `TextNode`, and `ImageNode` rendering patterns but without QR code support:

```tsx
'use client'
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Group } from 'react-konva'
import type Konva from 'konva'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import type { UseCanvasInteractionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'

interface SocialCanvasProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  containerWidth: number
  containerHeight: number
}

export interface SocialCanvasHandle {
  getStage: () => Konva.Stage | null
}

type ImageLoadState = { image: HTMLImageElement | null; loading: boolean; error: boolean }

function useLoadedImage(src: string | null): ImageLoadState {
  const [state, setState] = useState<ImageLoadState>({ image: null, loading: false, error: false })
  useEffect(() => {
    if (!src) { setState({ image: null, loading: false, error: false }); return }
    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: false }))
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { if (!cancelled) setState({ image: img, loading: false, error: false }) }
    img.onerror = () => { if (!cancelled) setState({ image: null, loading: false, error: true }) }
    img.src = src
    return () => { cancelled = true }
  }, [src])
  return state
}

function TextNode({
  element, onSelect, onDragMove, onDragEnd,
}: {
  element: CardElement & { type: 'text' }
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
}) {
  const text = element.uppercase ? element.content.toUpperCase() : element.content
  const textRef = useRef<Konva.Text>(null)
  const [textHeight, setTextHeight] = useState(element.fontSize * element.lineHeight)

  useEffect(() => {
    if (textRef.current) setTextHeight(textRef.current.height())
  }, [text, element.fontSize, element.fontFamily, element.fontWeight, element.lineHeight, element.letterSpacing, element.width])

  const pad = element.backgroundColor ? (element.backgroundPadding ?? 8) : 0
  const radius = element.backgroundColor ? (element.backgroundRadius ?? 4) : 0

  return (
    <Group
      id={element.id}
      x={element.x - pad}
      y={element.y - pad}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {element.backgroundColor && (
        <Rect
          width={element.width + pad * 2}
          height={textHeight + pad * 2}
          fill={element.backgroundColor}
          cornerRadius={radius}
        />
      )}
      <KonvaText
        ref={textRef}
        text={text}
        x={pad}
        y={pad}
        width={element.width}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
        fill={element.color}
        align={element.align}
        lineHeight={element.lineHeight}
        letterSpacing={parseFloat(element.letterSpacing) * element.fontSize}
      />
    </Group>
  )
}

function ImageNode({
  element, onSelect, onDragMove, onDragEnd,
}: {
  element: CardElement & { type: 'image' }
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
}) {
  const { image, error } = useLoadedImage(element.src)
  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {element.borderWidth > 0 && (
        <Rect
          x={-element.borderWidth}
          y={-element.borderWidth}
          width={element.width + element.borderWidth * 2}
          height={element.height + element.borderWidth * 2}
          fill={element.borderColor}
          cornerRadius={element.borderRadius + element.borderWidth}
        />
      )}
      {image ? (
        <KonvaImage image={image} width={element.width} height={element.height} cornerRadius={element.borderRadius} />
      ) : (
        <>
          <Rect width={element.width} height={element.height} fill={error ? '#331111' : '#1a1a2e'} cornerRadius={element.borderRadius} stroke={error ? '#662222' : '#2a2a4a'} strokeWidth={1} />
          <KonvaText text={error ? 'Failed to load' : 'Loading...'} x={0} y={element.height / 2 - 8} width={element.width} fontSize={13} fontFamily="Inter" fill={error ? '#cc4444' : '#6a6a9a'} align="center" />
        </>
      )}
    </Group>
  )
}

function BackgroundRect({ composition }: { composition: CardComposition }) {
  const { canvas, background } = composition
  const { image: bgImage } = useLoadedImage(background.type === 'image' ? background.url : null)

  if (background.type === 'solid') {
    return <Rect width={canvas.width} height={canvas.height} fill={background.color} />
  }
  if (background.type === 'image') {
    return (
      <>
        <Rect width={canvas.width} height={canvas.height} fill={background.fallbackColor} />
        {bgImage && <KonvaImage image={bgImage} width={canvas.width} height={canvas.height} />}
      </>
    )
  }
  // gradient
  const rad = (background.angle * Math.PI) / 180
  const hw = canvas.width / 2
  const hh = canvas.height / 2
  return (
    <Rect
      width={canvas.width}
      height={canvas.height}
      fillLinearGradientStartPoint={{ x: hw - Math.cos(rad) * hw, y: hh - Math.sin(rad) * hh }}
      fillLinearGradientEndPoint={{ x: hw + Math.cos(rad) * hw, y: hh + Math.sin(rad) * hh }}
      fillLinearGradientColorStops={background.stops.flatMap(s => [s.position, s.color])}
    />
  )
}

export const SocialCanvas = forwardRef<SocialCanvasHandle, SocialCanvasProps>(function SocialCanvas(
  { comp, interaction, containerWidth, containerHeight },
  ref,
) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { composition, updateElement } = comp
  const { selectedIds, select, multiSelect, deselectAll, zoom, clipOverflow, openContextMenu } = interaction

  useImperativeHandle(ref, () => ({
    getStage: () => stageRef.current,
  }), [])

  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const nodes = Array.from(selectedIds)
      .map(id => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => n !== null && n !== undefined)
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, composition.elements])

  const handleSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true
    if ('shiftKey' in e.evt && e.evt.shiftKey) {
      multiSelect(id)
    } else {
      select(id)
    }
  }, [select, multiSelect])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) deselectAll()
  }, [deselectAll])

  const snapThreshold = 8
  const gridSize = 20

  const snapValue = useCallback((val: number, targets: number[]): number => {
    for (const t of targets) {
      if (Math.abs(val - t) < snapThreshold) return t
    }
    return val
  }, [])

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const cw = composition.canvas.width
    const ch = composition.canvas.height
    let x = node.x()
    let y = node.y()
    const w = node.width() * node.scaleX()
    const h = node.height() * node.scaleY()

    if (interaction.gridVisible) {
      x = Math.round(x / gridSize) * gridSize
      y = Math.round(y / gridSize) * gridSize
      node.x(x)
      node.y(y)
      return
    }

    if (interaction.guidesVisible) {
      const cx = x + w / 2
      const cy = y + h / 2
      const snapTargetsX = [0, cw / 2, cw, cw / 2 - w / 2]
      const snapTargetsY = [0, ch / 2, ch, ch / 2 - h / 2]
      const snappedX = snapValue(x, snapTargetsX)
      const snappedCx = snapValue(cx, [cw / 2])
      const snappedRight = snapValue(x + w, [cw])
      const snappedY = snapValue(y, snapTargetsY)
      const snappedCy = snapValue(cy, [ch / 2])
      const snappedBottom = snapValue(y + h, [ch])

      if (snappedCx !== cx) x = snappedCx - w / 2
      else if (snappedX !== x) x = snappedX
      else if (snappedRight !== x + w) x = snappedRight - w

      if (snappedCy !== cy) y = snappedCy - h / 2
      else if (snappedY !== y) y = snappedY
      else if (snappedBottom !== y + h) y = snappedBottom - h

      node.x(x)
      node.y(y)
    }
  }, [composition.canvas.width, composition.canvas.height, interaction.gridVisible, interaction.guidesVisible, snapValue])

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const id = node.id()
    if (!id) return
    updateElement(id, { x: node.x(), y: node.y() })
  }, [updateElement])

  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const id = node.id()
    if (!id) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    updateElement(id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(10, node.width() * scaleX),
      height: Math.max(10, node.height() * scaleY),
      rotation: node.rotation(),
    })
  }, [updateElement])

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    let node: Konva.Node | null = e.target
    let elId: string | null = null
    while (node && node !== stage) {
      const id = node.id()
      if (id && composition.elements.some(el => el.id === id)) { elId = id; break }
      node = node.parent
    }
    if (elId && !selectedIds.has(elId)) select(elId)
    openContextMenu(pos.x, pos.y, elId)
  }, [selectedIds, select, openContextMenu, composition.elements])

  const renderElement = (el: CardElement) => {
    switch (el.type) {
      case 'text':
        return <TextNode key={el.id} element={el} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
      case 'image':
        return <ImageNode key={el.id} element={el} onSelect={handleSelect} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
      default:
        return null
    }
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: containerWidth,
        height: containerHeight,
        backgroundImage: 'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%)',
        backgroundSize: '20px 20px',
      }}
    >
      <Stage
        ref={stageRef}
        width={containerWidth}
        height={containerHeight}
        scaleX={zoom}
        scaleY={zoom}
        offsetX={-(containerWidth / zoom - composition.canvas.width) / 2}
        offsetY={-(containerHeight / zoom - composition.canvas.height) / 2}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={handleContextMenu}
      >
        <Layer>
          <Rect x={-2} y={-2} width={composition.canvas.width + 4} height={composition.canvas.height + 4} fill="rgba(0,0,0,0.3)" cornerRadius={2} />
          <BackgroundRect composition={composition} />
          {interaction.gridVisible && (
            <Group listening={false} opacity={0.15}>
              {Array.from({ length: Math.ceil(composition.canvas.width / gridSize) - 1 }, (_, i) => (
                <Rect key={`gv${i}`} x={(i + 1) * gridSize} y={0} width={0.5} height={composition.canvas.height} fill="#888" />
              ))}
              {Array.from({ length: Math.ceil(composition.canvas.height / gridSize) - 1 }, (_, i) => (
                <Rect key={`gh${i}`} x={0} y={(i + 1) * gridSize} width={composition.canvas.width} height={0.5} fill="#888" />
              ))}
            </Group>
          )}
          {interaction.guidesVisible && (
            <Group listening={false}>
              <Rect x={composition.canvas.width / 2} y={0} width={0.5} height={composition.canvas.height} fill="#f97316" opacity={0.3} />
              <Rect x={0} y={composition.canvas.height / 2} width={composition.canvas.width} height={0.5} fill="#f97316" opacity={0.3} />
            </Group>
          )}
          <Group clipFunc={clipOverflow ? (ctx: { rect: (x: number, y: number, w: number, h: number) => void }) => { ctx.rect(0, 0, composition.canvas.width, composition.canvas.height) } : undefined}>
            {composition.elements.map(renderElement)}
          </Group>
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox
              return newBox
            }}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
}
```

- [ ] **16.6 — Create the main SocialCanvasEditor shell**

Create `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx`:

```tsx
'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { useCardComposition } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import { useCanvasInteraction } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'
import { ContextMenu } from '@tn-figueiredo/links-admin/qr-card-builder/context-menu'
import type { ContextMenuEntry } from '@tn-figueiredo/links-admin/qr-card-builder/context-menu'
import { ExportModal } from '@tn-figueiredo/links-admin/qr-card-builder/export-modal'
import { TemplateBrowser } from '@tn-figueiredo/links-admin/qr-card-builder/template-browser'
import type { QrTemplate } from '@tn-figueiredo/links-admin/qr-card-builder/template-browser'
import { SocialCanvas } from './social-canvas'
import type { SocialCanvasHandle } from './social-canvas'
import { SocialLeftPanel, SOCIAL_ASPECT_RATIOS } from './social-left-panel'
import type { SocialAspectRatio } from './social-left-panel'
import { SocialRightPanel } from './social-right-panel'
import { SocialToolbar } from './social-toolbar'
import type { PositionAnchor } from './social-toolbar'

export interface SocialPostData {
  title: string
  description?: string
  coverImageUrl?: string
  logoUrl?: string
  shortUrl?: string
}

export interface SocialCanvasEditorProps {
  aspectRatio: SocialAspectRatio
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  postData: SocialPostData
  onExport: (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
}

function getDefaultComposition(ratio: SocialAspectRatio): CardComposition {
  const preset = SOCIAL_ASPECT_RATIOS.find(r => r.name === ratio)!
  return {
    canvas: { width: preset.width, height: preset.height, aspectRatio: preset.name },
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [],
  }
}

function hydrateComposition(composition: CardComposition, data: SocialPostData): CardComposition {
  const hydratedElements = composition.elements.map(el => {
    if (el.type === 'text') {
      let content = el.content
      content = content.replace(/\{\{title\}\}/g, data.title)
      content = content.replace(/\{\{description\}\}/g, data.description ?? '')
      content = content.replace(/\{\{short_url\}\}/g, data.shortUrl ?? '')
      return { ...el, content }
    }
    if (el.type === 'image') {
      let src = el.src
      if (src === '{{cover_image}}' && data.coverImageUrl) src = data.coverImageUrl
      if (src === '{{logo}}' && data.logoUrl) src = data.logoUrl
      return { ...el, src }
    }
    return el
  })
  return { ...composition, elements: hydratedElements }
}

export function SocialCanvasEditor({
  aspectRatio: initialRatio, templates, postData,
  onExport, onSaveTemplate, onDeleteTemplate, onImageUpload,
}: SocialCanvasEditorProps) {
  const [aspectRatio, setAspectRatio] = useState<SocialAspectRatio>(initialRatio)
  const comp = useCardComposition(getDefaultComposition(initialRatio))
  const interaction = useCanvasInteraction()
  const canvasRef = useRef<SocialCanvasHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [showExport, setShowExport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [viewportTooSmall, setViewportTooSmall] = useState(false)
  const [showMediaGallery, setShowMediaGallery] = useState(false)

  useEffect(() => {
    function check() { setViewportTooSmall(window.innerWidth < 960) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keyboard shortcuts (same as QR Card Builder)
  const compRef = useRef(comp)
  const interactionRef = useRef(interaction)
  const containerSizeRef = useRef(containerSize)
  compRef.current = comp
  interactionRef.current = interaction
  containerSizeRef.current = containerSize

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const c = compRef.current
      const ix = interactionRef.current
      const cs = containerSizeRef.current
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 'z' && !e.shiftKey) { e.preventDefault(); c.undo() }
      if (cmd && e.key === 'z' && e.shiftKey) { e.preventDefault(); c.redo() }
      if (cmd && e.key === 'g' && !e.shiftKey) { e.preventDefault(); ix.toggleGuides() }
      if (cmd && e.key === '0') { e.preventDefault(); ix.fitToView(cs.width, cs.height, c.composition.canvas.width, c.composition.canvas.height) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
        e.preventDefault()
        ix.selectedIds.forEach(id => c.removeElement(id))
        ix.deselectAll()
      }
      if (cmd && e.key === 'd') {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const el = c.composition.elements.find(e => e.id === id)
          if (el) c.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 })
        })
      }
      if (cmd && e.key === 'l') {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const el = c.composition.elements.find(e => e.id === id)
          if (el) c.updateElement(id, { locked: !el.locked })
        })
      }
      if (cmd && e.key === ']' && !e.shiftKey) {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const idx = c.composition.elements.findIndex(e => e.id === id)
          if (idx < c.composition.elements.length - 1) c.reorderElements(idx, idx + 1)
        })
      }
      if (cmd && e.key === '[' && !e.shiftKey) {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const idx = c.composition.elements.findIndex(e => e.id === id)
          if (idx > 0) c.reorderElements(idx, idx - 1)
        })
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !cmd && ix.selectedIds.size > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        ix.selectedIds.forEach(id => {
          const el = c.composition.elements.find(e => e.id === id)
          if (el && !el.locked) c.updateElement(id, { x: Math.round(el.x + dx), y: Math.round(el.y + dy) })
        })
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const handleReplaceImage = useCallback((elementId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > 5 * 1024 * 1024) return
      try {
        const remoteUrl = await onImageUpload(file)
        if (remoteUrl) comp.updateElement(elementId, { src: remoteUrl })
      } catch (err) {
        console.error('[Social Canvas] Replace image failed:', err)
      }
    }
    input.click()
  }, [comp, onImageUpload])

  const handlePositionElement = useCallback((position: PositionAnchor) => {
    const cw = comp.composition.canvas.width
    const ch = comp.composition.canvas.height
    interaction.selectedIds.forEach(id => {
      const el = comp.composition.elements.find(e => e.id === id)
      if (!el) return
      let x = el.x
      let y = el.y
      const col = position[1]
      const row = position[0]
      if (col === 'l') x = 0
      else if (col === 'c') x = (cw - el.width) / 2
      else if (col === 'r') x = cw - el.width
      if (row === 't') y = 0
      else if (row === 'c') y = (ch - el.height) / 2
      else if (row === 'b') y = ch - el.height
      comp.updateElement(id, { x, y })
    })
  }, [comp, interaction.selectedIds])

  const handleLoadTemplate = useCallback(async (templateId: string) => {
    // Fetch template composition from server (assumes templates prop includes composition)
    // For now, load from the templates array which should include a composition field
    // The parent component fetches full template data when selected
    const template = templates.find(t => t.id === templateId)
    if (!template) return
    // Template loading would fetch the full composition from the server action
    // This is a placeholder for the actual fetch
  }, [templates])

  const handleSaveAsTemplate = useCallback(async () => {
    if (!saveTemplateName.trim()) return
    const stage = canvasRef.current?.getStage()
    if (!stage) return
    setIsSaving(true)
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: 0.5 })
      const res = await fetch(dataUrl)
      const thumbnail = await res.blob()
      await onSaveTemplate(saveTemplateName, comp.composition, thumbnail)
      setShowSaveTemplate(false)
      setSaveTemplateName('')
    } finally {
      setIsSaving(false)
    }
  }, [saveTemplateName, comp.composition, onSaveTemplate])

  const handleExport = useCallback(async () => {
    const stage = canvasRef.current?.getStage()
    if (!stage) return
    const blob = await new Promise<Blob | null>((resolve) => {
      stage.toBlob({
        pixelRatio: 1,
        callback: (b: Blob | null) => resolve(b),
      })
    })
    if (!blob) return
    await onExport(blob, {
      format: 'png',
      scale: 1,
      width: comp.composition.canvas.width,
      height: comp.composition.canvas.height,
    })
  }, [comp.composition, onExport])

  const contextMenuItems = useCallback((): ContextMenuEntry[] => {
    const cm = interaction.contextMenu
    if (!cm?.elementId) return []
    const el = comp.composition.elements.find(e => e.id === cm.elementId)
    if (!el) return []
    const idx = comp.composition.elements.indexOf(el)
    return [
      { label: 'Bring Forward', shortcut: 'Ctrl+]', onClick: () => { if (idx < comp.composition.elements.length - 1) comp.reorderElements(idx, idx + 1) } },
      { label: 'Send Backward', shortcut: 'Ctrl+[', onClick: () => { if (idx > 0) comp.reorderElements(idx, idx - 1) } },
      { separator: true },
      { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: () => comp.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }) },
      { label: el.locked ? 'Unlock' : 'Lock', shortcut: 'Ctrl+L', onClick: () => comp.updateElement(el.id, { locked: !el.locked }) },
      { separator: true },
      { label: 'Delete', shortcut: 'Del', onClick: () => { comp.removeElement(el.id); interaction.deselectAll() } },
    ]
  }, [interaction.contextMenu, comp, interaction])

  const currentPreset = SOCIAL_ASPECT_RATIOS.find(r => r.name === aspectRatio)!

  if (viewportTooSmall) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-[16px] text-neutral-300 font-medium mb-2">Desktop Required</p>
          <p className="text-[13px] text-neutral-500">This editor requires a desktop viewport (960px+).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col" role="application" aria-label="Social canvas editor">
      <SocialToolbar
        aspectRatioLabel={currentPreset.label}
        canUndo={comp.canUndo}
        canRedo={comp.canRedo}
        onUndo={comp.undo}
        onRedo={comp.redo}
        zoom={interaction.zoom}
        onZoomIn={() => interaction.setZoom(interaction.zoom + 0.1)}
        onZoomOut={() => interaction.setZoom(interaction.zoom - 0.1)}
        onFitToView={() => interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height)}
        guidesVisible={interaction.guidesVisible}
        onToggleGuides={interaction.toggleGuides}
        gridVisible={interaction.gridVisible}
        onToggleGrid={interaction.toggleGrid}
        clipOverflow={interaction.clipOverflow}
        onToggleClipOverflow={interaction.toggleClipOverflow}
        isSaving={isSaving}
        onOpenTemplates={() => setShowTemplates(true)}
        onExport={handleExport}
        onSaveAsTemplate={() => setShowSaveTemplate(true)}
        onPositionElement={handlePositionElement}
        hasSelection={interaction.selectedIds.size > 0}
      />

      <div className="flex flex-1 overflow-hidden">
        <SocialLeftPanel
          comp={comp}
          interaction={interaction}
          onImageUpload={onImageUpload}
          onOpenMediaGallery={() => setShowMediaGallery(true)}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          templates={templates}
          onLoadTemplate={handleLoadTemplate}
        />

        <div ref={containerRef} className="flex-1 overflow-hidden">
          <SocialCanvas
            ref={canvasRef}
            comp={comp}
            interaction={interaction}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        </div>

        <SocialRightPanel
          composition={comp.composition}
          selectedIds={interaction.selectedIds}
          onUpdateElement={comp.updateElement}
          onRemoveElement={comp.removeElement}
          onReplaceImage={handleReplaceImage}
        />
      </div>

      {/* Status bar */}
      <div className="h-[22px] bg-neutral-900 border-t border-neutral-800 flex items-center px-3 gap-4 text-[10px] text-neutral-500">
        <span>{comp.composition.canvas.width}x{comp.composition.canvas.height}</span>
        <span>{currentPreset.label}</span>
        <span>{comp.composition.elements.length} elements</span>
      </div>

      {/* Save as Template dialog */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) setShowSaveTemplate(false) }}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-[400px]">
            <h3 className="text-lg font-semibold text-neutral-200 mb-4">Save as Template</h3>
            <input
              type="text"
              value={saveTemplateName}
              onChange={e => setSaveTemplateName(e.target.value)}
              placeholder="Template name"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 mb-2"
              autoFocus
            />
            <p className="text-[11px] text-neutral-500 mb-4">Aspect ratio: {currentPreset.label} ({currentPreset.name})</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowSaveTemplate(false)} className="px-4 py-2 rounded border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500">Cancel</button>
              <button type="button" onClick={handleSaveAsTemplate} disabled={!saveTemplateName.trim() || isSaving} className="px-4 py-2 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {interaction.contextMenu && (
        <ContextMenu
          x={interaction.contextMenu.x}
          y={interaction.contextMenu.y}
          items={contextMenuItems()}
          onClose={interaction.closeContextMenu}
        />
      )}
    </div>
  )
}
```

- [ ] **16.7 — Run tests and verify**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/social-canvas-editor.test.tsx`
Expected: All tests pass.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run`
Expected: No regressions.

---

## Task 17: Notification System (Telegram + Email)

**Estimated time:** 4h
**Dependencies:** Task 15 (delivery format routing)
**Branch:** staging (direct commits)

### Overview

Implement a tiered notification system: Telegram Bot as primary channel, email via Resend as fallback. When a Story is generated and requires manual link sticker attachment, the system notifies the user through the first available channel.

### Files

| Action | Path |
|--------|------|
| Create | `apps/web/src/lib/social/notifications/telegram.ts` |
| Create | `apps/web/src/lib/social/notifications/email-fallback.ts` |
| Create | `apps/web/src/lib/social/notifications/notify-story-ready.ts` |
| Create | `apps/web/src/app/cms/(authed)/settings/notifications/_components/telegram-connect.tsx` |
| Create | `apps/web/src/app/api/webhooks/telegram/route.ts` |
| Create | `apps/web/test/social-notifications.test.ts` |

### Steps

- [ ] **17.1 — Write failing tests for notification system**

Create `apps/web/test/social-notifications.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock Supabase
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { telegram_chat_id: '123456789' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}))

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}))

describe('Telegram notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.TELEGRAM_BOT_USERNAME = 'TestStoryBot'
  })

  it('sends a photo with caption and inline keyboard to Telegram', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
    })

    const { sendTelegramStoryNotification } = await import(
      '@/lib/social/notifications/telegram'
    )

    const result = await sendTelegramStoryNotification({
      chatId: '123456789',
      imageUrl: 'https://blob.vercel.com/stories/post-1-1716000000.png',
      shortUrl: 'https://go.btf.com/abc123',
      readyPageUrl: 'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'My Blog Post',
    })

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendPhoto',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.chat_id).toBe('123456789')
    expect(body.photo).toBe('https://blob.vercel.com/stories/post-1-1716000000.png')
    expect(body.caption).toContain('go.btf.com/abc123')
    expect(body.reply_markup.inline_keyboard).toBeDefined()
    expect(body.reply_markup.inline_keyboard[0][0].text).toBe('Open in CMS')
  })

  it('returns error when Telegram API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request: chat not found'),
    })

    const { sendTelegramStoryNotification } = await import(
      '@/lib/social/notifications/telegram'
    )

    const result = await sendTelegramStoryNotification({
      chatId: 'invalid',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      readyPageUrl: 'https://bythiagofigueiredo.com/cms/social/posts/post-1/ready',
      title: 'Test',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Bad Request')
  })
})

describe('Notification orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEWSLETTER_FROM_DOMAIN = 'bythiagofigueiredo.com'
  })

  it('tries Telegram first when chat_id is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 42 } }),
    })

    const { notifyStoryReady } = await import(
      '@/lib/social/notifications/notify-story-ready'
    )

    const result = await notifyStoryReady({
      userId: 'user-1',
      postId: 'post-1',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      title: 'Test Post',
    })

    expect(result.channel).toBe('telegram')
    expect(result.ok).toBe(true)
  })

  it('falls back to email when Telegram not configured', async () => {
    // Override mock to return no chat_id
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { telegram_chat_id: null, email: 'user@example.com' },
              error: null,
            })),
          })),
        })),
      })),
    } as never)

    const { notifyStoryReady } = await import(
      '@/lib/social/notifications/notify-story-ready'
    )

    const result = await notifyStoryReady({
      userId: 'user-1',
      postId: 'post-1',
      imageUrl: 'https://blob.vercel.com/stories/test.png',
      shortUrl: 'https://go.btf.com/abc',
      title: 'Test Post',
    })

    expect(result.channel).toBe('email')
  })
})

describe('Telegram webhook handler', () => {
  it('handles /start command and saves chat_id', async () => {
    const { POST } = await import('@/app/api/webhooks/telegram/route')

    // Mock the Supabase upsert
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        upsert: mockUpsert,
      })),
    } as never)

    const update = {
      message: {
        from: { id: 999888777 },
        chat: { id: 999888777, type: 'private' },
        text: '/start user-uuid-123',
      },
    }

    const request = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-notifications.test.ts`
Expected: Tests fail because the modules do not exist.

- [ ] **17.2 — Create Telegram notification sender**

Create `apps/web/src/lib/social/notifications/telegram.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

const SENTRY_TAG = { component: 'social-telegram' }

interface TelegramNotificationInput {
  chatId: string
  imageUrl: string
  shortUrl: string
  readyPageUrl: string
  title: string
}

interface TelegramResult {
  ok: boolean
  error?: string
}

export async function sendTelegramStoryNotification(
  input: TelegramNotificationInput,
): Promise<TelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  const caption = [
    `Story ready: "${input.title}"`,
    '',
    'Paste this link sticker URL:',
    input.shortUrl,
  ].join('\n')

  const body = {
    chat_id: input.chatId,
    photo: input.imageUrl,
    caption,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Open in CMS',
            url: input.readyPageUrl,
          },
        ],
      ],
    },
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      Sentry.captureMessage(`Telegram sendPhoto failed: ${text}`, {
        level: 'warning',
        tags: SENTRY_TAG,
      })
      return { ok: false, error: text }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { tags: SENTRY_TAG })
    return { ok: false, error: message }
  }
}

export async function sendTelegramConfirmation(chatId: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Connected! You will receive story notifications here.',
    }),
  })
}
```

- [ ] **17.3 — Create email fallback sender**

Create `apps/web/src/lib/social/notifications/email-fallback.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

const SENTRY_TAG = { component: 'social-email-notification' }

interface EmailNotificationInput {
  to: string
  imageUrl: string
  shortUrl: string
  readyPageUrl: string
  title: string
}

interface EmailResult {
  ok: boolean
  error?: string
}

export async function sendStoryEmailNotification(
  input: EmailNotificationInput,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const fromDomain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: `Social Hub <noreply@${fromDomain}>`,
      to: input.to,
      subject: `Story Ready: ${input.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0a0a0a; font-size: 20px; margin-bottom: 16px;">Story Ready to Post</h2>
          <p style="color: #525252; font-size: 14px; margin-bottom: 16px;">"${input.title}"</p>
          <img src="${input.imageUrl}" alt="Story preview" style="width: 100%; max-width: 270px; border-radius: 12px; margin-bottom: 16px;" />
          <div style="background: #f5f5f5; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <p style="color: #525252; font-size: 12px; margin: 0 0 4px;">Link sticker URL:</p>
            <p style="color: #0a0a0a; font-size: 16px; font-family: monospace; margin: 0; word-break: break-all;">${input.shortUrl}</p>
          </div>
          <a href="${input.readyPageUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">Open in CMS</a>
          <ol style="color: #525252; font-size: 13px; line-height: 1.8; margin-top: 24px; padding-left: 20px;">
            <li>Open Instagram and create a new Story</li>
            <li>Upload the image from your gallery</li>
            <li>Add a Link Sticker and paste the URL above</li>
          </ol>
        </div>
      `,
    })

    if (error) {
      Sentry.captureMessage(`Resend story email failed: ${error.message}`, {
        level: 'warning',
        tags: SENTRY_TAG,
      })
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { tags: SENTRY_TAG })
    return { ok: false, error: message }
  }
}
```

- [ ] **17.4 — Create notification orchestrator**

Create `apps/web/src/lib/social/notifications/notify-story-ready.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendTelegramStoryNotification } from './telegram'
import { sendStoryEmailNotification } from './email-fallback'

const SENTRY_TAG = { component: 'social-notify-story' }

interface NotifyInput {
  userId: string
  postId: string
  imageUrl: string
  shortUrl: string
  title: string
}

interface NotifyResult {
  ok: boolean
  channel: 'telegram' | 'email' | 'none'
  error?: string
}

export async function notifyStoryReady(input: NotifyInput): Promise<NotifyResult> {
  const supabase = getSupabaseServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const readyPageUrl = `${appUrl}/cms/social/posts/${input.postId}/ready`

  // Fetch user notification preferences
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('telegram_chat_id, email')
    .eq('id', input.userId)
    .single()

  if (userError || !user) {
    Sentry.captureMessage(`Could not fetch user profile for notification: ${input.userId}`, {
      level: 'warning',
      tags: SENTRY_TAG,
    })
    return { ok: false, channel: 'none', error: 'User not found' }
  }

  // Try Telegram first
  if (user.telegram_chat_id) {
    const result = await sendTelegramStoryNotification({
      chatId: user.telegram_chat_id,
      imageUrl: input.imageUrl,
      shortUrl: input.shortUrl,
      readyPageUrl,
      title: input.title,
    })

    if (result.ok) {
      return { ok: true, channel: 'telegram' }
    }
    // Telegram failed, fall through to email
    Sentry.captureMessage(`Telegram notification failed, falling back to email`, {
      level: 'info',
      tags: SENTRY_TAG,
      extra: { error: result.error },
    })
  }

  // Fallback to email
  if (user.email) {
    const result = await sendStoryEmailNotification({
      to: user.email,
      imageUrl: input.imageUrl,
      shortUrl: input.shortUrl,
      readyPageUrl,
      title: input.title,
    })

    return {
      ok: result.ok,
      channel: 'email',
      error: result.error,
    }
  }

  return { ok: false, channel: 'none', error: 'No notification channel available' }
}
```

- [ ] **17.5 — Create Telegram webhook handler**

Create `apps/web/src/app/api/webhooks/telegram/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendTelegramConfirmation } from '@/lib/social/notifications/telegram'

export const runtime = 'nodejs'

interface TelegramUpdate {
  message?: {
    from: { id: number }
    chat: { id: number; type: string }
    text?: string
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const update = (await request.json()) as TelegramUpdate

    if (!update.message?.text?.startsWith('/start')) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(update.message.chat.id)
    const text = update.message.text
    // Extract user UUID from /start command: "/start user-uuid-123"
    const userUuid = text.split(' ')[1]?.trim()

    if (!userUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)) {
      return NextResponse.json({ ok: true })
    }

    const supabase = getSupabaseServiceClient()

    // Save chat_id to user profile
    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: chatId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userUuid)

    if (error) {
      Sentry.captureException(error, {
        tags: { component: 'telegram-webhook' },
        extra: { userUuid, chatId },
      })
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    // Send confirmation to user
    await sendTelegramConfirmation(chatId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'telegram-webhook' } })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
```

- [ ] **17.6 — Create Telegram Connect UI component**

Create `apps/web/src/app/cms/(authed)/settings/notifications/_components/telegram-connect.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react'

interface TelegramConnectProps {
  userId: string
  isConnected: boolean
  chatId: string | null
}

export function TelegramConnect({ userId, isConnected: initialConnected, chatId }: TelegramConnectProps) {
  const [connected, setConnected] = useState(initialConnected)
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'BTFStoryBot'
  const deepLink = `https://t.me/${botUsername}?start=${userId}`

  // Poll for connection status after user clicks the link
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!polling || connected) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/social/telegram-status')
        if (res.ok) {
          const data = await res.json()
          if (data.connected) {
            setConnected(true)
            setPolling(false)
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [polling, connected])

  if (connected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-800/40 bg-green-950/20 px-4 py-3">
        <CheckCircle2 size={20} className="text-green-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-300">Telegram connected</p>
          <p className="text-[11px] text-green-500/70">Story notifications will be sent via Telegram</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <h4 className="text-sm font-medium text-cms-text mb-2">Connect Telegram</h4>
      <p className="text-[12px] text-cms-text-muted mb-3">
        Receive Instagram Story notifications directly in Telegram. Click the button below to open Telegram and connect your account.
      </p>
      <a
        href={deepLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setPolling(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0088cc] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b5] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        Open in Telegram
        <ExternalLink size={14} />
      </a>
      {polling && (
        <p className="mt-2 text-[11px] text-cms-text-muted flex items-center gap-1">
          <RefreshCw size={12} className="animate-spin" />
          Waiting for connection...
        </p>
      )}
    </div>
  )
}
```

- [ ] **17.7 — Run tests and verify**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-notifications.test.ts`
Expected: All tests pass.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run`
Expected: No regressions.

---

## Task 18: Ready-to-Post Page

**Estimated time:** 2h
**Dependencies:** Task 17 (notification system delivers links to this page)
**Branch:** staging (direct commits)

### Overview

A mobile-first CMS page at `/cms/social/posts/[id]/ready` designed for use on the phone after receiving a Telegram/email notification. Full-bleed story preview, copy-to-clipboard short URL, 3-step instructions, and "Mark as Posted" button.

### Files

| Action | Path |
|--------|------|
| Create | `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/page.tsx` |
| Create | `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/_components/ready-to-post.tsx` |
| Create | `apps/web/test/cms/social-ready-to-post.test.tsx` |

### Steps

- [ ] **18.1 — Write failing tests for Ready-to-Post page**

Create `apps/web/test/cms/social-ready-to-post.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

const mockMarkAsPosted = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/lib/social/actions', () => ({
  markAsPosted: mockMarkAsPosted,
}))

import { ReadyToPost } from '@/app/cms/(authed)/social/posts/[id]/ready/_components/ready-to-post'

describe('ReadyToPost', () => {
  const defaultProps = {
    postId: 'post-123',
    title: 'Blog Post Title',
    imageUrl: 'https://blob.vercel.com/stories/post-123-1716000000.png',
    shortUrl: 'https://go.btf.com/abc123',
    status: 'publishing' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the story preview image', () => {
    render(<ReadyToPost {...defaultProps} />)
    const img = screen.getByAltText('Story preview')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', defaultProps.imageUrl)
  })

  it('displays the short URL with copy button', () => {
    render(<ReadyToPost {...defaultProps} />)
    expect(screen.getByText('go.btf.com/abc123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('copies URL to clipboard on click', async () => {
    render(<ReadyToPost {...defaultProps} />)
    const copyButton = screen.getByRole('button', { name: /copy/i })
    fireEvent.click(copyButton)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://go.btf.com/abc123')
    })
  })

  it('shows 3 numbered steps', () => {
    render(<ReadyToPost {...defaultProps} />)
    expect(screen.getByText(/open instagram/i)).toBeInTheDocument()
    expect(screen.getByText(/upload the image/i)).toBeInTheDocument()
    expect(screen.getByText(/add a link sticker/i)).toBeInTheDocument()
  })

  it('shows Mark as Posted button', () => {
    render(<ReadyToPost {...defaultProps} />)
    expect(screen.getByRole('button', { name: /mark as posted/i })).toBeInTheDocument()
  })

  it('hides Mark as Posted when already completed', () => {
    render(<ReadyToPost {...defaultProps} status="completed" />)
    expect(screen.queryByRole('button', { name: /mark as posted/i })).not.toBeInTheDocument()
    expect(screen.getByText(/posted/i)).toBeInTheDocument()
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/social-ready-to-post.test.tsx`
Expected: Tests fail because the component does not exist.

- [ ] **18.2 — Create ReadyToPost client component**

Create `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/_components/ready-to-post.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, CheckCircle2, ExternalLink } from 'lucide-react'

interface ReadyToPostProps {
  postId: string
  title: string
  imageUrl: string
  shortUrl: string
  status: 'publishing' | 'completed' | string
}

export function ReadyToPost({ postId, title, imageUrl, shortUrl, status }: ReadyToPostProps) {
  const [copied, setCopied] = useState(false)
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(status === 'completed')

  // Strip protocol for display
  const displayUrl = shortUrl.replace(/^https?:\/\//, '')

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
    }
  }, [shortUrl])

  const handleMarkAsPosted = useCallback(async () => {
    setMarking(true)
    try {
      const { markAsPosted } = await import('@/lib/social/actions')
      const result = await markAsPosted(postId)
      if (result.ok) {
        setMarked(true)
      }
    } finally {
      setMarking(false)
    }
  }, [postId])

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center">
      {/* Minimal header */}
      <div className="w-full max-w-md px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] text-neutral-400 font-medium">Story Ready</span>
        {marked && (
          <span className="flex items-center gap-1 text-[12px] text-green-400">
            <CheckCircle2 size={14} />Posted
          </span>
        )}
      </div>

      {/* Story preview */}
      <div className="w-full max-w-[270px] mx-auto px-4 mb-6">
        <img
          src={imageUrl}
          alt="Story preview"
          className="w-full rounded-xl shadow-2xl"
          style={{ aspectRatio: '9/16', objectFit: 'cover' }}
        />
      </div>

      {/* Title */}
      <p className="text-sm text-neutral-300 font-medium text-center px-4 mb-4 max-w-md">
        {title}
      </p>

      {/* Short URL copy section */}
      <div className="w-full max-w-md px-4 mb-6">
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="flex-1 text-sm font-mono text-cyan-400 truncate">{displayUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-[12px] text-neutral-300 hover:bg-neutral-700 transition-colors"
            aria-label={copied ? 'Copied' : 'Copy URL'}
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full max-w-md px-4 mb-8">
        <ol className="space-y-3">
          {[
            { step: 1, text: 'Open Instagram and create a new Story' },
            { step: 2, text: 'Upload the image from your gallery' },
            { step: 3, text: 'Add a Link Sticker and paste the URL' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 text-[12px] font-bold flex items-center justify-center">
                {step}
              </span>
              <span className="text-[13px] text-neutral-400 pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Action button */}
      {!marked ? (
        <div className="w-full max-w-md px-4 pb-8">
          <button
            type="button"
            onClick={handleMarkAsPosted}
            disabled={marking}
            className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
            aria-label="Mark as posted"
          >
            {marking ? 'Updating...' : 'Mark as Posted'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **18.3 — Create Ready-to-Post server page**

Create `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ReadyToPost } from './_components/ready-to-post'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReadyToPostPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const supabase = getSupabaseServiceClient()

  const { data: post, error } = await supabase
    .from('social_posts')
    .select('id, status, content, published_at')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error || !post) {
    notFound()
  }

  const content = post.content as { title?: string; media_urls?: string[]; url?: string }
  const imageUrl = content.media_urls?.[0]
  const shortUrl = content.url

  if (!imageUrl || !shortUrl) {
    notFound()
  }

  return (
    <ReadyToPost
      postId={post.id as string}
      title={content.title ?? 'Story'}
      imageUrl={imageUrl}
      shortUrl={shortUrl}
      status={post.status as string}
    />
  )
}
```

- [ ] **18.4 — Run tests and verify**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/social-ready-to-post.test.tsx`
Expected: All tests pass.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run`
Expected: No regressions.

---

## Task 19: Link-in-Bio Page (/go/ig)

**Estimated time:** 3h
**Dependencies:** None (parallel with Tasks 15, 16)
**Branch:** staging (direct commits)

### Overview

A mobile-first public landing page at `/go/ig` built on the existing Links Engine. Displays the last 20 links from story posts, avatar + display name + bio from site settings. Every click is tracked through the standard Links Engine pipeline.

### Files

| Action | Path |
|--------|------|
| Create | `apps/web/src/app/go/ig/page.tsx` |
| Create | `apps/web/src/app/go/ig/_components/link-in-bio.tsx` |
| Create | `apps/web/src/lib/social/link-in-bio.ts` |
| Create | `apps/web/test/social-link-in-bio.test.ts` |

### Steps

- [ ] **19.1 — Write failing tests for link-in-bio logic**

Create `apps/web/test/social-link-in-bio.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

describe('Link-in-Bio data layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLinkinBioEntries returns up to 20 entries ordered by position', async () => {
    const mockEntries = Array.from({ length: 20 }, (_, i) => ({
      id: `entry-${i}`,
      position: i,
      post_id: `post-${i}`,
      link_id: `link-${i}`,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      social_posts: { content: { title: `Post ${i}` } },
      tracked_links: {
        id: `link-${i}`,
        code: `code${i}`,
        destination_url: `https://example.com/${i}`,
      },
    }))

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockEntries,
              error: null,
            }),
          }),
        }),
      }),
    })

    const { getLinkinBioEntries } = await import('@/lib/social/link-in-bio')
    const entries = await getLinkinBioEntries('site-1')

    expect(entries).toHaveLength(20)
    expect(entries[0]!.title).toBe('Post 0')
    expect(mockSupabase.from).toHaveBeenCalledWith('link_in_bio_entries')
  })

  it('addLinkinBioEntry prepends and auto-prunes beyond 20', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockResolvedValue({ error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: [{ id: 'oldest-entry' }],
            error: null,
          }),
        }),
      }),
    })
    const mockCount = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 21,
        error: null,
      }),
    })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'link_in_bio_entries') {
        return {
          insert: mockInsert,
          select: mockSelect,
          delete: vi.fn().mockReturnValue({
            in: mockDelete,
          }),
        }
      }
      return { select: vi.fn() }
    })

    const { addLinkinBioEntry } = await import('@/lib/social/link-in-bio')
    await addLinkinBioEntry({
      siteId: 'site-1',
      postId: 'post-new',
      linkId: 'link-new',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        post_id: 'post-new',
        link_id: 'link-new',
        position: 0,
      }),
    )
  })
})

describe('Link-in-Bio page rendering', () => {
  it('renders avatar, display name, and link list', async () => {
    const { render, screen } = await import('@testing-library/react')
    const React = await import('react')

    const { LinkInBio } = await import(
      '@/app/go/ig/_components/link-in-bio'
    )

    const entries = [
      {
        id: 'e1',
        title: 'First Post',
        shortUrl: 'https://go.btf.com/abc',
        thumbnailUrl: null,
        createdAt: '2026-05-17T10:00:00Z',
      },
      {
        id: 'e2',
        title: 'Second Post',
        shortUrl: 'https://go.btf.com/def',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        createdAt: '2026-05-16T10:00:00Z',
      },
    ]

    render(
      React.createElement(LinkInBio, {
        site: {
          displayName: 'Thiago Figueiredo',
          bio: 'Writer & Developer',
          avatarUrl: 'https://example.com/avatar.jpg',
          brandColor: '#7c3aed',
        },
        entries,
      }),
    )

    expect(screen.getByText('Thiago Figueiredo')).toBeInTheDocument()
    expect(screen.getByText('Writer & Developer')).toBeInTheDocument()
    expect(screen.getByText('First Post')).toBeInTheDocument()
    expect(screen.getByText('Second Post')).toBeInTheDocument()
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-link-in-bio.test.ts`
Expected: Tests fail because modules do not exist.

- [ ] **19.2 — Create link-in-bio data layer**

Create `apps/web/src/lib/social/link-in-bio.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildShortUrl } from '@/lib/links/short-url'

const MAX_ENTRIES = 20
const SENTRY_TAG = { component: 'social-link-in-bio' }

export interface LinkinBioEntry {
  id: string
  title: string
  shortUrl: string
  thumbnailUrl: string | null
  createdAt: string
}

export async function getLinkinBioEntries(siteId: string): Promise<LinkinBioEntry[]> {
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_in_bio_entries')
    .select(`
      id,
      position,
      created_at,
      social_posts!inner(content),
      tracked_links!inner(id, code, destination_url)
    `)
    .eq('site_id', siteId)
    .order('position', { ascending: true })
    .limit(MAX_ENTRIES)

  if (error || !data) {
    Sentry.captureException(error, { tags: SENTRY_TAG })
    return []
  }

  return data.map((row) => {
    const post = row.social_posts as unknown as { content: { title?: string; media_urls?: string[] } }
    const link = row.tracked_links as unknown as { id: string; code: string; destination_url: string }

    return {
      id: row.id as string,
      title: post.content.title ?? 'Untitled',
      shortUrl: buildShortUrl(link.code),
      thumbnailUrl: post.content.media_urls?.[0] ?? null,
      createdAt: row.created_at as string,
    }
  })
}

export async function addLinkinBioEntry(input: {
  siteId: string
  postId: string
  linkId: string
}): Promise<void> {
  const supabase = getSupabaseServiceClient()

  try {
    // Shift all existing entries down by 1
    const { data: existing } = await supabase
      .from('link_in_bio_entries')
      .select('id, position')
      .eq('site_id', input.siteId)
      .order('position', { ascending: true })

    if (existing && existing.length > 0) {
      // Increment all positions
      for (const entry of existing) {
        await supabase
          .from('link_in_bio_entries')
          .update({ position: (entry.position as number) + 1 })
          .eq('id', entry.id)
      }
    }

    // Insert new entry at position 0
    const { error: insertError } = await supabase
      .from('link_in_bio_entries')
      .insert({
        site_id: input.siteId,
        post_id: input.postId,
        link_id: input.linkId,
        position: 0,
      })

    if (insertError) {
      throw insertError
    }

    // Auto-prune: remove entries beyond MAX_ENTRIES
    const { data: overflow } = await supabase
      .from('link_in_bio_entries')
      .select('id')
      .eq('site_id', input.siteId)
      .order('position', { ascending: true })
      .range(MAX_ENTRIES, MAX_ENTRIES + 100)

    if (overflow && overflow.length > 0) {
      const overflowIds = overflow.map((r) => r.id as string)
      await supabase
        .from('link_in_bio_entries')
        .delete()
        .in('id', overflowIds)
    }
  } catch (err) {
    Sentry.captureException(err, { tags: SENTRY_TAG })
  }
}
```

- [ ] **19.3 — Create LinkInBio client component**

Create `apps/web/src/app/go/ig/_components/link-in-bio.tsx`:

```tsx
interface SiteInfo {
  displayName: string
  bio: string
  avatarUrl: string | null
  brandColor: string
}

interface LinkEntry {
  id: string
  title: string
  shortUrl: string
  thumbnailUrl: string | null
  createdAt: string
}

interface LinkInBioProps {
  site: SiteInfo
  entries: LinkEntry[]
}

export function LinkInBio({ site, entries }: LinkInBioProps) {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center px-4 py-8">
      {/* Avatar + name + bio */}
      <div className="flex flex-col items-center mb-8">
        {site.avatarUrl ? (
          <img
            src={site.avatarUrl}
            alt={site.displayName}
            className="w-20 h-20 rounded-full border-2 mb-3 object-cover"
            style={{ borderColor: site.brandColor }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full mb-3 flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: site.brandColor }}
          >
            {site.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-lg font-semibold text-white">{site.displayName}</h1>
        <p className="text-sm text-neutral-400 text-center mt-1">{site.bio}</p>
      </div>

      {/* Links list */}
      <div className="w-full max-w-md space-y-3">
        {entries.length === 0 ? (
          <p className="text-center text-sm text-neutral-600">No links yet</p>
        ) : (
          entries.map((entry) => (
            <a
              key={entry.id}
              href={entry.shortUrl}
              className="flex items-center gap-3 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 hover:border-neutral-600 hover:bg-neutral-900 transition-colors group"
            >
              {entry.thumbnailUrl && (
                <img
                  src={entry.thumbnailUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                  {entry.title}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {formatRelativeDate(entry.createdAt)}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-neutral-600 group-hover:text-neutral-400 transition-colors"
              >
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-[10px] text-neutral-700">
        Powered by <span style={{ color: site.brandColor }}>Links Engine</span>
      </div>
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

- [ ] **19.4 — Create Link-in-Bio server page**

Create `apps/web/src/app/go/ig/page.tsx`:

```tsx
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLinkinBioEntries } from '@/lib/social/link-in-bio'
import { LinkInBio } from './_components/link-in-bio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Links',
  robots: 'noindex',
}

async function resolveSiteFromHost(host: string): Promise<string | null> {
  const hostname = host.split(':')[0] ?? ''
  const domain = hostname.startsWith('go.') ? hostname.slice(3) : hostname
  const resolvedDomain =
    (domain === 'localhost' || domain === '127.0.0.1') &&
    process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      ? process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      : domain

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [resolvedDomain])
    .maybeSingle()

  return data?.id ?? null
}

export default async function LinkInBioPage() {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const siteId = await resolveSiteFromHost(host)

  if (!siteId) {
    notFound()
  }

  const supabase = getSupabaseServiceClient()

  // Fetch site info
  const { data: site } = await supabase
    .from('sites')
    .select('name, tagline, logo_url, brand_color')
    .eq('id', siteId)
    .single()

  if (!site) {
    notFound()
  }

  const entries = await getLinkinBioEntries(siteId)

  return (
    <LinkInBio
      site={{
        displayName: (site.name as string) ?? 'My Site',
        bio: (site.tagline as string) ?? '',
        avatarUrl: (site.logo_url as string) ?? null,
        brandColor: (site.brand_color as string) ?? '#7c3aed',
      }}
      entries={entries}
    />
  )
}
```

- [ ] **19.5 — Run tests and verify**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-link-in-bio.test.ts`
Expected: All tests pass.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run`
Expected: No regressions.

---

## Environment Variables Added

| Variable | Where | Description |
|----------|-------|-------------|
| `TELEGRAM_BOT_TOKEN` | `apps/web/.env.local` | Telegram Bot API token from @BotFather |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `apps/web/.env.local` | Bot username for deep link generation |

These must be added to Vercel env vars for production deployment.

## DB Migration Note

This phase does not create new tables (those were created in Phase 1). It relies on:
- `social_templates` table (Phase 1)
- `link_in_bio_entries` table (Phase 1)
- `social_deliveries.format` column (Phase 1)
- `profiles.telegram_chat_id` column -- must be added via `npm run db:new add_telegram_chat_id`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;
```

## Commit Strategy

Each task is a separate commit on staging:
1. `feat(social): fix Instagram provider to respect delivery format for stories`
2. `feat(social): add canvas editor for social templates`
3. `feat(social): add Telegram + email notification system for stories`
4. `feat(social): add Ready-to-Post page for manual story publishing`
5. `feat(social): add Link-in-Bio page at /go/ig`
