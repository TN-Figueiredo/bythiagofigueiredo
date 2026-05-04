# CMS Post Editor + Quick Idea Fixes

**Date:** 2026-05-03
**Status:** Approved
**Score:** 98/100 (v5 mockup)

## Problem

1. **Newsletter kanban**: Missing quick-idea input (blog has it, newsletter doesn't)
2. **Blog kanban**: Quick-idea input exists but nothing is created on Enter
3. **New post page** (`/cms/blog/new`): Uses `PostEditor` from `@tn-figueiredo/cms` which is completely unstyled (raw HTML, zero CSS)

## Design Decisions

### 1. Shared Editor Components → `_shared/editor/`

Move reusable components from `newsletters/_components/` to `cms/(authed)/_shared/editor/`:

- `TipTapEditor` — rich text with slash commands, bubble menu
- `useAutosave` — 3s debounce, 3 retry, offline fallback
- `AutosaveIndicator` — saving/saved/error/offline states
- `NavigationGuard` — beforeunload + router guard
- `MoreMenu` — context menu per status
- `DeleteConfirmModal` — impact-level aware
- `ReadOnlyOverlay` — visual lock for terminal statuses
- `EditorToolbar` (from TipTap) — formatting toolbar
- `BubbleMenu` — inline text formatting popup

Newsletter imports updated to re-export from `_shared/editor/`.

### 2. New Post Editor (`PostEditionEditor`)

Rich editor replacing the unstyled `PostEditor` from `@tn-figueiredo/cms`:

- **Top bar**: ← Hub | locale pill (dropdown) | tag pill (dropdown) | status pill | autosave indicator | Preview | ⋮ More
- **Cover image**: Hero-style drop zone → full-width preview with hover overlay (Remove/Replace)
- **Hero inputs**: Title (auto-grow textarea) + slug (live-generated, shown on focus) + excerpt (auto-grow textarea)
- **Sticky toolbar**: 15px SVG icons with keyboard shortcut tooltips, sticks on scroll
- **TipTap editor**: Borderless, flows into page. `/` slash commands. Centered 780px max-width
- **Internal Notes**: Collapsible, not published
- **SEO**: Inferred Search Preview (live SERP card from title + excerpt). "Customize" link reveals override fields for meta_title, meta_description, og_image_url
- **Bottom bar**: locale flag + tag dot + reading time + word count | ⌘S Save | ⌘⇧P Preview | Esc Exit
- **Ephemeral pattern**: `new` status with pulse animation → auto-creates on title blur → transitions to `draft` with saving animation (amber spin → green glow → fade)
- **No explicit Save button**: Autosave only (matches newsletter pattern). ⌘S for manual save
- **Keyboard shortcuts**: ⌘S save, ⌘⇧P preview, Esc exit (same as newsletter)

### 3. Quick Idea — Optimistic Update

Both blog and newsletter kanban boards:

- **QuickAddInput** component (already exists in blog, shared to newsletter)
- **Optimistic insert**: Card appears instantly in Idea column with `new` badge + indigo border
- **Server confirms**: Card gets real ID, border flashes green, toast "Idea created"
- **Error**: Card removed, toast shows error
- Uses `useOptimistic` (same pattern as kanban drag-and-drop)

**Blog fix**: Debug why `createPost({status:'idea'})` fails silently. Likely migration `20260503000001_post_status_idea.sql` not pushed to prod, or error swallowed in `startTransition`.

**Newsletter addition**: Add `onQuickAdd` prop to newsletter `KanbanColumn`, wire `createIdea` action through `KanbanBoard` → `EditorialTab`.

## Architecture

```
cms/(authed)/
├── _shared/
│   └── editor/           ← NEW: shared editor components
│       ├── tiptap-editor.tsx
│       ├── use-autosave.ts
│       ├── autosave-indicator.tsx
│       ├── navigation-guard.tsx
│       ├── more-menu.tsx
│       ├── delete-confirm-modal.tsx
│       ├── read-only-overlay.tsx
│       ├── bubble-menu.tsx
│       ├── editor-toolbar.tsx  (if exists)
│       └── index.ts           ← barrel re-export
├── blog/
│   ├── new/
│   │   ├── page.tsx           ← server component (unchanged)
│   │   └── post-edition-editor.tsx  ← NEW: rich editor
│   └── _tabs/editorial/
│       ├── quick-add-input.tsx     ← MOVED to _shared/
│       ├── kanban-column.tsx       ← uses shared QuickAddInput
│       ├── kanban-board.tsx        ← passes onQuickAdd + optimistic
│       └── editorial-tab.tsx       ← handleQuickAdd with optimistic
└── newsletters/
    ├── _components/
    │   ├── tiptap-editor.tsx → re-export from _shared/editor
    │   ├── use-autosave.ts   → re-export from _shared/editor
    │   └── ...               → re-export from _shared/editor
    └── _tabs/editorial/
        ├── kanban-column.tsx  ← ADD onQuickAdd + QuickAddInput
        ├── kanban-board.tsx   ← ADD onQuickAdd passthrough
        └── editorial-tab.tsx  ← ADD handleQuickAdd + optimistic
```

## Implementation Tracks (parallel)

| # | Track | Independent? |
|---|-------|-------------|
| 1 | Fix blog quick-idea + optimistic update | Yes |
| 2 | Add newsletter quick-idea + optimistic update | Yes |
| 3 | Move shared components to `_shared/editor/` | Yes |
| 4 | Build PostEditionEditor | Depends on #3 |

Tracks 1, 2, 3 run in parallel. Track 4 runs after 3 completes.
