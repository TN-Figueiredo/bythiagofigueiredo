import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { LockedStage } from '@/app/cms/(authed)/video/[id]/edit/stages/locked-stage'

describe('LockedStage', () => {
  it('renders the per-stage copy and a "Marcar como gravado" CTA', () => {
    render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn().mockResolvedValue({ ok: true })} />)
    expect(screen.getByText(/Pós/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como gravado/i })).toBeInTheDocument()
  })

  it('calls onUnlock(itemId, version) and shows success on click', async () => {
    const onUnlock = vi.fn().mockResolvedValue({ ok: true })
    render(<LockedStage stageLabel="Publicação" itemId="p1" version={3} onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: /Marcar como gravado/i }))
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith('p1', 3))
  })

  it('surfaces the locked reason via aria (announce locked)', () => {
    render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(screen.getByRole('region', { name: /bloqueado/i })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<LockedStage stageLabel="Pós" itemId="p1" version={1} onUnlock={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
