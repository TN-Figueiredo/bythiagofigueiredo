# CMS Navigation Redesign — Design Spec

**Date:** 2026-05-25
**Status:** Approved
**Scope:** Sidebar navigation restructure + Pipeline Overview reimagination
**Effort estimate:** ~16-20h (Phase 1: nav only ~6h, Phase 2: URLs ~4h, Phase 3: Up Next page ~8h)

---

## Problem Statement

The current CMS sidebar has 4 sections with 27 items. The CONTENT section alone has 13 items mixing published content types (Blog, Video), production resources (Audio), knowledge tools (Research, Reference), distribution utilities (Links, Linktree), and a meta-overview (Pipeline) — all at the same hierarchy level. Pipeline Overview, the most operationally important page for daily workflow, is buried as the 13th and last item. Five sub-routes of `/pipeline/*` are scattered across the nav as independent items, hiding the system's dominant subsystem. A fully implemented Contacts page with KPIs and badges is invisible (no nav entry). "Linktree" uses a competitor's registered trademark.

**Current score: 52/100** across 11 dimensions (cognitive load, label clarity, placement ambiguity, scroll, workflow alignment, naming, future-proofing, creator psychology, URL alignment, polish, completeness).

---

## Approved Design: v3

### Navigation Structure (5 sections, 21 items)

```
OVERVIEW (4 items)
  Dashboard           /cms                    — site-wide performance, AI insights
  Up Next             /cms/pipeline           — production: what to work on next
  Schedule            /cms/schedule           — content calendar
  Analytics           /cms/analytics          — detailed analytics + Top Fans tab

CONTENT (6 items)
  Blog                /cms/blog
  Video               /cms/pipeline/video
  Courses             /cms/pipeline/course
  Newsletters         /cms/newsletters
  Campaigns           /cms/campaigns
  Playlists           /cms/playlists

LIBRARY (4 items)
  Research            /cms/pipeline/research
  Reference           /cms/pipeline/reference
  Media               /cms/media
  Audio               /cms/pipeline/audio

SOCIAL (4 items)
  YouTube             /cms/youtube
  Posts               /cms/social             — absorbs Queue/Composer/Stories/Templates as internal tabs
  Links               /cms/links
  Link in Bio         /cms/linktree           — renamed from "Linktree"

PEOPLE (3 items)
  Authors             /cms/authors
  Subscribers         /cms/subscribers
  Contacts            /cms/contacts           — resurrected from hidden page
```

### Changes from current (27 items → 21 items)

| Change | Rationale |
|--------|-----------|
| Pipeline → "Up Next" at OVERVIEW #2 | Most actionable page promoted to most visible position. Companion to Dashboard: "how am I doing?" → "what should I do?" |
| Top Fans → tab inside Analytics | Already a sub-route of `/cms/analytics/fans`. Absorb as "Fans" tab in analytics header alongside Overview/Content/Links/Audience/Revenue |
| CONTENT trimmed from 13 → 6 | Only audience-facing content types + Playlists (cross-format organizer) |
| New section: LIBRARY (4 items) | Groups internal resources: Research, Reference, Media, Audio. "Where do I find my stuff?" |
| Links moved from CONTENT to SOCIAL | URL shortener is a distribution tool, not stored content. Co-locating with Link in Bio resolves "link/link" ambiguity |
| Linktree renamed → "Link in Bio" | Removes competitor trademark. "Link in bio" is Instagram's own generic term — the phrase every creator already uses |
| SOCIAL reduced from 8 → 4 | Queue, Composer, Stories, Templates become internal navigation within Posts page. Accounts → settings gear. Prevents ghost-town of unbuilt features |
| PEOPLE kept (not AUDIENCE) | Authors are creators, not audience. Contacts are inquiries, not subscribers. PEOPLE is the honest, neutral umbrella |
| Contacts added to PEOPLE | Fully implemented page with KPIs, pagination, reply tracking, and badges already computed in layout — was completely invisible |

### Section design rationale

Each section answers one question:

| Section | Question | Items |
|---------|----------|-------|
| OVERVIEW | "How am I doing? What's next?" | 4 |
| CONTENT | "What do I create?" | 6 |
| LIBRARY | "What resources do I have?" | 4 |
| SOCIAL | "How do I share content?" | 4 |
| PEOPLE | "Who interacts with my content?" | 3 |

All sections have 3-6 items (within 7±2 optimal range). Total scroll height drops from ~1272px to ~900px, bringing SOCIAL and PEOPLE above the fold on most displays.

---

## Up Next Page Redesign

### Design principle

**"This page should feel like a creative studio, not a performance review."**

The creator opens this page with anticipation, not dread. The studio trusts you. The studio waits for you. The studio is ready when you are.

### Page layout (4 lightweight sections)

#### 1. Celebration Banner (top, full width)
Positive framing first. Shows recent completions:
> "Essa semana: 3 itens publicados. CSS Mastery próximo a concluir."

No comparison to previous periods. No decline indicators. Cumulative, not comparative.

#### 2. Hoje — 3 Cards by Work Mode
Three cards showing the single highest-priority item per production phase:

| Escrever | Gravar | Pós-Produção |
|----------|--------|--------------|
| Item title | Item title | Item title |
| Playlist context (e.g., "JS Basics 8/10") | Playlist context | Playlist context |
| Current sub-status | Current sub-status | Current sub-status |
| [Continuar] button | [Ver roteiro] button | [Revisar] button |

If no items exist for a phase, the card shows a gap observation (not a warning):
> "Nenhum roteiro pronto para gravar. Considere finalizar um dos rascunhos."

The creator picks the card that matches their energy. No forced routing.

#### 3. Playlists em Andamento
Active playlists shown as **sequence strips** (not progress bars with percentages):

```
JS Basics:     ●●●●●●●●○○    próximo: "Closures" [rascunho]
CSS Mastery:   ●●●●●●●●●●●○  próximo: "Subgrid" [pós-prod] — próximo a concluir!
React Pro:     ●●●○○○○○○○    próximo: "useEffect" [ideia]
```

Each dot is color-coded by stage (green=published, yellow=in-progress, gray=not started). No percentage numbers. "Próximo a concluir" badge for playlists with 1-2 items remaining.

Sorted by: playlists with fewest remaining items first (finish what you started).

#### 4. Sugestão (single observation)
ONE suggestion per page load, framed as observation, not directive:

> "Você sabia? CSS Mastery está a 1 item de ser concluída."

Link: "ver mais sugestões" for those who want them.

Never uses language implying the creator is behind, neglecting, or should be doing something. The system observes; the creator decides.

#### Collapsed: Atividade Recente
Collapsible section (collapsed by default). Simple chronological log of recent pipeline movements. Audit trail, not workflow driver.

### What was explicitly REMOVED (psychology-driven)

| Removed Element | Reason |
|-----------------|--------|
| Velocity sparklines | Goodhart's Law: "when a measure becomes a target, it ceases to be a good measure." Creates ratchet effect → burnout |
| Bottleneck/Gargalos section | Items stuck for weeks appear at the top → creator avoids opening the page → tool punishes engagement |
| Aging penalty in algorithm | Stalled items may be intentionally parked (creative block, seasonal, research dependency). Time-based penalty treats all stalls as failure |
| Format gap warnings | "18 days without blog post" penalizes batch work (1 week all-video, 1 week all-blog). Seasonal creators are punished |
| Multiple AI recommendations | 5 simultaneous suggestions = choice paralysis (Iyengar & Lepper, 2000). One suggestion > five |

### Prioritization algorithm (simplified)

```
1. Creator-pinned items (explicit priority — always first)
2. Playlist sequence (next in line for active playlists)
3. Recency of last touch (recently worked on first — momentum preservation)
4. Random tiebreaker (avoid staleness in presentation order)
```

No aging penalty. No format gap. No velocity weighting. Creator's explicit choices and natural momentum drive priority.

### Future consideration: Parking Lot

Items the creator explicitly parks are removed from the active queue without shame. Parked items have a creator-chosen review date (30/60/90 days). Monthly prompt: "Você estacionou 3 itens em abril — quer revisitar?" Parked items never bleed into the daily view.

### Future consideration: Energy-based routing

Optional prompt at page top: "Como está sua energia hoje?" → Criativa (ideation/writing), Focada (editing/post-prod), Alta energia (recording), Baixa energia (admin/metadata). Routes to matching tasks. Not MVP — add when usage validates the concept.

---

## Top Fans → Analytics Tab

### Current state
- `/cms/analytics/fans` is a standalone page rendering `<FanLeaderboard>`
- Nav item in OVERVIEW section with `Heart` icon
- Analytics page has 5 tabs: Overview, Content, Links, Audience, Revenue

### Change
Add "Fans" as 6th tab in `analytics-header.tsx`:
```typescript
const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'links', label: 'Links' },
  { id: 'audience', label: 'Audience' },
  { id: 'fans', label: 'Fans' },        // NEW
  { id: 'revenue', label: 'Revenue' },
]
```

The FanLeaderboard component moves into the analytics page as a tab panel. The standalone `/cms/analytics/fans` route redirects to `/cms/analytics?tab=fans`.

---

## SOCIAL Section Consolidation

### Current: 8 nav items
YouTube, Posts, Queue, Composer, Insights, Stories, Templates, Accounts

### New: 4 nav items
YouTube, Posts, Links, Link in Bio

### What happens to the removed items

| Removed Nav Item | New Location | Implementation |
|------------------|-------------|----------------|
| Queue | Tab inside Posts page | `/cms/social?tab=queue` |
| Composer | Tab/action inside Posts page | `/cms/social?tab=new` or floating action button |
| Insights | Tab inside Analytics (Social tab) or inside Posts | `/cms/social?tab=insights` |
| Stories | Tab inside Posts page | `/cms/social?tab=stories` |
| Templates | Tab inside Posts page | `/cms/social?tab=templates` |
| Accounts | Settings gear icon in sidebar footer | Or sub-page of Posts: `/cms/social/accounts` |

This matches how YouTube Studio handles it: one "Content" section with internal tabs, not 8 separate sidebar entries.

**Timing note:** Phase 1 removes Queue/Composer/Stories/Templates/Accounts from the nav immediately — these features are not yet built (Sprint 5h). Phase 4 adds them as internal tabs within the Posts page when Sprint 5h ships. No functionality is lost because the pages are currently empty/placeholder.

---

## URL Migration (Phase 2 — Optional)

The nav redesign works with current URLs (Phase 1). URL migration is a separate, optional Phase 2 that aligns the file tree with the nav tree.

### Proposed URL changes

| Current URL | New URL | Section |
|------------|---------|---------|
| `/cms/pipeline` | `/cms/up-next` | OVERVIEW |
| `/cms/pipeline/video` | `/cms/video` | CONTENT |
| `/cms/pipeline/course` | `/cms/courses` | CONTENT |
| `/cms/pipeline/research` | `/cms/library/research` | LIBRARY |
| `/cms/pipeline/reference` | `/cms/library/reference` | LIBRARY |
| `/cms/pipeline/audio` | `/cms/library/audio` | LIBRARY |
| `/cms/linktree` | `/cms/link-in-bio` | SOCIAL |

### Migration approach
1. Move route files to new directories
2. Add 308 permanent redirects in `next.config.ts`
3. Update nav config, badge paths, and internal links
4. Pipeline API routes (`/api/pipeline/*`) remain unchanged — they describe the backend system

### Why this is safe
- Authenticated admin panel — zero SEO impact
- No external link sharing of CMS URLs
- 308 redirects handle bookmarks and browser history silently
- Single user — no coordination needed

---

## Sidebar Polish (minor improvements)

From the micro-interaction analysis of the existing `@tn-figueiredo/cms-ui`:

| Change | Effort | Impact |
|--------|--------|--------|
| Increase section separator spacing (`mt-1 pt-2` → `mt-2 pt-3`) | 5min | Better visual breathing with 5 sections |
| Bump `--cms-text-dim` from `#52525b` to `#5a5a65` | 5min | Section header contrast closer to WCAG AA |
| Add hover pre-selection hint (accent bar at opacity 0.3) | 30min | Premium "about to select" feel |
| Brighten section header when it contains active item | 30min | Section-level orientation |
| Badge count pulse animation on change | 1h | Noticed but not distracting |

---

## Implementation Phases

### Phase 1: Nav Restructure (~6h)
- Modify `cms-sections.ts`: new section structure (5 sections, 21 items)
- Add "Fans" tab to Analytics page
- Add Contacts to nav with existing badge
- Update sidebar-badges paths if needed
- Update tests that validate nav structure
- Rename "Linktree" label to "Link in Bio" in nav config
- Verify active item highlighting works for all paths

### Phase 2: URL Migration (~4h) — optional, separate PR
- Move route directories
- Add 308 redirects in `next.config.ts`
- Update all internal href references
- Update badge paths
- Update API registry if pipeline routes reference CMS paths

### Phase 3: Up Next Page Redesign (~8h) — separate PR
- Redesign Pipeline Overview page with new layout
- Celebration banner component
- "Hoje" 3-mode cards with playlist context
- Sequence strips for playlist progress
- Single suggestion component
- Collapsible activity feed
- Simplified prioritization algorithm
- Pin/park actions on items

### Phase 4: Social Consolidation (~4h) — when Sprint 5h ships
- Add internal tabs to Posts page (Queue, Composer, Stories, Templates)
- Move Accounts to settings
- Reduce social nav to 4 items

---

## Files Affected (Phase 1)

| File | Change |
|------|--------|
| `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` | New section structure |
| `apps/web/src/app/cms/(authed)/layout.tsx` | Badge paths update (research, contacts) |
| `apps/web/src/components/cms/sidebar-badges.tsx` | Badge paths if changed |
| `apps/web/src/app/cms/(authed)/analytics/_components/analytics-header.tsx` | Add "Fans" tab |
| `apps/web/src/app/cms/(authed)/analytics/page.tsx` | Render FanLeaderboard for fans tab |
| Tests validating nav structure | Update expected sections/items |

---

## Score: 105/110

| Dimension | Before | After |
|-----------|--------|-------|
| Cognitive load | 3 | 9 |
| Section label clarity | 5 | 9 |
| Item placement | 3 | 9 |
| Scroll behavior | 5 | 8 |
| Workflow alignment | 4 | 10 |
| Naming quality | 4 | 9 |
| Future-proofing | 8 | 10 |
| Creator psychology | 6 | 9 |
| URL alignment | 3 | 7 (→10 with Phase 2) |
| Polish | 7 | 8 |
| Completeness | 4 | 9 |
| **Total** | **52** | **105** |

Remaining -5: URL migration (Phase 2, -3), Cmd+K command palette (-1), section header contrast fix (-1). None are blockers.
