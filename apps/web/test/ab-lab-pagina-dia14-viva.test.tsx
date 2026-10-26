// @vitest-environment jsdom
// M7 T11: o diálogo do dia 14 recebe a linha RELIDA (da lista nova), não a que estava no item ao abrir; senão "Mudar resposta" cita
// um `updatedAt` velho e o servidor recusa.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { propsDoLab, paginaVazia, listaDe } from './helpers/ab-lab-pagina-props'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ updateAbSiteSettings: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/pagina/dialogo-dia-14', () => ({
  DialogoDia14: ({ linha }: { linha: LinhaDoCaminho }) => <div data-testid="dlg" data-updated={linha.registro?.updatedAt ?? ''} />,
}))

afterEach(cleanup)

const linha = (updatedAt: string): LinhaDoCaminho => ({
  videoId: 'v9', ytId: 'yt900000009', titulo: 'Vídeo do Studio', miniaturaUrl: null, publicadoEm: '2026-09-01T00:00:00Z', estado: 'resultado_pronto',
  caminho: { tipo: 'nativo' }, fichaId: null, labPausadoAte: null, nosso: null, impressoesPorDia: null,
  registro: {
    id: 'r1', updatedAt, confirmadoEm: '2026-10-10T00:00:00Z', primeiraVista: null, diaDe14: 15,
    variantes: [{ n: 1, titulo: 'Original', imagem: null }, { n: 2, titulo: 'Nova', imagem: null }], variantesTitulo: null, campos: ['titulo'],
    respostaDono: null, tituloAntes: null, varianteVencedora: null, respondidoEm: null, respostaMudadaEm: null, vencedorFonte: null,
    vencedorTitulo: null, desfechoEm: null, inicio: '2026-10-10T00:00:00Z',
  },
} as unknown as LinhaDoCaminho)

describe('diálogo do dia 14 com a linha viva', () => {
  it('depois da releitura o diálogo aberto passa a receber a linha nova da lista; sem ela na lista, mantém a do item', () => {
    const velha = linha('2026-10-25T00:00:00Z')
    const pagina = paginaVazia({ comVoce: { itens: [{ tipo: 'dia14', titulo: velha.titulo, linha: velha, ytId: velha.ytId, prazo: '08/11', vencido: false }], vazio: null } })
    const { rerender } = render(<AbLabDashboard {...propsDoLab({ pagina, listaInicial: listaDe([velha]) })} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Dizer o que o Studio escolheu' })[0]!)
    expect(screen.getByTestId('dlg').getAttribute('data-updated')).toBe('2026-10-25T00:00:00Z')
    rerender(<AbLabDashboard {...propsDoLab({ pagina, listaInicial: listaDe([linha('2026-10-26T12:00:00Z')]) })} />)
    expect(screen.getByTestId('dlg').getAttribute('data-updated')).toBe('2026-10-26T12:00:00Z')
    rerender(<AbLabDashboard {...propsDoLab({ pagina, listaInicial: listaDe([]) })} />)
    expect(screen.getByTestId('dlg').getAttribute('data-updated')).toBe('2026-10-25T00:00:00Z')
  })
})
