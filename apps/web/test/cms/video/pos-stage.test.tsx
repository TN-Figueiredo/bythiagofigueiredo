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
const brief = { kind: 'brief' as const, ctas: { note: '', rows: [], display: '' }, style: [], deliverables: {} }

function wrap(node: React.ReactNode) {
  return render(<VideoEditorProvider initialState={seed}>{node}</VideoEditorProvider>)
}

describe('PosStage', () => {
  it('derives Momentos-chave (#1) and B-roll por beat (#1) from the roteiro (not stored)', () => {
    wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Gancho forte/)).toBeInTheDocument()
    expect(screen.getAllByText('B-roll: drone').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#1', { exact: false }).length).toBeGreaterThan(0)
  })

  it('shows the no-beats empty state when roteiro has no beats', () => {
    wrap(<PosStage beats={[]} brief={brief} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Destrinche o roteiro/i)).toBeInTheDocument()
  })

  it('renders LegacyPostprodFallback (read-only banner) when legacy payload present', () => {
    wrap(<PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={vi.fn()} legacy={{ schema_version: '2.0' }} />)
    expect(screen.getByText(/Pós legado \(somente leitura\)/i)).toBeInTheDocument()
  })

  it('"Exportar pro editor" opens the HandoffSheet', () => {
    const onOpenHandoff = vi.fn()
    wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={onOpenHandoff} legacy={null} />)
    screen.getByRole('button', { name: /Exportar pro editor/i }).click()
    expect(onOpenHandoff).toHaveBeenCalled()
  })
})
