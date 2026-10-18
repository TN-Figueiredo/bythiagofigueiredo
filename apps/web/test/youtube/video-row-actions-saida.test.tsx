// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/cms/(authed)/youtube/videos/actions', () => ({
  updateVideo: vi.fn(), approveCategory: vi.fn(), rejectCategory: vi.fn(), pinWeeklyPick: vi.fn(), unpinWeeklyPick: vi.fn(), triggerSync: vi.fn(),
}))

import { VideoContextMenu } from '@/app/cms/(authed)/youtube/videos/video-row-actions'

afterEach(cleanup)

describe('T17: menu da lista de vídeos não decide o que fica no ar', () => {
  it('teste ativo: só "Ver Detalhes do Teste"; sem Pausar nem Encerrar', () => {
    render(<VideoContextMenu videoId="v" isShort={false} abTest={{ id: 't', status: 'active' }} />)
    fireEvent.click(screen.getByLabelText('Mais acoes'))
    expect(screen.getByText('Ver Detalhes do Teste').getAttribute('href')).toBe('/cms/youtube/ab-lab/t')
    expect(screen.queryByText('Pausar Teste')).toBeNull()
    expect(screen.queryByText('Encerrar Teste')).toBeNull()
    expect(screen.queryByRole('button', { name: /Pausar|Encerrar/ })).toBeNull()
  })

  it('sem teste: oferece iniciar', () => {
    render(<VideoContextMenu videoId="v" isShort={false} abTest={null} />)
    fireEvent.click(screen.getByLabelText('Mais acoes'))
    expect(screen.getByText('Iniciar Teste A/B')).toBeTruthy()
  })
})
