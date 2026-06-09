import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { PosStage } from '@/app/cms/(authed)/video/[id]/edit/stages/pos-stage'
import type { RoteiroBeatV3 } from '@/lib/pipeline/video-schemas'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'pos', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'pos', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const beats: RoteiroBeatV3[] = [
  { idx: 0, name: 'Abertura', status: 'PENDING', script: [
    { type: 'line', text: 'Gancho forte', key: true },
    { type: 'vis', text: 'B-roll: drone' },
  ] },
]
// A "started" brief (has style rows) → renders the full Pós doc (not the generate chooser).
const brief = { kind: 'brief' as const, ctas: { note: '', rows: [], display: '' }, style: [{ k: 'Ritmo', v: 'rápido' }], deliverables: {} }
const editSeed = { ...seed, editMode: 'edit' } as VideoEditorState

function wrap(node: React.ReactNode) {
  return render(<VideoEditorProvider initialState={seed}>{node}</VideoEditorProvider>)
}

describe('PosStage', () => {
  it('derives Momentos-chave (#1) and B-roll por beat (#1) from the roteiro (not stored)', () => {
    wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Gancho forte/)).toBeInTheDocument()
    expect(screen.getAllByText('B-roll: drone').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#1', { exact: false }).length).toBeGreaterThan(0)
  })

  it('shows the no-beats empty state when roteiro has no beats', () => {
    wrap(<PosStage beats={[]} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Destrinche o roteiro/i)).toBeInTheDocument()
  })

  it('renders LegacyPostprodFallback (read-only banner) when legacy payload present', () => {
    wrap(<PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={{ schema_version: '2.0' }} />)
    expect(screen.getByText(/Pós legado \(somente leitura\)/i)).toBeInTheDocument()
  })

  it('"Exportar pro editor" opens the HandoffSheet', () => {
    const onOpenHandoff = vi.fn()
    wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={onOpenHandoff} legacy={null} />)
    screen.getByRole('button', { name: /Exportar pro editor/i }).click()
    expect(onOpenHandoff).toHaveBeenCalled()
  })

  it('shows the generate/start chooser (not empty cards) when the brief is empty', () => {
    render(
      <VideoEditorProvider initialState={editSeed}>
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      </VideoEditorProvider>,
    )
    expect(screen.getByText('Sugestões pro editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gerar pós com Cowork/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Começar do zero/i })).toBeInTheDocument()
  })

  it('"Começar do zero" force-seeds a template brief (kind: brief) via onSeed', () => {
    const onSeed = vi.fn()
    render(
      <VideoEditorProvider initialState={editSeed}>
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={null} />
      </VideoEditorProvider>,
    )
    screen.getByRole('button', { name: /Começar do zero/i }).click()
    expect(onSeed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'brief' }))
  })

  it('VIEW mode: chooser actions are visible and "Começar do zero" enters edit mode + force-seeds', () => {
    const onSeed = vi.fn()
    // seed defaults to no editMode → 'view'
    render(
      <VideoEditorProvider initialState={seed}>
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={null} />
      </VideoEditorProvider>,
    )
    expect(screen.getByRole('button', { name: /Gerar pós com Cowork/i })).toBeInTheDocument()
    const startBtn = screen.getByRole('button', { name: /Começar do zero/i })
    expect(startBtn).toBeInTheDocument()
    startBtn.click()
    expect(onSeed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'brief' }))
  })
})
