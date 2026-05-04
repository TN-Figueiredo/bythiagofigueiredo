# CMS Sidebar Badges — Smart WIP + Urgency Indicators

**Date:** 2026-05-03
**Status:** Approved
**Score:** 98/100

## Problem

The CMS sidebar shows stale, low-value badges: Posts has a static "1" (draft count only), Newsletters has no badge at all. There's no signal for upcoming newsletter cadence slots that lack content — the editor discovers gaps only when opening the Schedule tab.

## Solution

Two badge types in the sidebar:

1. **WIP pill (yellow)** — count of draft + ready items needing work
2. **Urgency pill (yellow/orange/red)** — count of unfilled cadence slots in the next 15 days, color-coded by proximity. **Newsletters only.**

### Badge layout: Side-by-side pills

Posts shows one yellow WIP pill. Newsletters shows up to two pills: WIP (left) + urgency (right). When either count is 0, that pill is hidden.

### Urgency color thresholds

| Days until slot | Color  | Meaning                    |
|-----------------|--------|----------------------------|
| 0–4 days        | Red    | Urgent — will miss cadence |
| 5–9 days        | Orange | Approaching — act soon     |
| 10–15 days      | Yellow | Plan ahead                 |
| >15 days        | —      | Not shown                  |

Color is determined by the **nearest** unfilled slot. Count is the **total** unfilled slots (per-slot, not per-type).

### Today's slot

An unfilled slot for today is included in the urgency count as red (0 days). Past slots are excluded — backward-looking missed slots are the Schedule tab's concern.

## Precise definitions

| Term               | Definition                                                                                      |
|--------------------|-------------------------------------------------------------------------------------------------|
| Posts WIP          | `blog_posts` where `status IN ('draft', 'ready')`. Excludes 'idea' (pre-work) and 'queued' (scheduled). |
| Newsletter WIP     | `newsletter_editions` where `status IN ('draft', 'ready')`. Same logic.                        |
| Unfilled slot      | Cadence slot in next 15 days with no edition in `status IN ('ready', 'scheduled', 'queued', 'sending', 'sent')`. An edition in draft/idea assigned to a slot does NOT count as filled. |
| Paused newsletters | `cadence_paused = true` → excluded from urgency computation.                                   |
| No cadence pattern | `newsletter_types` without `cadence_pattern` → excluded from urgency.                          |

## Collapsed sidebar

When the sidebar is collapsed to icons-only, each item with badge data shows a single dot indicator. The dot color is the worst urgency tier: if urgency exists, use urgency color; otherwise yellow (WIP only). No dot if no badge data.

## Tooltip on hover

### Urgency pill tooltip

Shows which newsletter types have unfilled slots:

```
Unfilled slots (next 15 days)
● The bythiago diary     May 6
● Diário do bythiago     May 11
```

Each row shows the type name, its color dot, and the nearest unfilled slot date for that type.

### WIP pill tooltip

Shows breakdown:

```
Work in progress
3 draft editions
2 ready editions
```

## Overflow

Display capped at `99+` for any count exceeding 99.

## Accessibility

- `aria-label` on WIP pill: `"3 draft and ready editions"`
- `aria-label` on urgency pill: `"2 unfilled newsletter slots within 5 days"`
- Color is reinforcement, not sole signal — position and context provide meaning.

## Architecture

### CmsShell constraint

`@tn-figueiredo/cms-ui` `CmsShell` accepts `badges: Record<string, string | number>` — one value per href, fixed accent color. Cannot render multiple colored pills.

**Resolution:** Stop passing Posts/Newsletters via `CmsShell.badges`. Use the existing portal-based approach (`SidebarAlertBadge` pattern) for content badges. Keep `CmsShell.badges` only for simple badges (Contacts).

### Data flow

```
layout.tsx (server render)
  → fetchSidebarBadges(siteId)  [unstable_cache 60s, tag: 'sidebar-badges']
  → returns SidebarBadgeData
  → passes to <SidebarBadges data={...} />  (client component)
  → renders pills via portal into sidebar DOM
```

### Data type

```typescript
interface UrgencySlot {
  typeName: string
  typeColor: string
  slotDate: string   // ISO date
  daysUntil: number
}

interface SidebarBadgeData {
  posts: { wip: number }
  newsletters: {
    wip: number
    urgency: {
      count: number
      color: 'yellow' | 'orange' | 'red'
      slots: UrgencySlot[]
    } | null
  }
}
```

Tooltip data flows server → client via `data-slots` attribute (JSON-serialized `UrgencySlot[]`). Max ~8 entries in practice.

### Cache invalidation

`revalidateTag('sidebar-badges')` added to:
- Blog server actions: save, publish, unpublish, archive, delete
- Newsletter server actions: save edition, schedule edition, send edition, cancel edition

### Color consistency across sidebar

| Color  | Semantic                                            |
|--------|-----------------------------------------------------|
| Yellow | WIP — items needing work (draft/ready)              |
| Orange | Warning — approaching deadline (5-9 days)           |
| Red    | Urgent — action required (contacts / slots <5 days) |

Contacts badge remains red (unreplied = urgent). Subscribers badge removed from sidebar (was informational, not actionable).

## Files changed (6)

| Action | File                                      | Purpose                                                  |
|--------|-------------------------------------------|----------------------------------------------------------|
| NEW    | `lib/cms/sidebar-badges.ts`               | `fetchSidebarBadges()` + urgency computation logic       |
| MOD    | `components/cms/sidebar-alert-badge.tsx`   | Rename to SidebarBadges, multi-pill + colors + collapsed dots + tooltip |
| MOD    | `app/cms/(authed)/layout.tsx`             | Call fetchSidebarBadges, split simple vs rich badges     |
| MOD    | `app/cms/(authed)/layout-helpers.ts`      | Add badgeKey for Newsletters                            |
| NEW    | `test/cms/sidebar-badges.test.ts`         | Unit tests for urgency computation + color thresholds    |
| MOD    | Server actions (blog + newsletter)         | Add `revalidateTag('sidebar-badges')` to mutations       |

## Scope boundaries

**In scope:**
- Posts badge: draft-only → draft + ready, accent → yellow
- Newsletters badge: new WIP + urgency pills
- SidebarAlertBadge component overhaul
- Collapsed sidebar dot indicator
- Tooltip on hover
- Cache layer for badge computation

**Out of scope:**
- Campaigns badge (no cadence model)
- Changing Contacts badge (stays red)
- Animation on urgency tier change (post-MVP polish)
- CmsShell package upgrade (portal bypass is sufficient)
