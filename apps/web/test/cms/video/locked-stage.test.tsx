import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { LockedStage } from '@/app/cms/(authed)/video/[id]/edit/stages/locked-stage'

describe('LockedStage', () => {
  it('renders the Pós variant with correct title and CTA', () => {
    render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn().mockResolvedValue({ ok: true })} />)
    expect(screen.getByText('A pós entra depois de gravar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como gravado/i })).toBeInTheDocument()
  })

  it('renders the Publicação variant with correct title', () => {
    render(<LockedStage stageLabel="Publicação" itemId="p1" version={1} onUnlock={vi.fn().mockResolvedValue({ ok: true })} />)
    expect(screen.getByText('A publicação abre quando o vídeo estiver pronto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como gravado/i })).toBeInTheDocument()
  })

  it('renders .locked-stage and .ls-title elements', () => {
    const { container } = render(
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
    render(<LockedStage stageLabel="Publicação" itemId="p1" version={3} onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: /Marcar como gravado/i }))
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith('p1', 3))
  })

  it('shows ls-hint "Libera Pós e Publicação."', () => {
    render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(screen.getByText('Libera Pós e Publicação.')).toBeInTheDocument()
  })

  it('surfaces the locked reason via aria (announce locked)', () => {
    render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(screen.getByRole('region', { name: /bloqueado/i })).toBeInTheDocument()
  })

  it('surfaces error message on failure', async () => {
    const onUnlock = vi.fn().mockResolvedValue({ ok: false, error: 'Sem permissão' })
    render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: /Marcar como gravado/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem permissão'))
  })

  it('has no axe violations', async () => {
    const { container } = render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
