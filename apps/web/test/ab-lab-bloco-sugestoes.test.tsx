// @vitest-environment jsdom
// M7 T11 (desvio 8): o bloco de Sugestões religado na página; sem itens vira uma linha discreta com "Ver detalhes".
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => <a href={href} className={className}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/lib/youtube/observatorio/now', () => ({ observatoryNow: () => Date.parse('2026-10-26T15:00:00Z') }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/actions', () => ({ adiarSugestao: vi.fn(), dispensarSugestao: vi.fn() }))
const abrir = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela', () => ({ abrirListaDaTela: (...a: unknown[]) => abrir(...a) }))
const lista = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes-lista', () => ({
  SugestoesLista: (p: { vista: unknown }) => <div data-testid="sugestoes-lista">{lista(p.vista)}</div>,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model', () => ({
  montarVistaDaLista: () => ({ n: 2 }), VISTA_COM_ERRO: { erro: true },
}))

import { BlocoSugestoes } from '@/app/cms/(authed)/youtube/ab-lab/_components/bloco-sugestoes'

beforeEach(() => { abrir.mockReset(); lista.mockReset() })
afterEach(cleanup)

const ok = (lista: { itens: unknown[]; motivoVazio: string | null; computado_em: string | null }) => ({ estado: 'ok', lista, amostra: new Map(), podeResponder: true })

describe('BlocoSugestoes na página', () => {
  it('com itens aparece a lista de sugestões', async () => {
    abrir.mockResolvedValue(ok({ itens: [{}], motivoVazio: null, computado_em: '2026-10-26T00:00:00Z' }))
    render(await BlocoSugestoes())
    expect(screen.getByTestId('sugestoes-lista')).toBeTruthy()
  })
  it('sem itens: linha discreta "nenhuma agora." com "Ver detalhes" (sem a lista)', async () => {
    abrir.mockResolvedValue(ok({ itens: [], motivoVazio: 'sem-grupo', computado_em: '2026-10-26T00:00:00Z' }))
    render(await BlocoSugestoes())
    expect(screen.getByText('Sugestões de vídeos para testar: nenhuma agora.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toBeTruthy()
    expect(screen.queryByTestId('sugestoes-lista')).toBeNull()
  })
  it('nunca calculado (motivo, ou sem data de cálculo): "ainda não calculadas."', async () => {
    abrir.mockResolvedValue(ok({ itens: [], motivoVazio: 'nunca-calculado', computado_em: null }))
    render(await BlocoSugestoes())
    expect(screen.getByText('Sugestões de vídeos para testar: ainda não calculadas.')).toBeTruthy()
    cleanup()
    abrir.mockResolvedValue(ok({ itens: [], motivoVazio: null, computado_em: null }))
    render(await BlocoSugestoes())
    expect(screen.getByText('Sugestões de vídeos para testar: ainda não calculadas.')).toBeTruthy()
  })
  it('sem acesso: nada', async () => {
    abrir.mockResolvedValue({ estado: 'sem_acesso' })
    expect(await BlocoSugestoes()).toBeNull()
  })
})
