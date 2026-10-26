// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type { AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { makeDraft } from './helpers/ab-fixtures'
import { propsDoLab, paginaVazia, listaDe } from './helpers/ab-lab-pagina-props'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  updateAbSiteSettings: vi.fn(), batchStartTests: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: ({ video }: { video: { id: string } }) => <div data-testid="wizard">{video.id}</div>,
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog', () => ({
  VideoPickerDialog: ({ onSelect }: { onSelect: (v: { id: string; title: string; thumbnailUrl: string | null }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 'uuid-1', title: 'Vídeo 1', thumbnailUrl: null })}>Escolher Vídeo 1</button>
  ),
}))

const dia = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()
function linha(o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho {
  return {
    videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Vídeo 1', miniaturaUrl: null, publicadoEm: dia(5),
    estado: 'sugerido_nosso', caminho: { tipo: 'nosso', motivo: 'Short: o Studio não oferece o teste. Só o nosso, como indício.' },
    fichaId: 'ficha-1', fichaEnviadaEm: dia(3), fichaCompleta: true, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300, ...o,
  }
}
const acoes = (): AcoesCaminho => ({ jaIniciei: vi.fn(), lembrarNoComputador: vi.fn() } as unknown as AcoesCaminho)
const com = (l: LinhaDoCaminho[], a = acoes(), o: Parameters<typeof propsDoLab>[0] = {}) => propsDoLab({ listaInicial: listaDe(l), acoesCaminho: a, ...o })

beforeEach(() => { refresh.mockClear(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('AbLabDashboard: guarda D-8 nas portas reais', () => {
  it('seletor de vídeo: ficha enviada há 3 d mostra a pergunta e não abre o assistente', () => {
    render(<AbLabDashboard {...com([linha()])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    fireEvent.click(screen.getByText('Escolher Vídeo 1'))
    expect(screen.queryByTestId('wizard')).toBeNull()
    expect(screen.getByText(FRASES.guarda.pergunta)).toBeTruthy()
  })
  it('a guarda vale mesmo com "Vídeos do canal" recolhido (as linhas da 1ª página são registradas pela página)', () => {
    const { container } = render(<AbLabDashboard {...com([linha()])} />)
    expect((container.querySelector('details') as HTMLDetailsElement).open).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    fireEvent.click(screen.getByText('Escolher Vídeo 1'))
    expect(screen.getByText(FRASES.guarda.pergunta)).toBeTruthy()
  })
  it('ficha de 15 d ou com registro_id: abre direto com o vídeo', () => {
    for (const l of [linha({ fichaEnviadaEm: dia(15) }), linha({ fichaEnviadaEm: null })]) {
      const r = render(<AbLabDashboard {...com([l])} />)
      fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
      fireEvent.click(screen.getByText('Escolher Vídeo 1'))
      expect(screen.getByTestId('wizard').textContent).toBe('uuid-1')
      expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
      r.unmount()
    }
  })
  it('"Continuar rascunho" da faixa Com você abre direto, sem a pergunta', () => {
    const d = makeDraft({ id: 'd1', videoId: 'uuid-1', name: 'Rascunho do Vídeo 1' })
    const pagina = paginaVazia({ comVoce: { itens: [{ tipo: 'rascunho', draftId: 'd1', titulo: 'Rascunho do Vídeo 1', passo: 2 }], vazio: null } })
    render(<AbLabDashboard {...com([linha()], acoes(), { drafts: [d], pagina })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar rascunho' }))
    expect(screen.getByTestId('wizard')).toBeTruthy()
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
  })
  it('"Já iniciei" confirmado: a pergunta fecha e a linha relê', async () => {
    const a = acoes()
    vi.mocked(a.jaIniciei).mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    render(<AbLabDashboard {...com([linha()], a)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Já iniciei' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })) })
    expect(a.jaIniciei).toHaveBeenCalledWith('ficha-1')
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
    expect(refresh).toHaveBeenCalled()
  })
})

describe('AbLabDashboard: lista em erro (D-8 falha aberta)', () => {
  it('com a lista em erro: frase de erro, portas habilitadas e abrem sem perguntar; o resto da página segue', () => {
    const quebrada = { ...listaDe([]), contagem: undefined } as unknown as ReturnType<typeof listaDe>
    render(<AbLabDashboard {...propsDoLab({ listaInicial: quebrada })} />)
    expect(screen.getByText(FRASES.lista.leituraFalhou)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'A/B Lab' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Novo teste' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    fireEvent.click(screen.getByText('Escolher Vídeo 1'))
    expect(screen.getByTestId('wizard').textContent).toBe('uuid-1')
  })
})
