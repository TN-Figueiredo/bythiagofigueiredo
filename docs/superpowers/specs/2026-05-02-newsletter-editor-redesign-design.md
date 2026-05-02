# Newsletter Edition Editor Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the newsletter edition editor (`/cms/newsletters/[id]/edit`) to fix two problems: (1) immediate DB persistence on "New Edition" creates orphan drafts, (2) the editor UI is rated 30/100 due to light-theme CSS vars clashing with the dark hub.

**Architecture:** Replace the server-side INSERT on `/cms/newsletters/new` with an ephemeral editor that defers DB persistence until first meaningful edit (isDirty pattern). Overhaul the editor layout from flat light-theme to a focused dark-theme writer (Approach A: Focused Writer) with hero inputs, inline segment, compact toolbar, and state-aware chrome.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TipTap, Sonner toasts, Supabase.

**Approved Visual Mockups:** See `.superpowers/brainstorm/24183-1777743683/content/editor-states.html` (100/100 rating, 1840 lines, 27 visual components).

---

## 1. isDirty Pattern: Deferred Persistence

### Problem

`/cms/newsletters/new/page.tsx` is a server component that immediately INSERTs a `newsletter_editions` row with `subject: 'Untitled Edition'`, then redirects to the editor. If the user navigates away without editing, an orphan draft remains.

### Solution

Replace the server INSERT with a client-side ephemeral state. The editor opens with empty fields and no DB record. On first meaningful edit (typing into subject, preheader, or body), the editor calls a new `createEdition` server action that INSERTs the row and returns the `id`. Subsequent edits use the existing `saveEdition` action.

### Meaningful Edit Detection

An edit is "meaningful" when any of these conditions are true:
- `subject` is changed from the empty/placeholder state
- `preheader` has any content typed
- TipTap editor `onUpdate` fires with non-empty content (`editor.isEmpty === false`)

### New Edition Route Change

`/cms/newsletters/new` becomes a lightweight redirect to `/cms/newsletters/new/edit` (or the editor renders in ephemeral mode when no `id` param is present). The server component validates auth and type param, then renders `<EditionEditor>` with `edition={null}` and `typeId` passed separately.

### EditionEditor Props Change

```typescript
interface EditionEditorProps {
  edition: EditionData | null  // null = ephemeral (new)
  subscriberCount: number
  types: Array<{ id: string; name: string; color: string }>
  initialTypeId?: string | null  // pre-selected from hub filter
}
```

When `edition` is null:
- No `id` in state — autosave is disabled
- No status pill, no edition display ID, no "..." menu
- Preview and Schedule buttons are disabled
- Hint banner shown: "This edition will be created when you start typing. Navigate away to discard."
- `Esc` key discards and navigates back to hub
- Bottom bar shows "No segment selected" and `⌘S save | Esc discard` shortcuts

### Transition: Ephemeral to Draft

On first meaningful edit:
1. Call `createEdition(siteId, { subject, preheader, content_json, content_html, newsletter_type_id, segment })` server action
2. Server action returns `{ ok: true, editionId: string }` or error
3. On success:
   - Update internal state with the new `id`
   - Replace URL via `router.replace(`/cms/newsletters/${id}/edit`)` (no full page reload)
   - Enable autosave with the new `id`
   - Fade out hint banner (CSS transition)
   - Show DRAFT status pill, edition display ID, and "..." menu
   - Enable Preview and Schedule buttons
   - Autosave indicator transitions from "Unsaved" (gray dot) to "Saving..." (yellow pulsing dot) to "Saved 14:32" (green dot)
4. On error: show toast error, keep ephemeral state

### New Server Action

```typescript
// actions.ts
export async function createEdition(data: {
  subject: string
  preheader?: string
  content_json?: string
  content_html?: string
  newsletter_type_id?: string | null
  segment?: string
}): Promise<{ ok: true; editionId: string } | { ok: false; error: string }>
```

Uses `getSupabaseServiceClient()` with `requireSiteScope` guard. INSERTs into `newsletter_editions` with `status: 'draft'`, `site_id` from site context, `created_by` from auth.

---

## 2. Editor Layout Redesign

### Design Approach: Focused Writer (Approach A)

Dark theme (`bg-[#030712]`) matching the newsletter hub. Subject and preheader as hero inputs (like Notion page titles). Toolbar below content heading area. Actions in a compact top bar. Secondary actions in a "..." menu. Metadata in a bottom status bar.

### Layout Structure (Top to Bottom)

```
┌─────────────────────────────────────────────────────────┐
│ TOP BAR                                                  │
│ ← Hub | #NL-007 | [Type Badge ▾] | DRAFT | ● Saved     │
│                          Preview | Schedule | ⋮          │
├─────────────────────────────────────────────────────────┤
│ CONTEXTUAL BANNER (optional per state)                   │
│ e.g., hint, schedule countdown, error, sending progress  │
├─────────────────────────────────────────────────────────┤
│ HERO AREA (px-16 / 64px sides)                          │
│ Subject line (26px, bold, hero input)                    │
│ Preheader (14px, muted, hero input)                      │
├─────────────────────────────────────────────────────────┤
│ SEGMENT SELECTOR (inline chip)                           │
│ Send to: [All subscribers (120) ▾]                       │
├─────────────────────────────────────────────────────────┤
│ TOOLBAR (sticky, mx-16)                                  │
│ Undo Redo | P H1 H2 H3 | B I U S | ⇐ ⇔ ⇒ |           │
│ • # ❝ — | 🔗 📷 ▭ ◆ |          342 words | ⛶           │
├─────────────────────────────────────────────────────────┤
│ WRITING AREA (flex:1, overflow-y:auto, max-w-740px)     │
│ [TipTap ProseMirror content area]                        │
│                                                          │
│ [Collapsible Notes section at bottom]                    │
├─────────────────────────────────────────────────────────┤
│ BOTTOM BAR (sticky bottom)                               │
│ 👥 120 subscribers · All segments · ~2 min read          │
│                      ⌘S save | ⌘⇧P preview | ⌘⇧N new   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Color Token System

All CSS custom properties (`var(--bg-surface, #fff)`, etc.) are replaced with hardcoded dark values. The editor-styles.css vars are rewritten.

### Token Reference (WCAG AA compliant)

| Token | Hex | Usage | Contrast on #030712 |
|-------|-----|-------|---------------------|
| Subject text | `#f9fafb` | Hero subject input | 18.5:1 |
| Body text | `#d1d5db` | ProseMirror content | 11.4:1 |
| Secondary text | `#9ca3af` | Labels, metadata | 7.0:1 |
| Metadata/labels | `#6b7280` | Bottom bar, toolbar inactive | 4.6:1 |
| Placeholder/hints | `#4b5563` | Input placeholders (decorative) | 3.2:1 |
| Links | `#a78bfa` | Anchor tags in content | 6.4:1 |
| Toolbar icons default | `#6b7280` on `#0a0f1a` | Inactive toolbar buttons | 4.2:1 |
| Toolbar icons active | `#818cf8` on `#0a0f1a` | Active toolbar buttons | 5.8:1 |

### Surface Colors

| Surface | Hex | Usage |
|---------|-----|-------|
| Page background | `#030712` | Editor body |
| Toolbar/notes background | `#0a0f1a` | Inset surfaces |
| Modal/dropdown background | `#111827` | Floating surfaces |
| Border primary | `#1f2937` | Section separators, toolbar border |
| Border emphasis | `#374151` | Modal borders, hover states |

---

## 4. Top Bar

### Structure

Left side: `← Hub` link | vertical divider | edition ID (`#NL-007` monospace) | type badge button with chevron | status pill | autosave indicator

Right side: Preview button (secondary) | Schedule button (primary) | "..." more menu button

### Component Behavior

**Back link:** `← Hub` with arrow icon, navigates to `/cms/newsletters`. Triggers unsaved changes guard if `hasUnsavedChanges`.

**Edition ID:** Monospace `#NL-007` badge. Only shown after persistence (not in ephemeral state). Display format: `#NL-{sequence}` where sequence is a truncated edition number or short ID.

**Type badge:** Clickable pill showing current type with color dot and chevron. Opens type selector dropdown on click. Ephemeral state shows "No type" with indigo tint. Changing type calls `saveEdition` (or updates ephemeral state if pre-persistence).

**Status pill:** Uppercase, letter-spaced, color-coded per status:
- Draft: `bg-[#1f2937] text-[#9ca3af]`
- Scheduled: `bg-purple-500/15 text-[#c084fc]`
- Sending: `bg-blue-500/15 text-[#60a5fa]`
- Sent: `bg-green-500/15 text-[#4ade80]`
- Failed: `bg-red-500/15 text-[#f87171]`

Not shown in ephemeral state.

**Autosave indicator:** 5 states with colored dot:
- Saved: green dot `#22c55e`, "Saved 14:32" in `#4b5563`
- Saving: yellow pulsing dot `#eab308`, "Saving..." in `#eab308`
- Unsaved: gray dot `#6b7280`, "Unsaved" in `#6b7280`
- Error: red dot `#ef4444`, "Save failed — retry" (clickable underline) in `#ef4444`
- Offline: orange dot `#f97316`, "Offline — saved locally" in `#f97316`

---

## 5. Contextual Banners

State-dependent banners appear below the top bar. Only one banner at a time.

### Banner Types

**Ephemeral hint** (State 1 — New):
- Background: `rgba(99,102,241,0.04)`, border-bottom: `rgba(99,102,241,0.1)`
- Info icon `#818cf8` + text "This edition will be created when you start typing. Navigate away to discard."
- Fades out with CSS transition on first meaningful edit

**Schedule countdown** (State 5 — Scheduled):
- Background: `rgba(168,85,247,0.05)`, border-bottom: `rgba(168,85,247,0.12)`
- Clock icon + "Scheduled for **May 5, 2026 at 08:00** (America/Sao_Paulo)" + right-aligned "Sends in 3 days"

**Sending progress** (State 6 — Sending):
- Background: `rgba(59,130,246,0.05)`, border-bottom: `rgba(59,130,246,0.12)`
- Spinner icon + "Sending to subscribers..." + "84 / 120 sent"
- Progress bar: `height:3px`, track `#1e3a5f`, fill `#3b82f6`

**Error banner** (State 8 — Failed):
- Background: `rgba(239,68,68,0.06)`, border-bottom: `rgba(239,68,68,0.15)`
- X-circle icon + error message + timestamp

---

## 6. Hero Inputs (Subject & Preheader)

Replace the labeled input fields with Notion-style hero inputs.

**Subject:** `font-size:26px`, `font-weight:700`, `letter-spacing:-0.5px`, `color:#f9fafb`. No border, no label, transparent background. Placeholder: "Type your subject line..." in `#6b7280`.

**Preheader:** `font-size:14px`, `color:#6b7280`, margin-top 6px. Placeholder: "Preview text shown in the inbox (optional)" in `#6b7280`.

Both inputs use `padding:28px 64px 0` (hero area padding), matching the toolbar and content area side margins.

In read-only states (Sent, Sending), text color drops to `#9ca3af` for subject and `#4b5563` for preheader.

---

## 7. Segment Selector

Inline chip replacing the `<select>` dropdown. Positioned below hero inputs, above toolbar.

`Send to:` label in `#4b5563` 10px + pill button: `border:1px solid #1f2937`, `bg-[#0a0f1a]`, `color:#9ca3af`, `border-radius:999px`, `padding:3px 10px`, with chevron icon.

Options: All subscribers (count) | High engagement | Re-engagement | New subscribers.

In ephemeral state: shows "No segment selected" in bottom bar instead.

---

## 8. Toolbar

### Migration from Light to Dark

Current toolbar uses `border-[var(--border,#e5e7eb)]`, `bg-[var(--bg-surface,#ffffff)]/95`. Replace with:
- Container: `border:1px solid #1f2937`, `border-radius:8px`, `bg-[#0a0f1a]`, `mx-16` (64px sides)
- Not sticky to top of viewport; positioned below segment selector
- Margin-top: 12px from segment area

### Button States (dark theme)

- Default: `color:#6b7280`
- Hover: `bg-[#1f2937] color:#d1d5db`
- Active (on): `bg-indigo-500/15 color:#818cf8`
- Disabled: `color:#374151`

### Toolbar Groups (left to right)

1. Undo / Redo (disabled states via `editor.can()`)
2. Block type: Paragraph (P icon), H1, H2, H3
3. Inline: Bold, Italic, Underline, Strikethrough
4. Alignment: Left, Center, Right
5. Lists & blocks: Bullet, Ordered, Blockquote, Divider
6. Rich: Link, Image, CTA Button, Merge Tags
7. Spacer (flex:1)
8. Word count: "342 words · 1,847 chars · 2 images" in `#6b7280` 10px
9. Fullscreen toggle

### Ephemeral State Toolbar

Same full toolbar but with muted colors (`#4b5563` instead of `#6b7280`) to indicate inactive state visually. All buttons functional — typing in toolbar-inserted content triggers the isDirty transition.

---

## 9. Writing Area & ProseMirror Styles

### CSS Migration

`editor-styles.css` variables are replaced:

```css
.newsletter-editor {
  --editor-bg: #030712;
  --editor-text: #d1d5db;
  --editor-text-secondary: #9ca3af;
  --editor-text-tertiary: #6b7280;
  --editor-border: #1f2937;
  --editor-surface-hover: #111827;
  background-color: #030712;
  color: #d1d5db;
}
```

### Content Area

- `max-width:740px`, `margin:0 auto`, `width:100%`
- `padding:24px 64px`
- `flex:1`, `overflow-y:auto`
- Headings: `color:#f3f4f6` (20px H2, 17px H3)
- Body text: `color:#d1d5db`, `font-size:15px`, `line-height:1.75`
- Links: `color:#a78bfa`, underline with `text-decoration-color:rgba(167,139,250,0.3)`
- Blockquote: `border-left:3px solid #6366f1`, `color:#9ca3af`
- Code inline: `bg-[#111827]`, `color:#c4b5fd`
- Code block: `bg-[#0f172a]`, `color:#e2e8f0`, `border:1px solid #1f2937`
- CTA button: `bg-[#6366f1]`, `color:white`, `border-radius:6px`
- Merge tags: `bg-purple-500/15`, `color:#a78bfa`, monospace
- Images: `border-radius:8px`, selected outline `#7c3aed`
- Placeholder: "Start writing your newsletter... Type `/` for commands" in `#4b5563`

### Read-Only Modes

Sent and Sending states: headings `#9ca3af`, body `#6b7280`, links muted to `#818cf8`, CTA buttons `bg-[#374151] text-[#9ca3af]`, blockquote border `#374151`.

---

## 10. Notes Section

Collapsible `<details>` element placed below the writing content, inside the scrollable area.

### Collapsed State
- Container: `border:1px solid #1f2937`, `border-radius:8px`, `bg-[#0a0f1a]`
- Summary: file icon + "Internal notes (not sent)" + `optional` badge in `#4b5563`

### Expanded State
- Content area below divider line
- Textarea or plain text area, `color:#d1d5db`, `font-size:13px`
- Placeholder: "Add internal notes, references, or context for this edition..."

---

## 11. Bottom Bar

Sticky to bottom of editor viewport.

### Structure

Left: subscriber icon + "120 subscribers · All segments · ~2 min read" in `#6b7280` 10px
Right: keyboard shortcuts in `#4b5563` 10px with `<kbd>` styling (`bg-[#1f2937]`, `padding:1px 4px`, `border-radius:3px`, `font-size:9px`)

### Shortcuts by State

- Draft: `⌘S save | ⌘⇧P preview | ⌘⇧N new`
- Ephemeral: `⌘S save | Esc discard`
- Sent/Sending: lock icon + "Read-only — this edition has been sent" / "Locked during send"
- Failed: "Retry will only send to unsent subscribers"

---

## 12. "..." More Menu

Replaces inline action buttons (Send Test, Duplicate, Delete) with a dropdown triggered by a `⋮` button.

### Menu Items Per State

**Draft / Ephemeral:**
- Send Test Email (mail icon)
- Duplicate (copy icon)
- ──────────
- Send Now... (checkmark icon, amber `#f59e0b`)
- ──────────
- Delete (trash icon, red `#ef4444`)

**Scheduled:**
- Send Test Email
- Duplicate
- ──────────
- Send Now (skip schedule)... (amber)
- ──────────
- Delete (red)

**Sent:**
- Duplicate as New Draft
- View Web Archive (external link icon)

**Failed:**
- Send Test Email
- Duplicate
- ──────────
- Delete (red)

### Styling
- Container: `bg-[#111827]`, `border:1px solid #374151`, `border-radius:8px`, `shadow-lg`
- Items: `padding:7px 14px`, `font-size:12px`, icon + label, gap 8px
- Hover: `bg-white/5`
- Separators: `height:1px`, `bg-[#1f2937]`
- Position: anchored below the "..." button, right-aligned

---

## 13. State Machine: 8 Editor States

### State 1: New Edition (Ephemeral)
- No DB record exists
- No status pill, no edition ID, no "..." menu
- Hint banner visible
- Preview and Schedule disabled
- Toolbar muted
- Bottom bar: "No segment selected" + `⌘S save | Esc discard`

### State 2: Draft (Active Editing)
- DB record exists with `status='draft'`
- Full toolbar active
- All actions available
- Autosave enabled
- Primary state — where users spend most time

### State 3: Preview (Desktop/Mobile)
- Toggle replaces editor content with rendered email preview
- Top bar: device toggle (Desktop/Mobile tabs) + "Send Test" button + "Back to Editor" button (pencil icon, indigo border)
- Subject/preheader shown in an email-client-style header bar
- Desktop: white email card centered in dark background, 600px wide
- Mobile: phone frame (375px) with status bar
- Email footer: "You're receiving this because..." + Unsubscribe / View in browser links

### State 4: Schedule Modal
- Overlay modal with dimmed editor background
- Fields: Date picker, Time input, timezone display, segment selector
- Summary: "Will be sent to **120 subscribers** on **May 5 at 08:00**"
- Validation: past date shows inline error
- Actions: Cancel + Schedule (indigo)

### State 5: Scheduled (Editable with Countdown)
- Purple countdown banner with clock icon
- "Unschedule" button replaces Schedule in top bar (outlined purple)
- Content still editable
- "..." menu includes "Send Now (skip schedule)..."

### State 6: Sending (In Progress)
- Blue progress banner with spinner + progress bar
- Content locked (read-only overlay)
- Status pill: "Sending" blue
- Only Preview available in top bar
- Bottom bar: "84 / 120 sent · All segments" + lock icon

### State 7: Sent (Read-Only with Stats)
- Stats strip below top bar: Delivered (count), Open Rate (%), Click Rate (%), Bounces (count)
- Stat colors: delivered white, opens green, clicks indigo, bounces amber
- Content in muted read-only palette
- "Analytics" link button in top bar
- Sent timestamp shown next to status pill
- Bottom bar: "118 / 120 delivered · All subscribers · 342 words · ~2 min read"

### State 8: Failed (Error with Retry)
- Red error banner with error message + timestamp
- Partial stats strip: Delivered (partial), Pending (red), Open Rate (green)
- "Retry Send" primary button (red) in top bar
- Content editable for fixes before retry
- Bottom bar: "84 / 120 delivered (36 pending retry)" in red + "Retry will only send to unsent subscribers"

---

## 14. Dialogs and Overlays

### Send Now Confirmation
- Warning icon (amber) + "Send this edition now?" + "This action cannot be undone."
- Summary card: subject bold + "Will be sent to **120 subscribers** in **All segments** immediately."
- Actions: Cancel (secondary) + Send Now (amber `#f59e0b`, text `#111827`)

### Delete Confirmation
- Trash icon (red) + "Delete this edition?" + "This action cannot be undone."
- Summary card: `#NL-007 · Subject line`
- Actions: Cancel + Delete (red)

### Send Test Email
- Mail icon (blue) + "Send Test Email"
- Email input pre-filled with user's email
- Note: "A preview email will be sent with [TEST] prefix in the subject line."
- Preview of subject line
- Actions: Cancel + Send Test (indigo)

### Unsaved Changes Warning
- Warning icon (amber) + "Unsaved changes" + "You have edits that haven't been saved yet."
- Actions: Discard (red outlined) + Cancel (secondary) + Save & Leave (indigo primary)

---

## 15. Inline Popovers

### Link Preview
Appears when clicking an existing link in content. Mini bar showing: truncated URL in `#818cf8` | divider | edit icon | open-external icon | unlink icon (red).

### Link Edit
Appears from link toolbar button or `⌘K`. Fields: URL input + "Open in new tab" checkbox. Actions: Remove (red text) + Apply (indigo).

### CTA Button Edit
Appears when clicking an existing CTA button. Fields: Button text input + Link URL input + Style toggle (Filled/Outline). Actions: Remove (red text) + Save (indigo).

### Image Hover Toolbar
Floating toolbar appears on image hover. Positioned top-right of image. Buttons: Replace (swap icon), Alt text (document icon), Remove (trash, red). Background: `rgba(0,0,0,0.7)`, `border-radius:6px`.

---

## 16. Image Upload States

### Drop Zone
`border:2px dashed #6366f1`, `bg-indigo-500/4`. Image icon + "Drop image here" + "PNG, JPG, GIF, WebP · Max 5MB"

### Uploading
Skeleton shimmer in `#111827` → `#1f2937`. Spinner + "Uploading hero-image.png (67%)..."

### Upload Error
`border:1px solid rgba(239,68,68,0.2)`, `bg-red-500/4`. Error icon + message. Buttons: Remove + Retry.

### Uploaded
Image displayed with `border-radius:8px`. Hover reveals toolbar overlay.

---

## 17. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘S` | Save immediately |
| `⌘⇧P` | Toggle preview |
| `⌘⇧N` | New edition (from draft) |
| `Esc` | Discard ephemeral / exit fullscreen |
| `⌘K` | Insert/edit link |
| `⌘B/I/U` | Bold/Italic/Underline |
| `/` | Slash command menu |

---

## 18. Files to Modify

| File | Change |
|------|--------|
| `newsletters/new/page.tsx` | Remove DB INSERT. Redirect to editor in ephemeral mode. |
| `newsletters/[id]/edit/page.tsx` | Support both existing edition fetch and ephemeral (no id) mode. Dark background wrapper. |
| `newsletters/[id]/edit/edition-editor.tsx` | Complete rewrite: dark theme layout, isDirty pattern, new top bar/hero/toolbar/bottom bar structure, state machine. |
| `newsletters/_components/editor-styles.css` | Replace light-theme CSS vars with dark hardcoded values. |
| `newsletters/_components/editor-toolbar.tsx` | Dark theme: replace all `var(--*)` refs, update ToolbarButton/ToolbarDivider/LinkPopover/MergeTagDropdown colors. Add word/char/image count display. |
| `newsletters/_components/autosave-indicator.tsx` | Dark theme color updates for all 5 states. |
| `newsletters/_components/use-autosave.ts` | Support ephemeral mode (disabled until id is set). |
| `newsletters/_components/schedule-modal.tsx` | Dark theme restyle. |
| `newsletters/_components/send-now-modal.tsx` | Dark theme restyle + summary card. |
| `newsletters/_components/delete-confirm-modal.tsx` | Dark theme restyle + edition info card. |
| `newsletters/_components/email-preview.tsx` | Add device toggle (desktop/mobile), dark frame, email-client header bar. |
| `newsletters/_components/navigation-guard.tsx` | Dark theme restyle for unsaved changes dialog. |
| `newsletters/_components/read-only-overlay.tsx` | Dark theme + lock icon + per-status message. |
| `newsletters/actions.ts` | Add `createEdition` server action for ephemeral → draft transition. |

### New Files

| File | Purpose |
|------|---------|
| `newsletters/_components/more-menu.tsx` | "..." dropdown menu with state-aware items. |
| `newsletters/_components/type-selector.tsx` | Type badge dropdown for top bar (reuses existing type data). |
| `newsletters/_components/stats-strip.tsx` | Inline stats bar for Sent/Failed states. |
| `newsletters/_components/contextual-banner.tsx` | State-aware banner (hint, schedule, sending, error). |
| `newsletters/_components/send-test-modal.tsx` | Send test email dialog with email input + subject preview. |

---

## 19. Testing Requirements

### Unit Tests

- `createEdition` server action: validates required fields, returns editionId
- isDirty detection: subject change, preheader change, body change each trigger persistence
- State machine: verify correct actions available per status
- More menu: correct items per state
- Autosave: disabled in ephemeral mode, enabled after persistence

### Integration Tests (existing patterns)

- Create edition via action, verify DB row
- Ephemeral → Draft transition: edition exists in DB after first edit
- Navigate away from ephemeral: no orphan DB record

### Existing Tests to Update

- `apps/web/test/cms/newsletters.test.tsx` — update for new editor props, ephemeral mode
- `apps/web/test/unit/newsletter/actions-status-matrix.test.ts` — add createEdition action tests

---

## 20. Non-Goals (Explicitly Out of Scope)

- Collaborative editing / multi-user
- Draft auto-deletion cron (orphan cleanup)
- Rich text toolbar customization (drag-to-reorder)
- AI writing assistance
- Template system (edition templates)
- A/B subject line testing
- Undo/redo for non-TipTap fields (subject, preheader)
