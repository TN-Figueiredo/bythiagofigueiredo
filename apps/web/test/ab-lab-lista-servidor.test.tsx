// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'

const lerLinhas = vi.fn()
vi.mock('@/lib/youtube/teste-youtube/nativo/lista-borda', () => ({ lerLinhasDoCaminho: (...a: unknown[]) => lerLinhas(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions-nativo', () => ({
  abrirFicha: vi.fn(), lerFichaDoVideo: vi.fn(), recomecarFicha: vi.fn(), salvarFicha: vi.fn(), marcarStudioAberto: vi.fn(),
  enviarImagemDaFicha: vi.fn(), lembrarNoComputador: vi.fn(), jaIniciei: vi.fn(), confirmarDetectado: vi.fn(), naoETeste: vi.fn(),
  responderTesteDoYouTube: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ pauseAbTest: vi.fn(), retryRestore: vi.fn() }))

import { ListaCaminhoServidor } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-servidor'
import { ListaErro } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-erro'

afterEach(() => { cleanup(); lerLinhas.mockReset() })

describe('ListaCaminhoServidor + ListaErro', () => {
  it('leitura que lança propaga o erro (nunca lista vazia "0 vídeos")', async () => {
    lerLinhas.mockRejectedValueOnce(new Error('banco fora'))
    await expect(ListaCaminhoServidor({ siteId: 's', videoInicial: null })).rejects.toThrow('banco fora')
  })
  it('o boundary mostra a frase e o painel dos testes segue intacto', async () => {
    lerLinhas.mockRejectedValueOnce(new Error('banco fora'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const erro = await ListaCaminhoServidor({ siteId: 's', videoInicial: null }).then(() => null, (e: unknown) => e as Error)
    expect(erro).toBeInstanceOf(Error)
    const Filho = (): ReactNode => { throw erro }
    render(<div><p>painel dos testes</p><ListaErro><Filho /></ListaErro></div>)
    expect(screen.getByText('Não deu para ler a lista agora.')).toBeTruthy()
    expect(screen.getByText('painel dos testes')).toBeTruthy()
    expect(document.body.textContent).not.toContain('banco fora')
  })
})
