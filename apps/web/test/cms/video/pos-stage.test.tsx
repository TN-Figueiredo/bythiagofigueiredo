import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PosStage } from '@/app/cms/(authed)/video/[id]/edit/stages/pos-stage'
import type { RoteiroBeatV3 } from '@/lib/pipeline/video-schemas'

const beats: RoteiroBeatV3[] = [
  { idx: 0, name: 'Abertura', status: 'PENDING', script: [
    { type: 'line', text: 'Gancho **forte**', key: true },
    { type: 'vis', text: 'B-roll: drone' },
  ] },
]
const brief = { kind: 'brief' as const, ctas: { note: '', rows: [], display: '' }, style: [], deliverables: {} }

describe('PosStage', () => {
  it('derives Momentos-chave (#1) and B-roll por beat (#1) from the roteiro (not stored)', () => {
    render(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText('Gancho **forte**')).toBeInTheDocument()
    expect(screen.getByText('B-roll: drone')).toBeInTheDocument()
    expect(screen.getByText('#1', { exact: false })).toBeInTheDocument()
  })

  it('shows the no-beats empty state when roteiro has no beats', () => {
    render(<PosStage beats={[]} brief={brief} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Destrinche o roteiro/i)).toBeInTheDocument()
  })

  it('renders LegacyPostprodFallback (read-only banner) when legacy payload present', () => {
    render(<PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={vi.fn()} legacy={{ schema_version: '2.0' }} />)
    expect(screen.getByText(/Pós legado \(somente leitura\)/i)).toBeInTheDocument()
  })

  it('"Exportar pro editor" opens the HandoffSheet', () => {
    const onOpenHandoff = vi.fn()
    render(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onOpenHandoff={onOpenHandoff} legacy={null} />)
    screen.getByRole('button', { name: /Exportar pro editor/i }).click()
    expect(onOpenHandoff).toHaveBeenCalled()
  })
})
