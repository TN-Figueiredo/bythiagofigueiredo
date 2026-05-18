# Social Composer v6 — Master Implementation Plan

> **For agentic workers:** This is the master plan coordinating 5 phase plans. Execute phases in order (1→5). Within each phase, tasks marked "parallel" can be dispatched simultaneously via superpowers:subagent-driven-development.

**Goal:** Implement the Social Composer v6 spec — dual-mode Instagram Stories, caption variables, OG preview sidebar, template system, pre-publish confirmation, and lifecycle features.

**Spec:** `docs/superpowers/specs/2026-05-17-social-composer-stories-templates-design.md`

**Architecture:** Extends the existing Social Hub (Sprint 5h) with 5 new subsystems layered on the existing social_posts/social_deliveries/social_connections schema. Konva unified rendering engine for both server-side Quick Mode and client-side Design Mode canvas editor. Caption variables resolved at publish time. Templates organized by aspect ratio, not platform.

**Tech Stack:** Next.js 15, React 19, react-konva, konva + canvas (node-canvas), Tailwind 4, Supabase, Vercel Blob, Telegram Bot API, Resend

---

## Phase Dependency Graph

```
Phase 1: Foundation (DB + backend core)
    │
    ├──► Phase 2: Template System (CRUD + render + library)
    │         │
    ├──► Phase 3: Composer UI (caption UI + OG sidebar + confirmation)
    │         │
    │         ├──► Phase 4: Instagram Stories (provider + canvas + notifications)
    │         │
    └─────────┴──► Phase 5: Lifecycle (queue + schedule + analytics + editing)
```

## Prerequisites

Before starting Phase 1, install required dependencies:

```bash
# Server-side Konva rendering (Phase 2)
npm install canvas -w apps/web

# Verify react-konva already installed (konva@10.3.0, react-konva@19.2.4)
npm ls konva react-konva
```

> **Important:** The dual actions file pattern — `actions.ts` (monolithic barrel) and `actions/posts.ts` (modular) both contain `createSocialPost` with independent implementations. When modifying this function, update BOTH files.

## Phase Plans

| Phase | Plan File | Tasks | Est. Hours | Dependencies |
|-------|-----------|-------|-----------|--------------|
| 1 | `2026-05-17-social-composer-phase1-foundation.md` | 4 | ~8h | None |
| 2 | `2026-05-17-social-composer-phase2-templates.md` | 5 | ~12h | Phase 1 |
| 3 | `2026-05-17-social-composer-phase3-composer-ui.md` | 5 | ~14h | Phase 1 |
| 4 | `2026-05-17-social-composer-phase4-stories.md` | 5 | ~16h | Phases 2, 3 |
| 5 | `2026-05-17-social-composer-phase5-lifecycle.md` | 6 | ~12h | Phase 3 |

**Total:** 25 tasks, ~62 hours

## Task Summary Per Phase

### Phase 1: Foundation & Core Backend
1. **DB Migration** — New tables (social_templates, post_metrics, link_in_bio_entries) + ALTER social_posts/deliveries/sites/connections
2. **Caption Variable Resolution** — `resolveCaption()` function with {{link}}, {{title}}, {{url}} substitution
3. **Pipeline Redesign** — Rename og_scrape → platform_prepare, per-platform prepare logic
4. **Bluesky Provider Fixes** — Lazy JWT refresh, proper deleteRecord, uploadBlob for link cards

### Phase 2: Template System
5. **Template CRUD Actions** — Server actions for social_templates (create, update, delete, list, setDefault)
6. **Template Library Page** — `/cms/social/templates` with grid view, aspect ratio tabs, overflow menu
7. **Server-Side Konva Renderer** — `renderTemplate()` using konva + canvas (node-canvas), placeholder hydration
8. **Template Seed Data** — 9 default templates (3 per aspect ratio) with CardComposition JSONB
9. **Settings Matrix** — Content type × platform grid in Settings > Social, stored in sites.social_defaults

### Phase 3: Composer UI Redesign
10. **Caption Textarea with Variable Highlighting** — Regex overlay, per-platform defaults, resolved preview panel
11. **OG Preview Sidebar** — 380px sticky sidebar, per-platform tabs, validation badges, scrape status
12. **Pre-Publish Confirmation Dialog** — JIT link creation, resolved captions, OG cards, platform badges
13. **Template Carousel** — Horizontal scroll below textarea, CSS composite preview, blue ring selection
14. **Duplicate Detection** — Same-content warnings, same-platform confirmation dialog

### Phase 4: Instagram Stories & Notifications
15. **Instagram Provider Fix** — Use media_type='STORIES' in publish(), delivery.format routing
16. **Canvas Editor** — Adapt QR Card Builder for social templates, fixed aspect ratios, CMS auto-populate
17. **Notification System** — Telegram Bot integration + email fallback via Resend
18. **Ready-to-Post Page** — `/cms/social/posts/[id]/ready` mobile-first page
19. **Link-in-Bio Page** — `/go/ig` route on Links Engine, auto-update on story publish

### Phase 5: Lifecycle & Polish
20. **Auto-Share Flow** — Post-publish dialog from blog/newsletter/campaign editors
21. **Queue (Fila)** — FIFO scheduling with configurable time slots, queue view page
22. **Schedule Calendar Integration** — Indigo pills for social posts on unified calendar
23. **Analytics MVP** — post_metrics cron polling, inline engagement display
24. **Post Editing** — Per-platform edit rules, caption-only updates, Bluesky delete+recreate
25. **Error Handling UI** — Per-platform status banner, retry button, reconnect link
