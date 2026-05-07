# Editor Save Modes — Status-Aware Auto-Save Redesign

## Problem

Both the blog post editor and newsletter editor auto-save on every keystroke (3s debounce) regardless of post/edition status. This is dangerous for published, scheduled, and ready content — accidental edits go live immediately without user intent.

WordPress pattern: auto-save only for drafts; published posts require explicit "Update" with confirmation.

## Decision

Three save modes determined by content status:

| Mode | Blog statuses | Newsletter statuses | Behavior |
|------|--------------|-------------------|----------|
| **auto** | `idea`, `draft` | `draft`, `idea` | 3s debounce on change, auto-fires save |
| **manual** | `pending_review`, `ready`, `queued`, `scheduled`, `archived` | `ready`, `review`, `queued`, `scheduled` | Tracks dirty state, save only via explicit action |
| **guarded** | `published` | *(n/a — sent is locked)* | Like manual, plus confirmation dialog before save |
| **disabled** | *(n/a)* | `sending`, `sent`, `failed`, `cancelled` | Hook off, editor read-only (existing behavior) |

## Architecture

### `useAutosave` hook — new `mode` option

```typescript
interface AutosaveOptions {
  editionId: string | null
  saveFn: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  debounceMs?: number
  maxRetries?: number
  enabled?: boolean       // false = hook completely off (ephemeral)
  mode?: 'auto' | 'manual' | 'guarded'  // default 'auto'
  getPayload?: () => Record<string, unknown>  // for guarded: confirmSave() calls this to get fresh data
}

interface AutosaveReturn {
  state: SaveState
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  scheduleSave: (data: Record<string, unknown>) => void
  saveNow: (data: Record<string, unknown>) => void       // immediate save; triggers confirmation in guarded mode
  forceSave: (data: Record<string, unknown>) => Promise<{ ok: boolean }>  // bypasses guarded; awaitable
  setHasUnsavedChanges: (v: boolean) => void
  needsConfirmation: boolean
  confirmSave: () => void
  cancelSave: () => void
  mode: 'auto' | 'manual' | 'guarded'
}
```

**Semantic distinctions:**

- `enabled: false` — hook is completely off. No state tracking. Used for ephemeral (unsaved) posts and read-only locked statuses.
- `mode: 'auto'` — `scheduleSave()` starts debounce timer. Current behavior.
- `mode: 'manual'` — `scheduleSave()` marks dirty and stores pending data but does NOT start debounce timer. Only `saveNow()` fires the save.
- `mode: 'guarded'` — same as manual, but `saveNow()` sets `needsConfirmation: true` instead of firing. Consumer must call `confirmSave()` to actually save.

**`forceSave(data)`** — fires immediately, bypasses guarded confirmation. Returns `Promise<{ ok: boolean }>` so callers can `await` before proceeding (e.g., status transitions must wait for save to complete). Used for status transitions where the user is already performing a deliberate action.

**`confirmSave()`** — fires the actual save using the `getPayload` callback registered via hook options. The editor passes `getSavePayload` (which reads from `fieldsRef.current`, always fresh). The hook stores `getPayload` in a ref internally to avoid re-render dependency loops. This ensures confirmation always saves the latest field state — not stale data from when `saveNow()` was called.

### Mode transition effects

React to `mode` prop changes between renders via `useEffect` watching `mode`:

- **auto → manual/guarded:** cancel any pending debounce timer immediately.
- **manual/guarded → auto:** if `hasUnsavedChanges`, schedule a save immediately.
- **guarded → any other mode:** clear `needsConfirmation` and close the confirmation dialog. If switching to `auto`, the pending changes will auto-save. If switching to `manual`, user can save manually.

### Online recovery and localStorage recovery

- **auto mode:** auto-fires save when coming back online or finding stored data on mount (current behavior).
- **manual/guarded mode:** restores dirty state only. Does NOT auto-fire save. User must explicitly save.

### localStorage key prefix

The current prefix `newsletter-draft-` is misleading since the hook is shared with the blog editor. Rename to `editor-draft-` to be context-neutral. This is a non-breaking change — old keys expire naturally (no migration needed).

## UI Components

### SaveBar (new — `_shared/editor/save-bar.tsx`)

Rendered as the last child of the editor's flex column (`shrink-0`), below the scrollable content area. Not fixed/absolute — it pushes content up when visible, avoiding overlap with scrollable editor content. z-index below modals (z-30) but above content.

Visible when `mode !== 'auto'` AND (`hasUnsavedChanges` OR `state === 'saving'`).

States:
- **Dirty:** `● Unsaved changes` + Save button + `⌘S` hint. For `published` status, button label is "Update live post".
- **Saving:** `◌ Saving...` + Save button disabled with spinner.
- **Just saved:** brief "Saved" flash with green dot, bar collapses after 1s via `transition-all`.
- **Error:** `● Save failed` + Retry button (same as SaveBar but red-tinted).

Accessibility: `role="status"`, `aria-live="polite"`.

Props: `state: SaveState`, `mode`, `onSave: () => void`, `onRetry: () => void`, `status: string` (for label variant).

### PublishSaveDialog (new — `_shared/editor/publish-save-dialog.tsx`)

Modal shown when `needsConfirmation` is true.

- Title: "Update published post?"
- Body: "This post is live. Saving will update the published version immediately."
- Actions: Cancel (resets `needsConfirmation`, keeps dirty) / Update (calls `confirmSave()`)
- Focus trap via existing `useModalFocusTrap` hook.
- Dialog closes immediately on Update click — save result (success/error) is shown in the AutosaveIndicator and SaveBar, not in the dialog. This avoids the dialog blocking while the save is in-flight.

### AutosaveIndicator updates

Accept `mode` prop for mode-aware labels:

| Mode | Clean | Dirty |
|------|-------|-------|
| auto | "Saved 14:32" | "Saving..." |
| manual | "Manual save" | "Unsaved changes" |
| guarded | "Manual save" | "Unsaved changes" |

Saving/saved/error/offline states unchanged across modes.

## Editor Integration

### Blog post editor (`post-edition-editor.tsx`)

```typescript
const AUTO_SAVE_STATUSES = new Set(['idea', 'draft'])
const saveMode = AUTO_SAVE_STATUSES.has(currentStatus)
  ? 'auto'
  : currentStatus === 'published' ? 'guarded' : 'manual'
```

**Field handler pattern:** Field handlers that currently call `saveImmediate()` (tags, image uploads) must check mode:

```typescript
function handleTagChange(tagId: string) {
  // ...update tag state...
  if (saveMode === 'auto') {
    saveImmediate(getSavePayload())
  } else {
    scheduleAutosave()  // marks dirty only
  }
}
```

**Ctrl+S:** calls `saveImmediate()` in all modes. In guarded mode, this triggers `needsConfirmation` → dialog. No bypass.

**Status transitions:** `handleStatusChange()` uses `forceSave()` (bypasses confirmation — user is already performing a deliberate action):

```typescript
async function handleStatusChange(newStatus: string) {
  if (hasUnsavedChanges) {
    await forceSave(getSavePayload())
  }
  await movePost(postId, newStatus)
}
```

**NavigationGuard:** "Save & Leave" calls `forceSave()` — saving is safer than discarding, no need for extra confirmation.

**Concurrent save protection:** Save button in SaveBar disabled when `state === 'saving'`.

### Newsletter editor (`edition-editor.tsx`)

Replace the `LOCKED_STATUSES` + `enabled` pattern with `mode`:

```typescript
const LOCKED = new Set(['sending', 'sent', 'failed', 'cancelled'])
const AUTO = new Set(['draft', 'idea'])
const isReadOnly = LOCKED.has(status)
const saveMode = AUTO.has(status) ? 'auto' : 'manual'

useAutosave({
  editionId,
  saveFn,
  enabled: !isReadOnly && !isEphemeral,
  mode: saveMode,
})
```

Add `<SaveBar>` for manual-mode statuses. No guarded mode (newsletters don't have `published` state).

## What does NOT change

- **`savePost` server action** — `updated_at` is handled by DB trigger `tg_set_updated_at()` on `blog_posts` and `blog_translations`.
- **ISR revalidation** — already fires on every `savePost` call via `revalidateBlogPostSeo()`.
- **NavigationGuard** — works with `hasUnsavedChanges`. "Save & Leave" uses `forceSave()`.
- **`beforeunload`** — NavigationGuard already fires `beforeunload` when `hasUnsavedChanges`. Manual/guarded modes set `hasUnsavedChanges` the same way. No changes needed.
- **Offline support** — localStorage backup still works; behavior adapts to mode.
- **Retry mechanism** — exponential backoff unchanged, works in all modes.
- **Read-only overlay** — newsletter's `isReadOnly` pattern unchanged; `isReadOnly` controls field editability, `enabled` controls hook activation. Separate concerns.

## Files

| File | Change |
|------|--------|
| `_shared/editor/use-autosave.ts` | Add `mode`, `forceSave`, `needsConfirmation`, `confirmSave`, `cancelSave`. Mode transition effects. Online/localStorage gated by mode. |
| `_shared/editor/autosave-indicator.tsx` | Accept `mode` prop, show mode-aware labels. |
| `_shared/editor/save-bar.tsx` | **New.** Sticky save bar with state lifecycle, accessible. |
| `_shared/editor/publish-save-dialog.tsx` | **New.** Confirmation dialog with focus trap. |
| `blog/new/post-edition-editor.tsx` | Compute `saveMode` from status, wire SaveBar + PublishSaveDialog, update tag/image handlers for mode, `forceSave` for status transitions. |
| `newsletters/[id]/edit/edition-editor.tsx` | Replace `LOCKED_STATUSES`/`enabled` with `mode`, add SaveBar for manual statuses. |

## Tests

- `use-autosave.ts`: mode switching, `scheduleSave` no-fire in manual, guarded flow (`saveNow` → `needsConfirmation` → `confirmSave`), `forceSave` bypass, online recovery per mode, localStorage recovery per mode, mode transition (auto→manual cancels debounce, manual→auto schedules save).
- `save-bar.tsx`: renders when dirty + manual mode, hidden in auto mode, disabled while saving, collapse on save, accessibility attributes.
- `publish-save-dialog.tsx`: renders on `needsConfirmation`, cancel resets, confirm fires save, focus trap.
- Newsletter editor integration: verify `scheduled`/`ready`/`queued` use manual mode, `draft`/`idea` use auto mode, locked statuses disable hook.

## Out of scope

- Revision history for published edits (WordPress-level feature, YAGNI).
- YouTube content editor — uses a simple form, not the rich editor. Already manual-only by design.
