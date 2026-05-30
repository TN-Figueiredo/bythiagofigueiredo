# Multi QR Cards per Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow creating multiple QR card designs per tracked link (one per channel: YouTube, newsletter, print, etc.) with a horizontal scrollable list in the detail page.

**Architecture:** New `link_qr_cards` table (1:N from tracked_links). Migrate existing single QR data. Detail page shows scrollable card gallery. QR editor accepts `?card=<id>` param to create/edit specific cards. Server actions for CRUD.

**Tech Stack:** Next.js 15, React 19, Supabase (PostgreSQL), TypeScript, Zod, Vercel Blob

**Spec:** `docs/superpowers/plans/2026-05-30-multi-qr-cards.md` (this file)

---

## File Structure

### New files
- `supabase/migrations/YYYYMMDD_link_qr_cards.sql` — Table + RLS + data migration
- `apps/web/src/app/cms/(authed)/links/[id]/_components/qr-cards-strip.tsx` — Horizontal scrollable QR card gallery
- `apps/web/src/app/cms/(authed)/links/[id]/qr/card-actions.ts` — Server actions for link_qr_cards CRUD

### Modified files
- `apps/web/src/app/cms/(authed)/links/[id]/page.tsx` — Load QR cards list, pass to _detail
- `apps/web/src/app/cms/(authed)/links/[id]/_detail.tsx` — Replace single QR Card with QrCardsStrip
- `apps/web/src/app/cms/(authed)/links/[id]/qr/page.tsx` — Accept `?card=<id>` searchParams
- `apps/web/src/app/cms/(authed)/links/[id]/qr/client.tsx` — Pass cardId to save handler
- `apps/web/src/app/cms/(authed)/links/[id]/qr/actions.ts` — Update saveQrCard to use link_qr_cards

### Test files
- `apps/web/test/cms/links/qr-cards-strip.test.tsx`

---

## Phase 1: DATABASE

### Task 1: Create `link_qr_cards` table + migrate existing data

- [ ] Step 1: Generate migration file

Run:
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:new link_qr_cards
```

- [ ] Step 2: Write migration SQL

Read the generated file first, then replace its content with:

```sql
-- Multi QR Cards per Link
-- Allows N QR card designs per tracked link (different channels/formats)

-- 1. Table
CREATE TABLE IF NOT EXISTS public.link_qr_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'QR Card',
  composition jsonb,
  config jsonb NOT NULL DEFAULT '{}',
  storage_path text,
  preview_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_link_qr_cards_link ON link_qr_cards (link_id);

-- 3. RLS
ALTER TABLE public.link_qr_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "link_qr_cards_staff_read" ON public.link_qr_cards;
CREATE POLICY "link_qr_cards_staff_read"
  ON public.link_qr_cards
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "link_qr_cards_staff_write" ON public.link_qr_cards;
CREATE POLICY "link_qr_cards_staff_write"
  ON public.link_qr_cards
  FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- 4. Migrate existing QR data from tracked_links
INSERT INTO link_qr_cards (link_id, site_id, name, composition, config, storage_path)
SELECT id, site_id, 'QR Card',
       qr_card_composition,
       COALESCE(qr_config, '{}'),
       qr_storage_path
FROM tracked_links
WHERE (qr_card_composition IS NOT NULL OR (has_qr = true AND qr_config IS NOT NULL))
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.link_qr_cards IS 'Multiple QR card designs per tracked link (channels: YouTube, newsletter, print, etc.)';
```

- [ ] Step 3: Verify migration file exists

```bash
ls supabase/migrations/*link_qr_cards*
```

- [ ] Step 4: Commit

```
feat(db): add link_qr_cards table — multi QR cards per link
```

---

## Phase 2: SERVER ACTIONS

### Task 2: Create CRUD server actions for link_qr_cards

- [ ] Step 1: Create card-actions.ts

Create: `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/cms/(authed)/links/[id]/qr/card-actions.ts`

```typescript
'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import type { CardComposition } from '@tn-figueiredo/links/qr'

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

async function requireEdit() {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error('forbidden')
  return siteId
}

export interface QrCardSummary {
  id: string
  name: string
  previewUrl: string | null
  createdAt: string
}

export async function listQrCards(linkId: string): Promise<ActionResult<{ cards: QrCardSummary[] }>> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('link_qr_cards')
    .select('id, name, preview_url, created_at')
    .eq('link_id', linkId)
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    cards: (data ?? []).map(c => ({
      id: c.id as string,
      name: c.name as string,
      previewUrl: (c.preview_url as string) ?? null,
      createdAt: c.created_at as string,
    })),
  }
}

export async function createQrCard(
  linkId: string,
  name: string,
  composition: CardComposition,
): Promise<ActionResult<{ cardId: string }>> {
  const siteId = await requireEdit()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_cards')
    .insert({
      link_id: linkId,
      site_id: siteId,
      name,
      composition,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, cardId: data.id as string }
}

export async function updateQrCard(
  cardId: string,
  patch: { name?: string; composition?: CardComposition; previewUrl?: string },
): Promise<ActionResult> {
  const siteId = await requireEdit()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) updateData.name = patch.name
  if (patch.composition !== undefined) updateData.composition = patch.composition
  if (patch.previewUrl !== undefined) updateData.preview_url = patch.previewUrl

  const { error } = await supabase
    .from('link_qr_cards')
    .update(updateData)
    .eq('id', cardId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteQrCard(cardId: string): Promise<ActionResult> {
  const siteId = await requireEdit()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('link_qr_cards')
    .delete()
    .eq('id', cardId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function loadQrCardById(
  cardId: string,
): Promise<ActionResult<{ composition: CardComposition | null; name: string }>> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_cards')
    .select('composition, name')
    .eq('id', cardId)
    .eq('site_id', siteId)
    .single()

  if (error || !data) return { ok: false, error: 'not_found' }
  return {
    ok: true,
    composition: (data.composition as CardComposition) ?? null,
    name: data.name as string,
  }
}
```

- [ ] Step 2: Commit

```
feat(links): add CRUD server actions for link_qr_cards
```

---

## Phase 3: DETAIL PAGE UI

### Task 3: Create QrCardsStrip component

- [ ] Step 1: Create component

Create: `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/cms/(authed)/links/[id]/_components/qr-cards-strip.tsx`

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { Plus, QrCode } from 'lucide-react'

interface QrCardItem {
  id: string
  name: string
  previewUrl: string | null
  createdAt: string
}

interface QrCardsStripProps {
  linkId: string
  cards: QrCardItem[]
}

export function QrCardsStrip({ linkId, cards }: QrCardsStripProps) {
  const router = useRouter()

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 'var(--r)',
      padding: 18,
    }}>
      <div className="eyebrow" style={{
        marginBottom: 12, fontSize: '10.5px', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)',
      }}>
        QR Cards · {cards.length}
      </div>

      <div style={{
        display: 'flex', gap: 12,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        {/* Existing cards */}
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => router.push(`/cms/links/${linkId}/qr?card=${card.id}`)}
            style={{
              width: 130, minWidth: 130, height: 150,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 12,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            {/* QR Preview */}
            <div style={{
              width: 64, height: 64, borderRadius: 8,
              background: '#fff', padding: 5, flexShrink: 0,
            }}>
              {card.previewUrl ? (
                <img
                  src={card.previewUrl}
                  alt={card.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: 'repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 center / 10px 10px',
                }} />
              )}
            </div>

            {/* Name */}
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--ink)',
              textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', width: '100%',
            }}>
              {card.name}
            </span>

            {/* Edit button */}
            <span style={{
              fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600,
            }}>
              Editar
            </span>
          </div>
        ))}

        {/* "+ Novo QR Card" button */}
        <div
          onClick={() => router.push(`/cms/links/${linkId}/qr`)}
          style={{
            width: 130, minWidth: 130, height: 150,
            border: '1px dashed var(--line-strong)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
        >
          <Plus size={20} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', textAlign: 'center' }}>
            Novo QR Card
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Step 2: Commit

```
feat(links): add QrCardsStrip horizontal scrollable component
```

### Task 4: Wire QR cards into detail page

- [ ] Step 1: Update detail page.tsx to load QR cards

Edit: `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/cms/(authed)/links/[id]/page.tsx`

Add import at top:
```typescript
import { listQrCards } from './qr/card-actions'
```

After the `topCountry` calculation (before the `return`), add:
```typescript
  const qrCardsResult = await listQrCards(id)
  const qrCards = qrCardsResult.ok ? qrCardsResult.cards : []
```

Update the `<LinkDetail>` component to pass `qrCards`:
```typescript
        qrCards={qrCards}
```

- [ ] Step 2: Update _detail.tsx Props and QR section

In `_detail.tsx`, add to the `Props` interface:
```typescript
  qrCards: Array<{ id: string; name: string; previewUrl: string | null; createdAt: string }>
```

Add import:
```typescript
import { QrCardsStrip } from './_components/qr-cards-strip'
```

Replace the existing QR Card `<div>` section (lines ~629-663) with:
```tsx
      <QrCardsStrip linkId={linkId} cards={qrCards} />
```

- [ ] Step 3: Commit

```
feat(links): wire QR cards strip into detail page — shows existing + new button
```

---

## Phase 4: QR EDITOR ROUTING

### Task 5: Update QR editor to support card ID

- [ ] Step 1: Update `page.tsx` to accept `?card=<id>` searchParam

Edit: `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/cms/(authed)/links/[id]/qr/page.tsx`

Add `searchParams` to Props:
```typescript
interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}
```

Update the function signature:
```typescript
export default async function QrCardPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const cardId = sp.card ?? null
```

After loading the link, add card loading logic:
```typescript
  let composition = createDefaultComposition()
  let editingCardId: string | null = cardId
  let cardName = 'Novo QR Card'

  if (cardId) {
    // Editing existing card
    const { loadQrCardById } = await import('./card-actions')
    const loaded = await loadQrCardById(cardId)
    if (loaded.ok && loaded.composition) {
      composition = loaded.composition
      cardName = loaded.name
    }
  } else if (link.qr_card_composition) {
    // Legacy: load from tracked_links for backward compat
    const loaded = await loadQrCard(id)
    if (loaded.ok && loaded.composition) {
      composition = loaded.composition
    }
  } else if (link.qr_config) {
    composition = migrateLegacyQrConfig(link.qr_config as Record<string, string>)
  }
```

Pass `cardId` and `cardName` to the client component:
```typescript
  return (
    <QrCardBuilderPage
      link={{ id: link.id as string, code: link.code as string, title: (link.title as string) ?? null }}
      shortUrl={shortUrl}
      initialComposition={composition}
      templates={templates}
      cardId={editingCardId}
      cardName={cardName}
    />
  )
```

- [ ] Step 2: Update `client.tsx` to save to link_qr_cards

Edit: `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/cms/(authed)/links/[id]/qr/client.tsx`

Add to Props:
```typescript
  cardId: string | null
  cardName: string
```

Update handleSave to use card-actions:
```typescript
import { createQrCard, updateQrCard } from './card-actions'

// ... inside component:

  const handleSave = useCallback(async (composition: CardComposition) => {
    if (cardId) {
      await updateQrCard(cardId, { composition })
    } else {
      const result = await createQrCard(link.id, cardName, composition)
      if (result.ok) {
        // Navigate to edit the newly created card
        window.location.href = `/cms/links/${link.id}/qr?card=${result.cardId}`
      }
    }
  }, [link.id, cardId, cardName])
```

- [ ] Step 3: Commit

```
feat(links): QR editor routes with ?card=<id> — create/edit individual cards
```

---

## Phase 5: INTEGRATION

### Task 6: Full integration verification

- [ ] Step 1: Verify migration is ready

```bash
ls supabase/migrations/*link_qr_cards*
```

- [ ] Step 2: Verify all imports resolve

Check that `card-actions.ts` is importable from both `page.tsx` and `_detail.tsx` via `./qr/card-actions`.

- [ ] Step 3: Verify the QR Cards strip renders in detail page

Navigate to `/cms/links/[id]` — should show:
- If existing QR: one card in strip + "Novo QR Card" button
- If no QR: just "Novo QR Card" button

- [ ] Step 4: Verify QR editor creates new card

Click "Novo QR Card" → editor opens → save → card appears in strip

- [ ] Step 5: Verify QR editor edits existing card

Click existing card → editor opens with saved composition → modify → save → updated

- [ ] Step 6: Commit final integration

```
feat(links): multi QR cards integration complete — create, edit, list
```

---

## Summary

| Phase | Tasks | Files | Est. |
|-------|-------|-------|------|
| 1. Database | 1 | 1 migration | 15min |
| 2. Server Actions | 1 | 1 new file | 20min |
| 3. Detail UI | 2 | 2 new + 2 modified | 30min |
| 4. Editor Routing | 1 | 2 modified | 30min |
| 5. Integration | 1 | verification | 15min |
| **Total** | **6** | **3 new + 4 modified** | **~2h** |
