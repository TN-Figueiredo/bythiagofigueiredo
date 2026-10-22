// @vitest-environment jsdom
// C1 (revisão do lote): o Next entrega `acoes` com identidade nova a cada router.refresh(); a ficha NÃO pode reler/criar outra por isso.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { ListaCaminhoComPaineis } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-paineis'
import { ContextoAssistente, useControleAssistente } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/assistente-contexto'
import type { AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { fichaLida, AGORA_FICHA, URL_IMG, SHA } from './helpers/ficha-fixture'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const IMG = (nome: string) => ({ url: URL_IMG(nome), sha256: SHA, largura: 1280, altura: 720 })
const ficha = fichaLida({
  studio_aberto_em: '2026-10-22T14:42:00.000Z', enviada: true,
  variantes: [{ n: 1, tipo: 'combo', titulo: 'Título da A', imagem: IMG('a') }, { n: 2, tipo: 'combo', titulo: 'Título da B', imagem: IMG('b') }],
})
const base = {
  videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Vídeo 1', miniaturaUrl: null, publicadoEm: '2026-10-10T12:00:00.000Z',
  estado: 'sugerido_youtube', caminho: { tipo: 'nativo', portao: true, motivo: 'Vídeo longo com volume.' },
  fichaId: ficha.id, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300,
}
const linhaAntes = base as unknown as LinhaDoCaminho
const linhaDepois = {
  ...base, estado: 'em_teste_studio',
  registro: { id: 'reg-1', updatedAt: '2026-10-22T14:50:00.000Z', confirmadoEm: '2026-10-22T14:50:00.000Z', primeiraVista: null, diaDe14: 0, variantes: null, variantesTitulo: null, campos: null, respostaDono: null },
} as unknown as LinhaDoCaminho

function mk(lerSegunda: unknown = { ok: true, ficha, vencida: false }) {
  const ler = vi.fn().mockResolvedValueOnce({ ok: true, ficha, vencida: false }).mockResolvedValue(lerSegunda)
  return {
    lerFichaDoVideo: ler, abrirFicha: vi.fn(), recomecarFicha: vi.fn(), salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(),
    marcarStudioAberto: vi.fn(), lembrarNoComputador: vi.fn(), confirmarDetectado: vi.fn(), naoETeste: vi.fn(), responderTesteDoYouTube: vi.fn(),
    pauseAbTest: vi.fn(), retryRestore: vi.fn(),
    jaIniciei: vi.fn().mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] }),
  }
}
function Casca({ acoes, linha }: { acoes: ReturnType<typeof mk>; linha: LinhaDoCaminho }): ReactElement {
  const c = useControleAssistente({ onAbrir: vi.fn(), atualizar: vi.fn(), agora: () => AGORA_FICHA })
  return <ContextoAssistente.Provider value={c}><ListaCaminhoComPaineis linhas={[linha]} videoInicial="vid00000001" acoes={acoes as unknown as AcoesCaminho} agora={() => AGORA_FICHA} /></ContextoAssistente.Provider>
}
beforeEach(() => { vi.stubGlobal('open', vi.fn()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('PainelFicha: router.refresh troca a identidade de `acoes` (C1)', () => {
  it('depois do "Já iniciei", acoes novo + linha registrada: não relê nem cria ficha; o bloco "registrado" fica', async () => {
    const acoes = mk({ ok: true, ficha: null, vencida: false })
    const r = render(<Casca acoes={acoes} linha={linhaAntes} />)
    await screen.findByText(FRASES.ficha.voceAbriuOStudio('11:42'))
    fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.jaIniciei }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: FRASES.ficha.bloco3.confirmar })) })
    expect(acoes.jaIniciei).toHaveBeenCalledTimes(1)
    r.rerender(<Casca acoes={{ ...acoes }} linha={linhaDepois} />)
    await act(async () => { await Promise.resolve() })
    expect(acoes.abrirFicha).not.toHaveBeenCalled()
    expect(acoes.lerFichaDoVideo).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/^Teste registrado em /)).toBeTruthy()
  })

  it('"Recarregar" com a releitura nula (outro aparelho vinculou): não cria ficha; mostra o cartão do teste registrado', async () => {
    const acoes = mk({ ok: true, ficha: null, vencida: false })
    const r = render(<Casca acoes={acoes} linha={linhaAntes} />)
    await screen.findByText(FRASES.ficha.voceAbriuOStudio('11:42'))
    r.rerender(<Casca acoes={{ ...acoes }} linha={linhaDepois} />)
    await act(async () => { await Promise.resolve() })
    expect(acoes.abrirFicha).not.toHaveBeenCalled()
    expect(acoes.lerFichaDoVideo).toHaveBeenCalledTimes(1)
  })
})
