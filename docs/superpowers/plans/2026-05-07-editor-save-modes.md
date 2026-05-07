# Editor Save Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add status-aware save modes (auto/manual/guarded) to the CMS blog and newsletter editors so only idea/draft auto-save, while published posts require confirmation.

**Architecture:** Extend the existing `useAutosave` hook with a `mode` parameter. In `auto` mode (idea/draft), behavior is unchanged. In `manual` mode, `scheduleSave()` tracks dirty state without firing. In `guarded` mode (published), `saveNow()` triggers a confirmation dialog. Two new components: `SaveBar` (sticky bottom bar for manual-mode editors) and `PublishSaveDialog` (confirmation modal).

**Tech Stack:** React 19, TypeScript 5, Vitest, @testing-library/react

---

## File Structure

| File | Responsibility |
|------|---------------|
| `apps/web/src/app/cms/(authed)/_shared/editor/use-autosave.ts` | **Modify.** Add `mode`, `forceSave`, `needsConfirmation`, `confirmSave`, `cancelSave`. Mode transition effects. |
| `apps/web/src/app/cms/(authed)/_shared/editor/autosave-indicator.tsx` | **Modify.** Accept `mode` prop, show mode-aware labels. |
| `apps/web/src/app/cms/(authed)/_shared/editor/save-bar.tsx` | **Create.** Sticky save bar with state lifecycle. |
| `apps/web/src/app/cms/(authed)/_shared/editor/publish-save-dialog.tsx` | **Create.** Confirmation dialog for published posts. |
| `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx` | **Modify.** Wire save mode, SaveBar, dialog, update field handlers. |
| `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx` | **Modify.** Replace LOCKED_STATUSES pattern with mode. |
| `apps/web/test/unit/newsletter/autosave.test.ts` | **Modify.** Add tests for mode switching, guarded flow, forceSave. |
| `apps/web/test/unit/editor/save-bar.test.tsx` | **Create.** Tests for SaveBar component. |
| `apps/web/test/unit/editor/publish-save-dialog.test.tsx` | **Create.** Tests for PublishSaveDialog component. |

---

### Task 1: Extend useAutosave hook with mode support

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/use-autosave.ts`
- Test: `apps/web/test/unit/newsletter/autosave.test.ts`

- [ ] **Step 1: Write failing tests for manual mode**

Add these tests to the existing `describe('useAutosave hook')` block in `apps/web/test/unit/newsletter/autosave.test.ts`:

```typescript
// Update the LS_KEY at the top of the file:
// const LS_KEY = 'editor-draft-ed-1'

// Update the setup function to accept mode and getPayload:
// function setup(
//   saveFn = vi.fn().mockResolvedValue({ ok: true }),
//   opts: Partial<{ debounceMs: number; maxRetries: number; enabled: boolean; mode: 'auto' | 'manual' | 'guarded'; getPayload: () => Record<string, unknown> }> = {},
// ) {
//   const result = renderHook(() =>
//     useAutosave({
//       editionId: 'ed-1',
//       saveFn,
//       debounceMs: opts.debounceMs ?? 3000,
//       maxRetries: opts.maxRetries ?? 3,
//       enabled: opts.enabled ?? true,
//       mode: opts.mode,
//       getPayload: opts.getPayload,
//     }),
//   )
//   return { ...result, saveFn }
// }

  // ── Manual mode: scheduleSave does not fire ───────────────────────────────
  it('manual mode: scheduleSave marks dirty but does not fire', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'manual' })

    act(() => {
      result.current.scheduleSave({ subject: 'Manual' })
    })
    expect(result.current.state).toBe('unsaved')
    expect(result.current.hasUnsavedChanges).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(saveFn).not.toHaveBeenCalled()
  })

  // ── Manual mode: saveNow fires immediately ────────────────────────────────
  it('manual mode: saveNow fires immediately', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'manual' })

    act(() => {
      result.current.scheduleSave({ subject: 'Dirty' })
    })

    await act(async () => {
      result.current.saveNow({ subject: 'Now' })
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Now' })
    expect(result.current.state).toBe('saved')
  })

  // ── Guarded mode: saveNow sets needsConfirmation ──────────────────────────
  it('guarded mode: saveNow sets needsConfirmation instead of firing', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'guarded' })

    act(() => {
      result.current.saveNow({ subject: 'Guarded' })
    })
    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.needsConfirmation).toBe(true)
  })

  // ── Guarded mode: confirmSave fires with fresh payload ────────────────────
  it('guarded mode: confirmSave fires using getPayload', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const getPayload = vi.fn().mockReturnValue({ subject: 'Fresh' })
    const { result } = setup(saveFn, { mode: 'guarded', getPayload })

    act(() => {
      result.current.saveNow({ subject: 'Stale' })
    })
    expect(result.current.needsConfirmation).toBe(true)

    await act(async () => {
      result.current.confirmSave()
    })
    expect(getPayload).toHaveBeenCalled()
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Fresh' })
    expect(result.current.needsConfirmation).toBe(false)
    expect(result.current.state).toBe('saved')
  })

  // ── Guarded mode: cancelSave resets confirmation ──────────────────────────
  it('guarded mode: cancelSave clears needsConfirmation', () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'guarded' })

    act(() => {
      result.current.saveNow({ subject: 'X' })
    })
    expect(result.current.needsConfirmation).toBe(true)

    act(() => {
      result.current.cancelSave()
    })
    expect(result.current.needsConfirmation).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  // ── forceSave bypasses guarded mode ───────────────────────────────────────
  it('forceSave bypasses guarded mode and fires immediately', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'guarded' })

    const promise = act(async () => {
      await result.current.forceSave({ subject: 'Force' })
    })
    await promise
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Force' })
    expect(result.current.needsConfirmation).toBe(false)
  })

  // ── Manual mode: online recovery only marks dirty ─────────────────────────
  it('manual mode: localStorage recovery marks dirty but does not auto-save', () => {
    localStorage.setItem('editor-draft-ed-1', JSON.stringify({ subject: 'Recovered' }))
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'manual' })

    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.state).toBe('unsaved')
    expect(saveFn).not.toHaveBeenCalled()
  })

  // ── mode exposes current mode ─────────────────────────────────────────────
  it('exposes current mode in return value', () => {
    const { result } = setup(vi.fn().mockResolvedValue({ ok: true }), { mode: 'manual' })
    expect(result.current.mode).toBe('manual')
  })

  it('defaults mode to auto', () => {
    const { result } = setup()
    expect(result.current.mode).toBe('auto')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/newsletter/autosave.test.ts`
Expected: FAIL — `mode`, `needsConfirmation`, `confirmSave`, `cancelSave`, `forceSave` do not exist on return type

- [ ] **Step 3: Implement the mode-aware useAutosave hook**

Replace the entire contents of `apps/web/src/app/cms/(authed)/_shared/editor/use-autosave.ts` with:

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'saving' | 'saved' | 'unsaved' | 'error' | 'offline'
export type SaveMode = 'auto' | 'manual' | 'guarded'

interface AutosaveOptions {
  editionId: string | null
  saveFn: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  debounceMs?: number
  maxRetries?: number
  enabled?: boolean
  mode?: SaveMode
  getPayload?: () => Record<string, unknown>
}

interface AutosaveReturn {
  state: SaveState
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  scheduleSave: (data: Record<string, unknown>) => void
  saveNow: (data: Record<string, unknown>) => void
  forceSave: (data: Record<string, unknown>) => Promise<{ ok: boolean }>
  setHasUnsavedChanges: (v: boolean) => void
  needsConfirmation: boolean
  confirmSave: () => void
  cancelSave: () => void
  mode: SaveMode
}

const RETRY_DELAYS = [2000, 4000, 8000]
const LS_PREFIX = 'editor-draft-'

export function useAutosave({
  editionId,
  saveFn,
  debounceMs = 3000,
  maxRetries = 3,
  enabled = true,
  mode = 'auto',
  getPayload,
}: AutosaveOptions): AutosaveReturn {
  const [state, setState] = useState<SaveState>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const pendingDataRef = useRef<Record<string, unknown> | null>(null)
  const getPayloadRef = useRef(getPayload)
  getPayloadRef.current = getPayload

  const doSave = useCallback(async (data: Record<string, unknown>): Promise<{ ok: boolean }> => {
    if (!editionId) return { ok: false }
    if (!enabled) return { ok: false }
    if (typeof window !== 'undefined' && !navigator.onLine) {
      localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      setState('offline')
      return { ok: false }
    }

    setState('saving')
    const result = await saveFn(data)

    if (result.ok) {
      setState('saved')
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      retryCountRef.current = 0
      if (typeof window !== 'undefined') localStorage.removeItem(`${LS_PREFIX}${editionId}`)
      return { ok: true }
    } else {
      if (retryCountRef.current < maxRetries) {
        const delay = RETRY_DELAYS[retryCountRef.current] ?? 8000
        retryCountRef.current++
        setTimeout(() => doSave(data), delay)
        setState('error')
      } else {
        setState('error')
        if (typeof window !== 'undefined') localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      }
      return { ok: false }
    }
  }, [editionId, saveFn, enabled, maxRetries])

  const scheduleSave = useCallback((data: Record<string, unknown>) => {
    if (!enabled) return
    if (!editionId) return
    pendingDataRef.current = data
    setHasUnsavedChanges(true)
    setState('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (mode === 'auto') {
      debounceRef.current = setTimeout(() => doSave(data), debounceMs)
    }
  }, [doSave, debounceMs, enabled, editionId, mode])

  const saveNow = useCallback((data: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    retryCountRef.current = 0
    if (mode === 'guarded') {
      pendingDataRef.current = data
      setHasUnsavedChanges(true)
      setNeedsConfirmation(true)
      return
    }
    doSave(data)
  }, [doSave, mode])

  const forceSave = useCallback(async (data: Record<string, unknown>): Promise<{ ok: boolean }> => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    retryCountRef.current = 0
    setNeedsConfirmation(false)
    return doSave(data)
  }, [doSave])

  const confirmSave = useCallback(() => {
    setNeedsConfirmation(false)
    const data = getPayloadRef.current ? getPayloadRef.current() : pendingDataRef.current
    if (data) {
      retryCountRef.current = 0
      doSave(data)
    }
  }, [doSave])

  const cancelSave = useCallback(() => {
    setNeedsConfirmation(false)
  }, [])

  // Mode transition effects
  const prevModeRef = useRef(mode)
  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = mode
    if (prev === mode) return

    if (prev === 'auto' && mode !== 'auto') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    if (prev === 'guarded') {
      setNeedsConfirmation(false)
    }
    if (prev !== 'auto' && mode === 'auto' && hasUnsavedChanges && pendingDataRef.current) {
      debounceRef.current = setTimeout(() => doSave(pendingDataRef.current!), debounceMs)
    }
  }, [mode, hasUnsavedChanges, doSave, debounceMs])

  // localStorage recovery
  useEffect(() => {
    if (!editionId) return
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(`${LS_PREFIX}${editionId}`)
    if (stored && enabled) {
      const data = JSON.parse(stored) as Record<string, unknown>
      pendingDataRef.current = data
      setHasUnsavedChanges(true)
      setState('unsaved')
    }
  }, [editionId, enabled])

  // Online recovery
  useEffect(() => {
    function handleOnline() {
      if (mode === 'auto' && pendingDataRef.current) {
        doSave(pendingDataRef.current)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [doSave, mode])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    state, lastSavedAt, hasUnsavedChanges,
    scheduleSave, saveNow, forceSave,
    setHasUnsavedChanges,
    needsConfirmation, confirmSave, cancelSave,
    mode,
  }
}
```

- [ ] **Step 4: Update the test file setup and LS_KEY**

Replace the `LS_KEY`, `setup` function, and update the existing `'Restores from localStorage on mount'` test in `apps/web/test/unit/newsletter/autosave.test.ts`:

```typescript
// At the top, change:
const LS_KEY = 'editor-draft-ed-1'

// Replace setup function with:
function setup(
  saveFn = vi.fn().mockResolvedValue({ ok: true }),
  opts: Partial<{ debounceMs: number; maxRetries: number; enabled: boolean; mode: 'auto' | 'manual' | 'guarded'; getPayload: () => Record<string, unknown> }> = {},
) {
  const result = renderHook(() =>
    useAutosave({
      editionId: 'ed-1',
      saveFn,
      debounceMs: opts.debounceMs ?? 3000,
      maxRetries: opts.maxRetries ?? 3,
      enabled: opts.enabled ?? true,
      mode: opts.mode,
      getPayload: opts.getPayload,
    }),
  )
  return { ...result, saveFn }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/newsletter/autosave.test.ts`
Expected: ALL PASS (existing + new tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/editor/use-autosave.ts apps/web/test/unit/newsletter/autosave.test.ts
git commit -m "feat(editor): add save mode support to useAutosave hook (auto/manual/guarded)"
```

---

### Task 2: Update AutosaveIndicator with mode-aware labels

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/autosave-indicator.tsx`

- [ ] **Step 1: Update the component**

Replace the entire contents of `apps/web/src/app/cms/(authed)/_shared/editor/autosave-indicator.tsx` with:

```typescript
'use client'

import type { SaveState, SaveMode } from './use-autosave'

interface AutosaveIndicatorProps {
  state: SaveState
  lastSavedAt: Date | null
  mode?: SaveMode
  onRetry?: () => void
}

const STATE_CONFIG: Record<SaveState, { dotClass: string; textColor: string; label: string }> = {
  saving: { dotClass: 'bg-[#eab308] animate-pulse', textColor: 'text-[#eab308]', label: 'Saving...' },
  saved: { dotClass: 'bg-[#22c55e]', textColor: 'text-[#4b5563]', label: 'Saved' },
  unsaved: { dotClass: 'bg-[#6b7280]', textColor: 'text-[#6b7280]', label: 'Unsaved' },
  error: { dotClass: 'bg-[#ef4444]', textColor: 'text-[#ef4444]', label: 'Save failed' },
  offline: { dotClass: 'bg-[#f97316]', textColor: 'text-[#f97316]', label: 'Offline — saved locally' },
}

function getLabel(state: SaveState, mode: SaveMode, lastSavedAt: Date | null): string {
  if (state === 'saving' || state === 'error' || state === 'offline') return STATE_CONFIG[state].label
  if (state === 'saved') {
    const time = lastSavedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return time ? `Saved ${time}` : 'Saved'
  }
  if (mode !== 'auto') return 'Unsaved changes'
  return 'Unsaved'
}

export function AutosaveIndicator({ state, lastSavedAt, mode = 'auto', onRetry }: AutosaveIndicatorProps) {
  const config = STATE_CONFIG[state]
  const displayLabel = (mode !== 'auto' && state === 'saved' && !lastSavedAt)
    ? 'Manual save'
    : getLabel(state, mode, lastSavedAt)

  return (
    <div className={`flex items-center gap-1.5 text-[10px] ${config.textColor}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${config.dotClass}`} />
      {state === 'error' && onRetry ? (
        <button type="button" onClick={onRetry} className="underline decoration-dotted hover:decoration-solid">
          Save failed — retry
        </button>
      ) : (
        <span>{displayLabel}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/editor/autosave-indicator.tsx
git commit -m "feat(editor): mode-aware labels in AutosaveIndicator"
```

---

### Task 3: Create SaveBar component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/editor/save-bar.tsx`
- Create: `apps/web/test/unit/editor/save-bar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/unit/editor/save-bar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SaveBar } from '@/app/cms/(authed)/_shared/editor/save-bar'

describe('SaveBar', () => {
  const defaults = {
    state: 'unsaved' as const,
    hasUnsavedChanges: true,
    mode: 'manual' as const,
    status: 'ready',
    onSave: vi.fn(),
    onRetry: vi.fn(),
  }

  it('renders when manual mode and has unsaved changes', () => {
    render(<SaveBar {...defaults} />)
    expect(screen.getByText('Unsaved changes')).toBeDefined()
    expect(screen.getByRole('button', { name: /save/i })).toBeDefined()
  })

  it('does not render in auto mode', () => {
    const { container } = render(<SaveBar {...defaults} mode="auto" />)
    expect(container.innerHTML).toBe('')
  })

  it('does not render when no unsaved changes and not saving', () => {
    const { container } = render(<SaveBar {...defaults} hasUnsavedChanges={false} state="saved" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows "Update live post" for published status', () => {
    render(<SaveBar {...defaults} status="published" mode="guarded" />)
    expect(screen.getByRole('button', { name: /update live post/i })).toBeDefined()
  })

  it('disables save button while saving', () => {
    render(<SaveBar {...defaults} state="saving" />)
    const btn = screen.getByRole('button', { name: /saving/i })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('calls onSave when save button clicked', () => {
    const onSave = vi.fn()
    render(<SaveBar {...defaults} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows error state with retry', () => {
    const onRetry = vi.fn()
    render(<SaveBar {...defaults} state="error" onRetry={onRetry} />)
    expect(screen.getByText(/save failed/i)).toBeDefined()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('has accessible role', () => {
    render(<SaveBar {...defaults} />)
    expect(screen.getByRole('status')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/editor/save-bar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SaveBar component**

Create `apps/web/src/app/cms/(authed)/_shared/editor/save-bar.tsx`:

```typescript
'use client'

import type { SaveState, SaveMode } from './use-autosave'

interface SaveBarProps {
  state: SaveState
  hasUnsavedChanges: boolean
  mode: SaveMode
  status: string
  onSave: () => void
  onRetry: () => void
}

export function SaveBar({ state, hasUnsavedChanges, mode, status, onSave, onRetry }: SaveBarProps) {
  if (mode === 'auto') return null
  if (!hasUnsavedChanges && state !== 'saving' && state !== 'error') return null

  const isPublished = status === 'published'
  const isSaving = state === 'saving'
  const isError = state === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 z-30 border-t px-5 py-2.5 flex items-center justify-between transition-all"
      style={{
        borderColor: isError ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)',
        background: isError ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
      }}
    >
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`h-[6px] w-[6px] rounded-full ${
            isError ? 'bg-[#ef4444]' : isSaving ? 'bg-[#eab308] animate-pulse' : 'bg-[#f59e0b] animate-pulse'
          }`}
        />
        <span className={isError ? 'text-[#ef4444]' : 'text-[#d97706]'}>
          {isError ? 'Save failed' : isSaving ? 'Saving...' : 'Unsaved changes'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-[#6b7280] hidden sm:inline">⌘S</span>
        {isError ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry save"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-[#ef4444] border border-[#ef4444]/30 hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            aria-label={isPublished ? 'Update live post' : 'Save'}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : isPublished ? 'Update live post' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/editor/save-bar.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/editor/save-bar.tsx apps/web/test/unit/editor/save-bar.test.tsx
git commit -m "feat(editor): add SaveBar component for manual/guarded save modes"
```

---

### Task 4: Create PublishSaveDialog component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/editor/publish-save-dialog.tsx`
- Create: `apps/web/test/unit/editor/publish-save-dialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/unit/editor/publish-save-dialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublishSaveDialog } from '@/app/cms/(authed)/_shared/editor/publish-save-dialog'

describe('PublishSaveDialog', () => {
  it('renders when open', () => {
    render(<PublishSaveDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Update published post?')).toBeDefined()
    expect(screen.getByText(/this post is live/i)).toBeDefined()
  })

  it('does not render when not open', () => {
    const { container } = render(<PublishSaveDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('calls onConfirm when Update clicked', () => {
    const onConfirm = vi.fn()
    render(<PublishSaveDialog open onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /update/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn()
    render(<PublishSaveDialog open onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('has accessible dialog role', () => {
    render(<PublishSaveDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/editor/publish-save-dialog.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PublishSaveDialog component**

Create `apps/web/src/app/cms/(authed)/_shared/editor/publish-save-dialog.tsx`:

```typescript
'use client'

import { useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useModalFocusTrap } from './use-modal-focus-trap'

interface PublishSaveDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PublishSaveDialog({ open, onConfirm, onCancel }: PublishSaveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(dialogRef, open, onCancel)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div ref={dialogRef} role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={16} className="text-[#f59e0b]" />
          </div>
          <h3 className="text-base font-semibold text-[#f3f4f6]">Update published post?</h3>
        </div>
        <p className="text-sm text-[#9ca3af] mb-6">
          This post is live. Saving will update the published version immediately.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/editor/publish-save-dialog.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/editor/publish-save-dialog.tsx apps/web/test/unit/editor/publish-save-dialog.test.tsx
git commit -m "feat(editor): add PublishSaveDialog confirmation for published posts"
```

---

### Task 5: Wire save modes into blog post editor

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx`

- [ ] **Step 1: Add imports**

At the top of `post-edition-editor.tsx`, add these imports after the existing `AutosaveIndicator` import (line 26):

```typescript
import { SaveBar } from '../../_shared/editor/save-bar'
import { PublishSaveDialog } from '../../_shared/editor/publish-save-dialog'
```

- [ ] **Step 2: Add save mode constant and compute mode**

Add this constant after `MOVE_ACTION_LABELS` (after line 119):

```typescript
const AUTO_SAVE_STATUSES = new Set(['idea', 'draft'])
```

- [ ] **Step 3: Update useAutosave call**

Replace the `useAutosave` call block (lines 603-614) with:

```typescript
  const saveMode = AUTO_SAVE_STATUSES.has(currentStatus)
    ? 'auto' as const
    : currentStatus === 'published' ? 'guarded' as const : 'manual' as const

  const {
    state: saveState,
    lastSavedAt,
    hasUnsavedChanges,
    scheduleSave,
    saveNow: saveImmediate,
    forceSave,
    setHasUnsavedChanges,
    needsConfirmation,
    confirmSave,
    cancelSave,
  } = useAutosave({
    editionId: postId,
    saveFn,
    enabled: !isEphemeral,
    mode: saveMode,
    getPayload: getSavePayload,
  })
```

Note: `getSavePayload` is defined right after this block (line 617). Move `saveMode` computation to before the hook call but after `currentStatus` is defined.

- [ ] **Step 4: Update tag change handler to respect mode**

Replace `handleTagChange` (lines 703-709) with:

```typescript
  function handleTagChange(tagId: string | null) {
    setSelectedTagId(tagId)
    fieldsRef.current.selectedTagId = tagId
    if (!isEphemeral && postId) {
      if (saveMode === 'auto') {
        saveImmediate({ ...getSavePayload(), tag_id: tagId || undefined })
      } else {
        scheduleAutosave()
      }
    }
  }
```

- [ ] **Step 5: Update inline image handler to respect mode**

Replace the `onImageInserted` callback (line 1207-1209) with:

```typescript
            onImageInserted={() => {
              if (!isEphemeral) {
                if (saveMode === 'auto') {
                  saveImmediate(getSavePayload())
                } else {
                  scheduleAutosave()
                }
              }
            }}
```

Also replace `handleInlineImageFromGallery` (lines 809-816) — replace `saveImmediate(getSavePayload())` with mode check:

```typescript
  function handleInlineImageFromGallery(asset: { url: string; alt: string }) {
    const editor = editorInstanceRef.current
    if (editor) {
      editor.chain().focus().setImage({ src: asset.url, alt: asset.alt }).run()
      if (!isEphemeral) {
        if (saveMode === 'auto') {
          saveImmediate(getSavePayload())
        } else {
          scheduleAutosave()
        }
      }
    }
    inlineGallery.closeGallery()
  }
```

- [ ] **Step 6: Update status transitions to use forceSave**

Replace `handleStatusChange` (lines 898-921) with:

```typescript
  async function handleStatusChange(newStatus: string) {
    if (!postId) return
    setShowStatusDropdown(false)

    if (newStatus === 'scheduled') {
      setShowScheduleModal(true)
      return
    }

    if (hasUnsavedChanges) {
      await forceSave(getSavePayload())
    }

    const result = await movePost(postId, newStatus)
    if (result.ok) {
      setCurrentStatus(newStatus)
      toast.success(newStatus === 'published' ? 'Published!' : `Moved to ${newStatus}`)
      if (newStatus === 'published') {
        router.push('/cms/blog')
      }
    } else {
      toast.error(result.error === 'invalid_transition' ? 'Invalid transition' : `Failed: ${result.error}`)
    }
  }
```

Replace `handleScheduleConfirm` (lines 923-938) with:

```typescript
  async function handleScheduleConfirm(scheduledFor: string) {
    if (!postId) return
    setShowScheduleModal(false)

    if (hasUnsavedChanges) {
      await forceSave(getSavePayload())
    }

    const result = await movePost(postId, 'scheduled', scheduledFor)
    if (result.ok) {
      setCurrentStatus('scheduled')
      toast.success('Scheduled!')
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }
```

- [ ] **Step 7: Update NavigationGuard to use forceSave**

Replace `handleGuardSave` (lines 957-961) with:

```typescript
  const handleGuardSave = useCallback(async () => {
    if (postId) {
      await forceSave(getSavePayload())
    }
  }, [postId, forceSave])
```

- [ ] **Step 8: Update AutosaveIndicator to pass mode**

Replace the `AutosaveIndicator` render (line 1097) with:

```typescript
            <AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} mode={saveMode} />
```

- [ ] **Step 9: Add SaveBar and PublishSaveDialog to render**

Add these components right before the closing `</div>` of the main render (before the `{/* ── Modals ──` comment at line 1307):

```typescript
      {/* ── Save bar (manual/guarded modes) ────────────────────────────────── */}
      <SaveBar
        state={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        mode={saveMode}
        status={currentStatus}
        onSave={() => saveImmediate(getSavePayload())}
        onRetry={() => saveImmediate(getSavePayload())}
      />

      {/* ── Published save confirmation ─────────────────────────────────── */}
      <PublishSaveDialog
        open={needsConfirmation}
        onConfirm={confirmSave}
        onCancel={cancelSave}
      />
```

- [ ] **Step 10: Run TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/new/post-edition-editor.tsx
git commit -m "feat(blog-editor): wire save modes, SaveBar, and PublishSaveDialog"
```

---

### Task 6: Wire save modes into newsletter editor

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx`

- [ ] **Step 1: Add imports**

After the existing `AutosaveIndicator` import in the newsletter editor, add:

```typescript
import { SaveBar } from '../../../_shared/editor/save-bar'
```

- [ ] **Step 2: Replace LOCKED_STATUSES pattern with mode**

Replace the constant (line 78):

```typescript
const LOCKED_STATUSES = ['sending', 'sent', 'failed', 'cancelled']
```

with:

```typescript
const LOCKED_STATUSES = new Set(['sending', 'sent', 'failed', 'cancelled'])
const AUTO_SAVE_STATUSES = new Set(['draft', 'idea'])
```

Replace the `isReadOnly` line (line 114):

```typescript
  const isReadOnly = LOCKED_STATUSES.includes(status)
```

with:

```typescript
  const isReadOnly = LOCKED_STATUSES.has(status)
  const saveMode = AUTO_SAVE_STATUSES.has(status) ? 'auto' as const : 'manual' as const
```

- [ ] **Step 3: Update useAutosave call**

Replace the `useAutosave` call (line 150-154):

```typescript
  const { state: saveState, lastSavedAt, hasUnsavedChanges, scheduleSave, saveNow: saveImmediate, setHasUnsavedChanges } = useAutosave({
    editionId,
    saveFn,
    enabled: !isReadOnly && !isEphemeral,
  })
```

with:

```typescript
  const { state: saveState, lastSavedAt, hasUnsavedChanges, scheduleSave, saveNow: saveImmediate, forceSave, setHasUnsavedChanges, mode: currentSaveMode } = useAutosave({
    editionId,
    saveFn,
    enabled: !isReadOnly && !isEphemeral,
    mode: saveMode,
    getPayload: () => getSavePayload(),
  })
```

- [ ] **Step 4: Update AutosaveIndicator in the newsletter editor render**

Find the `<AutosaveIndicator` render in the newsletter editor and add the `mode` prop:

```typescript
<AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} mode={currentSaveMode} />
```

- [ ] **Step 5: Add SaveBar to the newsletter editor render**

Find the end of the main editor content area (before the modals section) and add:

```typescript
      <SaveBar
        state={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        mode={currentSaveMode}
        status={status}
        onSave={() => saveImmediate(getSavePayload())}
        onRetry={() => saveImmediate(getSavePayload())}
      />
```

- [ ] **Step 6: Run TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/\[id\]/edit/edition-editor.tsx
git commit -m "feat(newsletter-editor): wire save modes and SaveBar"
```

---

### Task 7: Run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm test`
Expected: ALL PASS

- [ ] **Step 2: Run TypeScript check for the full project**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify in browser**

1. Start dev server: `npm run dev -w apps/web`
2. Open a blog post in `draft` status → verify auto-save works (indicator shows "Saving...", "Saved")
3. Change status to `ready` → verify auto-save stops, SaveBar appears when editing
4. Change status to `published` → verify SaveBar shows "Update live post", Ctrl+S shows confirmation dialog
5. Open a newsletter in `draft` status → verify auto-save works
6. Open a newsletter in `scheduled` status → verify SaveBar appears, no auto-save
