// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LinhaDeVideo } from '@/app/cms/(authed)/youtube/ab-lab/_components/linha-de-video'
import type { EligibleVideo } from '@/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog'

const base: EligibleVideo = {
  id: 'v1', title: 'Aladdin', thumbnailUrl: null, durationSeconds: 600, channelHandle: 'h',
  hasActiveTest: true, statusDoTeste: 'draft', rascunhoId: 'd1', bloqueio: null,
  publishedAt: null, viewCount: null, previousLift: null, sourcePipelineId: null,
}
afterEach(cleanup)

describe('seletor de vídeo: continuar rascunho (M7 T16)', () => {
  it('vídeo com rascunho: a linha é clicável, mostra "Continuar rascunho" e chama onContinuarRascunho(rascunhoId)', () => {
    const onEscolher = vi.fn(); const onContinuar = vi.fn()
    render(<LinhaDeVideo video={base} onEscolher={onEscolher} onContinuarRascunho={onContinuar} />)
    const botao = screen.getByRole('button') as HTMLButtonElement
    expect(botao.disabled).toBe(false)
    expect(screen.getByText('Continuar rascunho')).toBeTruthy()
    expect(screen.queryByText('Já tem um rascunho')).toBeNull()
    fireEvent.click(botao)
    expect(onContinuar).toHaveBeenCalledWith('d1')
    expect(onEscolher).not.toHaveBeenCalled()
  })
  it('teste ativo continua bloqueado com "Teste ativo em andamento"', () => {
    render(<LinhaDeVideo video={{ ...base, statusDoTeste: 'active', rascunhoId: null }} onEscolher={vi.fn()} onContinuarRascunho={vi.fn()} />)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Teste ativo em andamento')).toBeTruthy()
  })
  it('sem a prop (outros anfitriões), o rascunho continua bloqueado', () => {
    render(<LinhaDeVideo video={base} onEscolher={vi.fn()} />)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Já tem um rascunho')).toBeTruthy()
  })
})
