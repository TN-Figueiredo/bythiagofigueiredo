// apps/web/test/cms/video/editor-gating.test.tsx
//
// Adapted to the real editor architecture (§5.5). The task spec assumed a flat
// `VideoEditorClient({ detail, actions })` shell; the in-tree implementation is
// providers-only (`VideoEditorClient` → `VideoEditorProvider`+`VideoDataProvider`
// → `EditorShell` → `StageBody`/`VidStages`), and the stage switch + tab list live
// in `editor-shell.tsx` / `vid-stages.tsx`. We exercise the real wiring point by
// rendering `EditorShell` under the real providers (same pattern as
// editor/ed-shell.test.tsx + editor/autosave-wiring.test.tsx). OPEN_AT is seeded
// via `initialFromDetail` exactly as `page.tsx` does.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import { initialFromDetail } from '@/app/cms/(authed)/video/[id]/edit/reducer'

const EMPTY_IDEIA = { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }

function makeData(over: Record<string, unknown> = {}) {
  return {
    ideia: { pt: EMPTY_IDEIA, en: EMPTY_IDEIA },
    roteiro: { pt: null, en: null },
    versions: {
      pt: { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] },
      en: { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] },
    },
    pillar: undefined,
    durationRange: undefined,
    saveIdeia: vi.fn(),
    saveTitle: vi.fn(),
    appendSiblings: vi.fn(),
    saveRoteiro: vi.fn(),
    hasUnsavedChanges: false,
    saveAll: vi.fn().mockResolvedValue(undefined),
    autosaveState: 'saved' as const,
    // P3 fields:
    sections: {},
    abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null },
    winnerVariantId: null,
    savePostprod: vi.fn().mockResolvedValue(undefined),
    savePublish: vi.fn().mockResolvedValue(undefined),
    advanceToRecorded: vi.fn().mockResolvedValue({ ok: true }),
    publishVideo: vi.fn().mockResolvedValue({ ok: true }),
    openHandoff: vi.fn(),
    openCowork: vi.fn(),
    ...over,
  }
}

function shell(stage: string, data = makeData()) {
  const initialState = initialFromDetail({
    itemId: 'p1', code: 'VID-1', siteId: 'site-1', stage, version: 1, primaryLang: 'pt',
  })
  return render(
    <VideoEditorProvider initialState={initialState}>
      <VideoDataProvider value={data as never}>
        <EditorShell />
      </VideoDataProvider>
    </VideoEditorProvider>,
  )
}

describe('Editor lifecycle gating (§5.5)', () => {
  it('clicking the locked Pós tab below gravacao renders LockedStage (clickable, not disabled)', () => {
    shell('idea')
    const posTab = screen.getByRole('tab', { name: /Pós/i })
    expect(posTab).toHaveAttribute('aria-disabled', 'true')
    expect((posTab as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(posTab)
    expect(screen.getByRole('button', { name: /Marcar como gravado/i })).toBeInTheDocument()
  })

  it('opens at the projected stage (OPEN_AT): gravacao → Pós tab active', () => {
    shell('gravacao')
    expect(screen.getByRole('tab', { name: /Pós/i, selected: true })).toBeInTheDocument()
  })

  it('opens at Publicação for a published item', () => {
    shell('published')
    expect(screen.getByRole('tab', { name: /Publicação/i, selected: true })).toBeInTheDocument()
  })

  it('unlocked Pós (recorded) renders the PosStage, not LockedStage', () => {
    shell('gravacao')
    // no "Marcar como gravado" CTA when already recorded
    expect(screen.queryByRole('button', { name: /Marcar como gravado/i })).toBeNull()
  })

  it('published Publicação freezes the A/B grid (read-only, no publish CTA)', () => {
    shell('published')
    // frozen: the "Publicar + iniciar teste" CTA is gone when already published
    expect(screen.queryByRole('button', { name: /Publicar \+ iniciar teste/i })).toBeNull()
    expect(screen.getByText(/no ar — títulos travados/i)).toBeInTheDocument()
  })
})
