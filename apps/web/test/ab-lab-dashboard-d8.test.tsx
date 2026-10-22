// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import { ListaCaminho, type AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { ListaErro } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-erro'
import { makeSuggestion, makeDraft } from './helpers/ab-fixtures'

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
const acoes = (): AcoesCaminho => ({ jaIniciei: vi.fn() } as unknown as AcoesCaminho)

const base = {
  stats: { activeTests: 0, winRate: null, completedTests: 0, winRateBase: 0, testsWon: 0 },
  cards: [], drafts: [], completed: [], paused: [], learnings: null, channelLearnings: null,
  suggested: [makeSuggestion({ id: 'uuid-1', title: 'Vídeo 1' })], settings: { ...AB_SITE_SETTINGS_DEFAULTS }, siteId: 's', eligibleVideos: [],
}
const lista = (l: LinhaDoCaminho[], a = acoes()): ReactNode => (
  <ListaCaminho linhas={l} videoInicial={null} acoes={a} painel={() => null} />
)
const Bomba = (): ReactNode => { throw new Error('boom') }
const Pendente = (): ReactNode => <p>carregando a lista</p>

beforeEach(() => { refresh.mockClear(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('AbLabDashboard: guarda D-8 nas portas reais', () => {
  it('seletor de vídeo: ficha enviada há 3 d mostra a pergunta e não abre o assistente', () => {
    render(<AbLabDashboard {...base} listaSlot={lista([linha()])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    fireEvent.click(screen.getByText('Escolher Vídeo 1'))
    expect(screen.queryByTestId('wizard')).toBeNull()
    expect(screen.getByText(FRASES.guarda.pergunta)).toBeTruthy()
  })
  it('Sugeridos: o cartão abre o seletor (não o assistente) e a escolha passa pela pergunta', () => {
    render(<AbLabDashboard {...base} listaSlot={lista([linha()])} />)
    fireEvent.click(screen.getByRole('button', { name: /^Testar / }))
    expect(screen.queryByTestId('wizard')).toBeNull()
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
    fireEvent.click(screen.getByText('Escolher Vídeo 1'))
    expect(screen.queryByTestId('wizard')).toBeNull()
    expect(screen.getByText(FRASES.guarda.pergunta)).toBeTruthy()
  })
  it('ficha de 15 d ou com registro_id: abre direto com o vídeo', () => {
    for (const l of [linha({ fichaEnviadaEm: dia(15) }), linha({ fichaEnviadaEm: null })]) {
      const r = render(<AbLabDashboard {...base} listaSlot={lista([l])} />)
      fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
      fireEvent.click(screen.getByText('Escolher Vídeo 1'))
      expect(screen.getByTestId('wizard').textContent).toBe('uuid-1')
      expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
      r.unmount()
    }
  })
  it('handleContinueDraft abre direto, sem a pergunta', () => {
    const d = makeDraft({ videoId: 'uuid-1' })
    render(<AbLabDashboard {...base} drafts={[d]} listaSlot={lista([linha()])} />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByTestId('wizard')).toBeTruthy()
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
  })
  it('"Já iniciei" confirmado: a pergunta fecha e a linha relê', async () => {
    const a = acoes()
    vi.mocked(a.jaIniciei).mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    render(<AbLabDashboard {...base} listaSlot={lista([linha()], a)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Já iniciei' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })) })
    expect(a.jaIniciei).toHaveBeenCalledWith('ficha-1')
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
    expect(refresh).toHaveBeenCalled()
  })
})

describe('AbLabDashboard: lista carregando ou em erro (D-8 falha aberta)', () => {
  it('enquanto a lista carrega as portas ficam desabilitadas e nada abre', () => {
    render(<AbLabDashboard {...base} listaSlot={<Pendente />} />)
    expect((screen.getByRole('button', { name: 'Novo teste' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Testar / }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Começar do zero/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Testar / }))
    expect(screen.queryByText('Escolher Vídeo 1')).toBeNull()
  })
  it('quando a lista chega as portas habilitam', () => {
    render(<AbLabDashboard {...base} listaSlot={lista([linha()])} />)
    expect((screen.getByRole('button', { name: 'Novo teste' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: /^Testar / }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('com a lista em erro: portas habilitadas e abrem sem perguntar', () => {
    render(<AbLabDashboard {...base} listaSlot={<ListaErro><Bomba /></ListaErro>} />)
    expect(screen.getByText(FRASES.lista.leituraFalhou)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Novo teste' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    fireEvent.click(screen.getByText('Escolher Vídeo 1'))
    expect(screen.getByTestId('wizard').textContent).toBe('uuid-1')
  })
  it('sem listaSlot (página sem a lista): portas habilitadas', () => {
    render(<AbLabDashboard {...base} />)
    expect((screen.getByRole('button', { name: 'Novo teste' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
