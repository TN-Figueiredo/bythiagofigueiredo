// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import { montarPainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import { propsDoLab } from './helpers/ab-lab-pagina-props'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ updateAbSiteSettings: vi.fn(), batchStartTests: vi.fn() }))

afterEach(() => cleanup())

const painel = montarPainelEscolha({
  testId: 'velho', nomeVideo: 'Bangkok antigo', tipo: 'title', restoreSeq: 3, podeAdministrar: true,
  variantes: [
    { id: 'va', letra: 'A', original: true, titulo: 'Título A', miniatura: null, ctr: 0.04 },
    { id: 'vb', letra: 'B', original: false, titulo: 'Título B', miniatura: null, ctr: 0.05 },
  ],
  sugeridaId: 'vb', noAr: { tipo: 'confirmado', varianteId: 'va', letra: 'A', desde: '2026-10-01T10:00:00.000Z' },
  originalGuardada: { titulo: true, miniatura: true }, escolha: null,
})

describe('M7b T15: ?painel= abre o painel de qualquer concluído v2', () => {
  it('com painelDaUrl, o painel abre mesmo sem linha nos Concluídos nem item no "Com você"', () => {
    render(<AbLabDashboard {...propsDoLab({ painelInicial: 'velho', painelDaUrl: painel })} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.body.textContent).toContain('Bangkok antigo')
  })
  it('sem painelDaUrl nem linha, nada abre', () => {
    render(<AbLabDashboard {...propsDoLab({ painelInicial: 'velho' })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('D25: sem painel para abrir, avisa em vez de ficar mudo', () => {
    render(<AbLabDashboard {...propsDoLab({ painelInicial: 'velho' })} />)
    expect(screen.getByRole('status').textContent).toContain('Não deu para abrir esse teste aqui')
  })
  it('D25: com painel aberto, não há aviso', () => {
    render(<AbLabDashboard {...propsDoLab({ painelInicial: 'velho', painelDaUrl: painel })} />)
    expect(document.body.textContent).not.toContain('Não deu para abrir esse teste aqui')
  })
})
