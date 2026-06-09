import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { LockedStage } from '@/app/cms/(authed)/video/[id]/edit/stages/locked-stage'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import type { ReactElement } from 'react'

// LockedStage dispatches SET_DB_STAGE on a successful unlock, so it needs the editor context.
const seed = {
  itemId: 'p1', code: 'X-01', siteId: 's1', stage: 'roteiro', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'pos', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false, editMode: 'edit',
  showRecStatus: false, recStatus: {}, retakeNotes: {}, markGran: 'off', recRecordedHash: {},
} as never

function renderLocked(ui: ReactElement) {
  return render(<VideoEditorProvider initialState={seed}>{ui}</VideoEditorProvider>)
}

describe('LockedStage', () => {
  it('renders the Pós variant with correct title and CTA', () => {
    renderLocked(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn().mockResolvedValue({ ok: true })} />)
    expect(screen.getByText('A pós entra depois de gravar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como gravado/i })).toBeInTheDocument()
  })

  it('renders the Publicação variant with correct title', () => {
    renderLocked(<LockedStage stageLabel="Publicação" itemId="p1" version={1} onUnlock={vi.fn().mockResolvedValue({ ok: true })} />)
    expect(screen.getByText('A publicação abre quando o vídeo estiver pronto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como gravado/i })).toBeInTheDocument()
  })

  it('renders .locked-stage and .ls-title elements', () => {
    const { container } = renderLocked(
      <LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn().mockResolvedValue({ ok: true })} />,
    )
    expect(container.querySelector('.locked-stage')).toBeTruthy()
    expect(container.querySelector('.ls-title')).toBeTruthy()
    expect(container.querySelector('.ls-sub')).toBeTruthy()
    expect(container.querySelector('.ls-hint')).toBeTruthy()
    expect(container.querySelector('.ls-ico')).toBeTruthy()
    expect(container.querySelector('.ls-badge')).toBeTruthy()
  })

  it('calls onUnlock(itemId, version) on CTA click', async () => {
    const onUnlock = vi.fn().mockResolvedValue({ ok: true })
    renderLocked(<LockedStage stageLabel="Publicação" itemId="p1" version={3} onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: /Marcar como gravado/i }))
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith('p1', 3))
  })

  it('shows ls-hint "Libera Pós e Publicação."', () => {
    renderLocked(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(screen.getByText('Libera Pós e Publicação.')).toBeInTheDocument()
  })

  it('surfaces the locked reason via aria (announce locked)', () => {
    renderLocked(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(screen.getByRole('region', { name: /bloqueado/i })).toBeInTheDocument()
  })

  it('surfaces error message on failure', async () => {
    const onUnlock = vi.fn().mockResolvedValue({ ok: false, error: 'Sem permissão' })
    renderLocked(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: /Marcar como gravado/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem permissão'))
  })

  it('has no axe violations', async () => {
    const { container } = renderLocked(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
