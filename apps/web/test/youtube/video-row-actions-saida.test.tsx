// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
const acoes = vi.hoisted(() => ({ pauseAbTest: vi.fn(), endAbTest: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => acoes)
vi.mock('@/app/cms/(authed)/youtube/videos/actions', () => ({
  updateVideo: vi.fn(), approveCategory: vi.fn(), rejectCategory: vi.fn(), pinWeeklyPick: vi.fn(), unpinWeeklyPick: vi.fn(), triggerSync: vi.fn(),
}))

import { VideoContextMenu } from '@/app/cms/(authed)/youtube/videos/video-row-actions'

async function encerrarPelaLista() {
  render(<VideoContextMenu videoId="v" isShort={false} abTest={{ id: 't', status: 'active' }} />)
  fireEvent.click(screen.getByLabelText('Mais acoes'))
  fireEvent.click(screen.getByRole('button', { name: 'Encerrar Teste' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
}

beforeEach(() => { toast.success.mockClear(); toast.error.mockClear() })
afterEach(cleanup)

describe('T15 r1 D6: toast da lista de vídeos', () => {
  it('feito com thumbnail recusada pelo YouTube -> toast de erro, nunca o verde', async () => {
    acoes.endAbTest.mockResolvedValue({ ok: true, resultado: 'feito', campos: { thumbnail: { estado: 'falhou' } } })
    await encerrarPelaLista()
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(toast.error.mock.calls[0]![0]).toMatch(/O YouTube recusou a troca/)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('feito com tudo ok -> toast verde', async () => {
    acoes.endAbTest.mockResolvedValue({ ok: true, resultado: 'feito', campos: { thumbnail: { estado: 'ok' } } })
    await encerrarPelaLista()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Teste encerrado.'))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('ok:true que não é feito (precisa_confirmar) nunca fica verde', async () => {
    acoes.endAbTest.mockResolvedValue({ ok: true, resultado: 'precisa_confirmar', campos: [] })
    await encerrarPelaLista()
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(toast.success).not.toHaveBeenCalled()
  })
})
