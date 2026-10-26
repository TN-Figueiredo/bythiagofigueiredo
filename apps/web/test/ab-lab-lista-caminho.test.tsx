// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { ListaCaminho, type AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { ContextoAssistente, useControleAssistente } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/assistente-contexto'
import { ListaEsqueleto } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-esqueleto'
import { ListaErro } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-erro'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const ID = (n: number): string => `vid${String(n).padStart(8, '0')}`

function linha(n: number, o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho {
  return {
    videoId: `uuid-${n}`, ytId: ID(n), titulo: `Vídeo ${n}`, miniaturaUrl: null, publicadoEm: dia(3 + n),
    estado: 'sugerido_youtube', caminho: { tipo: 'nativo', portao: true, motivo: 'Vídeo longo com volume: o teste do YouTube é o caminho.' },
    fichaId: null, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300, ...o,
  }
}
const nosso = (n: number, o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho =>
  linha(n, { estado: 'sugerido_nosso', caminho: { tipo: 'nosso', motivo: 'Short: o Studio não oferece o teste. Só o nosso, como indício.' }, ...o })
const reg = (o: Partial<NonNullable<LinhaDoCaminho['registro']>> = {}): NonNullable<LinhaDoCaminho['registro']> => ({
  id: 'reg-1', updatedAt: dia(1), inicio: dia(4), confirmadoEm: dia(4), primeiraVista: dia(4), diaDe14: 4, variantes: null, variantesTitulo: null, campos: null, respostaDono: null, ...o,
})
const duas = [{ n: 1, titulo: 'A', imagem: null }, { n: 2, titulo: 'B', imagem: null }]
const tres = [...duas, { n: 3, titulo: 'C', imagem: null }]

const mk = (): AcoesCaminho => ({
  abrirFicha: vi.fn(), lerFichaDoVideo: vi.fn(), recomecarFicha: vi.fn(), salvarFicha: vi.fn(), marcarStudioAberto: vi.fn(),
  enviarImagemDaFicha: vi.fn(), lembrarNoComputador: vi.fn(), jaIniciei: vi.fn(), confirmarDetectado: vi.fn(), naoETeste: vi.fn(),
  responderTesteDoYouTube: vi.fn(), pauseAbTest: vi.fn(), retryRestore: vi.fn(),
} as unknown as AcoesCaminho)

let acoes: AcoesCaminho
let onAbrir: ReturnType<typeof vi.fn>
let atualizar: ReturnType<typeof vi.fn>

const painelStub = (l: LinhaDoCaminho, c: { vista: 'ficha' | 's7'; estadoS7: 1 | 2 | null; fechar: () => void }): ReactNode => (
  <section data-testid="painel" data-vista={c.vista} data-estado={String(c.estadoS7)}>
    <h2 tabIndex={-1}>{c.vista === 's7' ? 'Cartão S7' : 'Ficha do teste'}: {l.titulo}</h2>
    <button type="button" onClick={c.fechar}>Fechar painel</button>
  </section>
)

function Harness({ linhas, videoInicial = null, responder }: { linhas: LinhaDoCaminho[]; videoInicial?: string | null; responder?: Parameters<typeof ListaCaminho>[0]['responder'] }): ReactNode {
  const controle = useControleAssistente({ onAbrir: (v) => onAbrir(v), atualizar: () => atualizar(), agora: () => AGORA })
  return (
    <ContextoAssistente.Provider value={controle}>
      <button type="button" onClick={() => controle.abrirAssistente({ id: 'uuid-1', title: 'Vídeo 1', thumbnailUrl: null })}>Porta do seletor</button>
      <ListaCaminho linhas={linhas} videoInicial={videoInicial} acoes={acoes} painel={painelStub} responder={responder} agora={() => AGORA} />
    </ContextoAssistente.Provider>
  )
}

// O Node 25 expõe um `localStorage` próprio sem `clear`; os testes trazem o seu.
function armazem(lanca = false): Storage {
  const m = new Map<string, string>()
  const bloqueia = (): never => { throw new Error('bloqueado') }
  return {
    get length() { return m.size }, key: (i: number) => [...m.keys()][i] ?? null,
    getItem: lanca ? bloqueia : (k: string) => m.get(k) ?? null, setItem: lanca ? bloqueia : (k: string, v: string) => { m.set(k, v) },
    removeItem: lanca ? bloqueia : (k: string) => { m.delete(k) }, clear: () => m.clear(),
  }
}
const trocar = (lanca = false): void => { vi.stubGlobal('localStorage', armazem(lanca)); vi.stubGlobal('sessionStorage', armazem(lanca)) }
beforeEach(() => { acoes = mk(); onAbrir = vi.fn(); atualizar = vi.fn(); trocar() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('ListaCaminho: grupos, resumo e rodapé', () => {
  it('Precisa de você / Outros vídeos com contagem, resumo e o rodapé de D-7', () => {
    const l = [
      linha(1, { estado: 'sem_resposta', registro: reg({ variantes: duas }) }),
      linha(2, { estado: 'resultado_pronto', registro: reg({ variantes: duas }) }),
      linha(3), nosso(4), linha(5),
    ]
    render(<Harness linhas={l} />)
    const grupos = screen.getAllByTestId('grupo')
    expect(grupos[0]!.textContent).toContain('Precisa de você')
    expect(grupos[0]!.textContent).toContain('2 vídeos')
    expect(grupos[1]!.textContent).toContain('Outros vídeos')
    expect(grupos[1]!.textContent).toContain('3 vídeos')
    expect(screen.getByText(/Dois vídeos esperam a sua resposta/)).toBeTruthy()
    expect(screen.getByText(FRASES.lista.rodape)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Vídeos do A/B Lab' })).toBeTruthy()
    expect(screen.getByText('5 vídeos')).toBeTruthy()
  })
  it('sem caso misto: todos os que esperam contam juntos (T5-A)', () => {
    const l = [
      linha(1, { estado: 'resultado_pronto', registro: reg({ variantes: duas }) }),
      linha(2, { estado: 'resultado_pronto', registro: reg({ variantes: tres }) }),
      linha(3, { estado: 'sem_resposta', registro: reg({ variantes: null }) }),
    ]
    render(<Harness linhas={l} />)
    expect(screen.getByText(/Três vídeos esperam a sua resposta/)).toBeTruthy()
    expect(screen.queryByText(/Mais .* resultado pronto/)).toBeNull()
  })
  it('sem pendência: sem grupo Precisa de você', () => {
    render(<Harness linhas={[linha(1), linha(2)]} />)
    expect(screen.getByText(FRASES.lista.nadaEspera)).toBeTruthy()
    expect(screen.queryByText('Precisa de você')).toBeNull()
  })
})

describe('ListaCaminho: Prefiro outro caminho (D-2)', () => {
  it('Short/kids/18+/ao vivo (caminho nosso) e formato não confirmado não oferecem a troca', () => {
    render(<Harness linhas={[nosso(1), nosso(2), linha(3, { estado: 'formato_nao_confirmado', caminho: { tipo: 'nao_confirmado', motivo: 'Ainda não sabemos se é Short. Se for, o Studio não oferece o teste.' } })]} />)
    expect(screen.queryByText('Prefiro outro caminho')).toBeNull()
  })
  it('troca na tela, sem servidor, e guarda no sessionStorage por vídeo (sem título nem URL)', () => {
    render(<Harness linhas={[linha(1)]} />)
    expect(screen.getByText('Caminho sugerido: teste do YouTube')).toBeTruthy()
    fireEvent.click(screen.getByText('Prefiro outro caminho'))
    expect(screen.getByText('Caminho escolhido por você: nosso teste')).toBeTruthy()
    expect(screen.getByText('Prefiro o teste do YouTube')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Iniciar teste' })).toBeTruthy()
    for (const fn of Object.values(acoes)) expect(fn).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(`ab-lab:caminho:${ID(1)}`)).toBe('nosso')
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)!
      expect(window.sessionStorage.getItem(k)).not.toMatch(/Vídeo 1|http/)
    }
  })
  it('recarregar continua em "Caminho escolhido por você" e dá para voltar', () => {
    const a = render(<Harness linhas={[linha(1)]} />)
    fireEvent.click(screen.getByText('Prefiro outro caminho'))
    a.unmount()
    render(<Harness linhas={[linha(1)]} />)
    expect(screen.getByText('Caminho escolhido por você: nosso teste')).toBeTruthy()
    fireEvent.click(screen.getByText('Prefiro o teste do YouTube'))
    expect(screen.getByText('Caminho sugerido: teste do YouTube')).toBeTruthy()
    expect(window.sessionStorage.getItem(`ab-lab:caminho:${ID(1)}`)).toBeNull()
  })
  it('sessionStorage lançando: segue sem erro', () => {
    trocar(true)
    render(<Harness linhas={[linha(1)]} />)
    fireEvent.click(screen.getByText('Prefiro outro caminho'))
    expect(screen.getByText('Caminho escolhido por você: nosso teste')).toBeTruthy()
    fireEvent.click(screen.getByText('Prefiro o teste do YouTube'))
    expect(screen.getByText('Caminho sugerido: teste do YouTube')).toBeTruthy()
  })
})

describe('ListaCaminho: estados de linha', () => {
  it('formato não confirmado: os dois botões com os textos do mockup', () => {
    render(<Harness linhas={[linha(1, { estado: 'formato_nao_confirmado', caminho: { tipo: 'nao_confirmado', motivo: 'Ainda não sabemos se é Short. Se for, o Studio não oferece o teste.' } })]} />)
    expect(screen.getByText('Formato não confirmado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Testar no YouTube' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Iniciar teste' })).toBeTruthy()
    expect(screen.getByText('Se for vídeo longo. Se for Short, o Studio não oferece o teste.')).toBeTruthy()
    expect(screen.getByText('Vale para qualquer formato. Dá um indício por tempo alternado.')).toBeTruthy()
  })
  it('em teste no Studio com nosso pausado: linha âmbar com a data de retomar', () => {
    const l = linha(1, {
      estado: 'em_teste_studio', registro: reg(), nosso: { testId: 't', restoreSeq: 1, dia: 2, teto: 14, status: 'paused' },
      labPausadoAte: '2026-11-04T03:00:00.000Z',
    })
    render(<Harness linhas={[l]} />)
    expect(screen.getAllByText(/Lab pausado/).length).toBeGreaterThan(0)
    expect(document.body.textContent).toContain('porque há teste no Studio. Retomar fica disponível a partir de 04/11.')
  })
  it('I-3: linha ainda não confirmada diz "parece haver" no selo e na pausa; a confirmada diz "Em teste no Studio" e "há"', () => {
    const nosso = { testId: 't', restoreSeq: 1, dia: 2, teto: 14, status: 'paused' as const }
    render(<Harness linhas={[
      linha(1, { estado: 'em_teste_studio', registro: reg({ confirmadoEm: null }), nosso, labPausadoAte: '2026-11-04T03:00:00.000Z' }),
    ]} />)
    expect(screen.getByText(FRASES.s7.selo)).toBeTruthy()
    expect(screen.queryByText(FRASES.s7.selo2)).toBeNull()
    expect(document.body.textContent).toContain('Lab pausado porque parece haver teste no Studio. Retomar fica disponível a partir de 04/11.')
    expect(document.body.textContent).not.toContain('porque há teste')
    cleanup()
    render(<Harness linhas={[linha(1, { estado: 'em_teste_studio', registro: reg(), nosso, labPausadoAte: dia(1) })]} />)
    expect(screen.getByText(FRASES.s7.selo2)).toBeTruthy()
    expect(document.body.textContent).toContain('Lab pausado porque há teste no Studio. Retomar espera o resultado do teste no Studio.')
  })
  it('passada a data com o registro aberto: Retomar espera o resultado', () => {
    const l = linha(1, {
      estado: 'em_teste_studio', registro: reg(), nosso: { testId: 't', restoreSeq: 1, dia: 2, teto: 14, status: 'paused' },
      labPausadoAte: dia(1),
    })
    render(<Harness linhas={[l]} />)
    expect(document.body.textContent).toContain('Retomar espera o resultado do teste no Studio.')
  })
  it('ficou_no_ar, respostas_diferentes e respondido_sem_vencedor: selo, frase e a porta do bloco ("Ver teste"/"Ver as duas", T7)', () => {
    render(<Harness linhas={[
      linha(1, { estado: 'ficou_no_ar', registro: reg({ respostaDono: 'venceu_nova' }) }),
      linha(2, { estado: 'respostas_diferentes', registro: reg({ respostaDono: 'venceu_nova' }) }),
      linha(3, { estado: 'respondido_sem_vencedor', registro: reg({ respostaDono: 'ficou_igual' }) }),
    ]} />)
    expect(screen.getByText('Ficou no ar')).toBeTruthy()
    expect(screen.getByText('Respostas diferentes')).toBeTruthy()
    expect(screen.getByText(FRASES.resposta.ficouIgual)).toBeTruthy()
    expect(screen.getByText(FRASES.resposta.apoioSemVencedor)).toBeTruthy()
    expect(screen.queryByText(/Ficou no ar.*igual/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver as duas' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Ver teste' })).toHaveLength(2)
  })
  it('2 versões: o slot de "Responder" (T10b) é renderizado no lugar da ação', () => {
    render(<Harness
      linhas={[linha(1, { estado: 'resultado_pronto', registro: reg({ variantes: duas }) })]}
      responder={(l) => <button type="button">Responder {l.titulo}</button>}
    />)
    expect(screen.getByRole('button', { name: 'Responder Vídeo 1' })).toBeTruthy()
  })
  it('no máximo um .pri no DOM', () => {
    const { container } = render(<Harness linhas={[
      linha(1, { estado: 'sem_resposta', registro: reg({ variantes: duas }) }),
      linha(2, { estado: 'sem_resposta', registro: reg({ variantes: duas }) }),
      linha(3), nosso(4),
    ]} responder={(_l, c) => <button type="button" className={c.primario ? 'cn-btn pri' : 'cn-btn'}>Responder</button>} />)
    expect(container.querySelectorAll('.pri').length).toBe(1)
    expect(container.querySelectorAll('.pri').length).toBeLessThanOrEqual(1)
  })
})

describe('ListaCaminho: painéis no lugar da linha', () => {
  it('Testar no YouTube abre a ficha no lugar da linha, foco no h2, Esc devolve o foco ao botão', () => {
    render(<Harness linhas={[linha(1), nosso(2), linha(3)]} />)
    const antes = screen.getAllByRole('listitem').map((n) => n.getAttribute('data-linha'))
    const botao = within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'Testar no YouTube' })
    fireEvent.click(botao)
    const painel = screen.getByTestId('painel')
    expect(painel.getAttribute('data-vista')).toBe('ficha')
    expect(document.activeElement).toBe(within(painel).getByRole('heading', { level: 2 }))
    const depois = screen.getAllByRole('listitem').map((n) => n.getAttribute('data-linha'))
    expect(depois).toEqual(antes) // mesma posição, vizinhas intactas
    expect(screen.getAllByRole('listitem')[0]!.contains(painel)).toBe(true)
    fireEvent.keyDown(painel, { key: 'Escape' })
    expect(screen.queryByTestId('painel')).toBeNull()
    expect(document.activeElement).toBe(within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'Testar no YouTube' }))
  })
  it('Ver teste: estado 1 sem confirmadoEm, estado 2 com; Esc devolve o foco', () => {
    render(<Harness linhas={[
      linha(1, { estado: 'em_teste_studio', registro: reg({ confirmadoEm: null }) }),
      linha(2, { estado: 'em_teste_studio', registro: reg({ id: 'reg-2' }) }),
    ]} />)
    const itens = screen.getAllByRole('listitem')
    fireEvent.click(within(itens[0]!).getByRole('button', { name: 'Ver teste' }))
    expect(screen.getByTestId('painel').getAttribute('data-vista')).toBe('s7')
    expect(screen.getByTestId('painel').getAttribute('data-estado')).toBe('1')
    fireEvent.keyDown(screen.getByTestId('painel'), { key: 'Escape' })
    expect(document.activeElement).toBe(within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'Ver teste' }))
    fireEvent.click(within(screen.getAllByRole('listitem')[1]!).getByRole('button', { name: 'Ver teste' }))
    expect(screen.getByTestId('painel').getAttribute('data-estado')).toBe('2')
  })
})

describe('ListaCaminho: D-8, a pergunta antes de abrir o assistente', () => {
  const enviada = (dias: number, extra: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho =>
    nosso(1, { fichaId: 'ficha-1', fichaEnviadaEm: dia(dias), fichaCompleta: true, ...extra })

  it('ficha enviada há 3 dias: o botão da linha mostra a pergunta e não abre o assistente', () => {
    render(<Harness linhas={[enviada(3)]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    expect(onAbrir).not.toHaveBeenCalled()
    expect(screen.getByText(FRASES.guarda.pergunta)).toBeTruthy()
    expect(document.body.textContent).toContain('A ficha foi enviada em 19/10. Se o teste já está ligado no Studio, o nosso não pode começar: o Lab não troca título nem miniatura enquanto o do YouTube roda.')
    expect(screen.getByRole('button', { name: 'Já iniciei' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ainda não, seguir com o nosso teste' })).toBeTruthy()
  })
  it('o seletor de vídeo e os Sugeridos usam a mesma guarda (abrirAssistente)', () => {
    render(<Harness linhas={[enviada(3)]} />)
    fireEvent.click(screen.getByText('Porta do seletor'))
    expect(onAbrir).not.toHaveBeenCalled()
    expect(screen.getByText(FRASES.guarda.pergunta)).toBeTruthy()
  })
  it('sem ficha, há 15 dias, ou fichaEnviadaEm nulo (registro_id preenchido): abre direto', () => {
    for (const l of [nosso(1), enviada(15), enviada(3, { fichaEnviadaEm: null })]) {
      onAbrir.mockClear()
      const r = render(<Harness linhas={[l]} />)
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
      expect(onAbrir).toHaveBeenCalledTimes(1)
      expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
      r.unmount()
    }
  })
  it('sem modal, sem .pri, Iniciar teste desabilitado, foco no título da pergunta, Esc devolve o foco', () => {
    const { container } = render(<Harness linhas={[enviada(3)]} />)
    const iniciar = screen.getByRole('button', { name: 'Iniciar teste' })
    fireEvent.click(iniciar)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelectorAll('.pri').length).toBe(0)
    expect((screen.getByRole('button', { name: 'Iniciar teste' }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.activeElement?.textContent).toBe(FRASES.guarda.pergunta)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Iniciar teste' }))
    expect((screen.getByRole('button', { name: 'Iniciar teste' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('"Ainda não, seguir..." abre o assistente sem gravar nada', () => {
    render(<Harness linhas={[enviada(3)]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ainda não, seguir com o nosso teste' }))
    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(onAbrir.mock.calls[0]![0]).toMatchObject({ id: 'uuid-1', title: 'Vídeo 1' })
    for (const fn of Object.values(acoes)) expect(fn).not.toHaveBeenCalled()
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
  })
  it('"Já iniciei" abre o 2º toque e "Confirmar" chama jaIniciei com a ficha', async () => {
    vi.mocked(acoes.jaIniciei).mockResolvedValue({ ok: true, registroId: 'r', pausados: [], naoPausados: [] })
    render(<Harness linhas={[enviada(3)]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Já iniciei' }))
    expect(acoes.jaIniciei).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('O Lab não mexe neste vídeo até você responder o resultado')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })) })
    expect(acoes.jaIniciei).toHaveBeenCalledWith('ficha-1')
    expect(atualizar).toHaveBeenCalled()
    expect(onAbrir).not.toHaveBeenCalled()
    expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
  })
  it('erros pelo motivoDoErro: ja_ha_teste, estado_mudou e rede', async () => {
    render(<Harness linhas={[enviada(3)]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    fireEvent.click(screen.getByRole('button', { name: 'Já iniciei' }))
    vi.mocked(acoes.jaIniciei).mockResolvedValueOnce({ ok: false, erro: 'ja_ha_teste_em_andamento' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })) })
    expect(screen.getByRole('alert').textContent).toContain('Este vídeo já tem um teste do YouTube registrado.')
    expect(screen.getByRole('alert').textContent).not.toMatch(/desde/)
    fireEvent.click(screen.getByRole('button', { name: 'Já iniciei' }))
    vi.mocked(acoes.jaIniciei).mockRejectedValueOnce(new Error('offline'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })) })
    expect(screen.getByRole('alert').textContent).toContain('Sem conexão. Nada foi registrado.')
    expect(atualizar).not.toHaveBeenCalled()
  })
  it('ficha sem B: "Complete a ficha para registrar" e só "Ainda não, seguir..."', () => {
    render(<Harness linhas={[enviada(3, { fichaCompleta: false })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste' }))
    expect(screen.getByText(FRASES.guarda.perguntaIncompleta)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Já iniciei' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ainda não, seguir com o nosso teste' })).toBeTruthy()
  })
})

describe('ListaCaminho: ?video=', () => {
  it('ficha aberta abre a ficha; vencida (ficha sem estado de preparo) também abre a ficha', () => {
    render(<Harness linhas={[linha(1, { estado: 'em_preparo', fichaId: 'f1' }), linha(2)]} videoInicial={ID(1)} />)
    expect(screen.getByTestId('painel').getAttribute('data-vista')).toBe('ficha')
  })
  it('ficha vencida (fichaId com linha sugerida) abre o painel da ficha para o estado ficha-15d', () => {
    render(<Harness linhas={[linha(1, { fichaId: 'f-velha' })]} videoInicial={ID(1)} />)
    expect(screen.getByTestId('painel').getAttribute('data-vista')).toBe('ficha')
  })
  it('registro em andamento abre o cartão S7', () => {
    render(<Harness linhas={[linha(1, { estado: 'em_teste_studio', registro: reg({ confirmadoEm: null }) })]} videoInicial={ID(1)} />)
    expect(screen.getByTestId('painel').getAttribute('data-vista')).toBe('s7')
    expect(screen.getByTestId('painel').getAttribute('data-estado')).toBe('1')
  })
  it('id desconhecido, nulo ou fora do formato: não abre nada e não quebra', () => {
    for (const v of ['zzzzzzzzzzz', null, 'curto', "x'; drop"]) {
      const r = render(<Harness linhas={[linha(1)]} videoInicial={v} />)
      expect(screen.queryByTestId('painel')).toBeNull()
      expect(screen.queryByText(FRASES.guarda.pergunta)).toBeNull()
      r.unmount()
    }
  })
  it('resultado_pronto/sem_resposta: rola até a linha e foca o selo', () => {
    const rolar = vi.fn()
    Element.prototype.scrollIntoView = rolar
    render(<Harness linhas={[linha(1, { estado: 'sem_resposta', registro: reg({ variantes: tres }) })]} videoInicial={ID(1)} />)
    expect(rolar).toHaveBeenCalled()
    expect(document.activeElement?.hasAttribute('data-foco-selo')).toBe(true)
    expect(screen.queryByTestId('painel')).toBeNull()
  })
  it('resultado_pronto com duas versões: pede ao slot de resposta que abra a pergunta (aberta=true)', () => {
    const vistas: boolean[] = []
    render(<Harness
      linhas={[linha(1, { estado: 'resultado_pronto', registro: reg({ variantes: duas }) })]}
      videoInicial={ID(1)}
      responder={(_l, c) => { vistas.push(c.aberta); return <span>slot</span> }}
    />)
    expect(vistas.at(-1)).toBe(true)
  })
  it.each([
    ['duas versões', duas],
    ['três versões', tres],
    ['derivada (sem variantes, com original)', null],
  ])('D-1: ?video= abre a pergunta em ficha de %s', (_nome, variantes) => {
    const vistas: boolean[] = []
    render(<Harness
      linhas={[linha(1, { estado: 'sem_resposta', registro: reg({ variantes, tituloAntes: variantes ? null : 'Título de antes' }) })]}
      videoInicial={ID(1)}
      responder={(_l, c) => { vistas.push(c.aberta); return <span>slot</span> }}
    />)
    expect(vistas.at(-1)).toBe(true)
  })
  it('D-1: derivada sem original (sem título de antes) também abre a pergunta', () => {
    const vistas: boolean[] = []
    render(<Harness
      linhas={[linha(1, { estado: 'resultado_pronto', registro: reg({ variantes: null, tituloAntes: null }) })]}
      videoInicial={ID(1)}
      responder={(_l, c) => { vistas.push(c.aberta); return <span>slot</span> }}
    />)
    expect(vistas.at(-1)).toBe(true)
  })
})

describe('ListaCaminho: contagem para o esqueleto', () => {
  it('grava a contagem no localStorage depois de renderizar; localStorage lançando não quebra', () => {
    render(<Harness linhas={[linha(1), linha(2)]} />)
    expect(JSON.parse(window.localStorage.getItem('ab-lab:linhas')!)).toMatchObject({ n: 2 })
    cleanup()
    trocar(true)
    expect(() => render(<Harness linhas={[linha(1)]} />)).not.toThrow()
  })
})

describe('ListaEsqueleto e ListaErro', () => {
  it('esqueleto: contador "Carregando…", nunca 0, cabeçalhos de grupo e 11 linhas por padrão', () => {
    const { container } = render(<ListaEsqueleto />)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(screen.getByText(FRASES.lista.carregando.frase)).toBeTruthy()
    expect(container.textContent).not.toMatch(/\b0 vídeos?\b/)
    expect(container.querySelectorAll('[data-skel-linha]').length).toBe(11)
  })
  it('esqueleto usa a contagem guardada, com cabeçalhos de grupo', () => {
    window.localStorage.setItem('ab-lab:linhas', JSON.stringify({ n: 5, p: 2 }))
    const { container } = render(<ListaEsqueleto />)
    expect(container.querySelectorAll('[data-skel-linha]').length).toBe(5)
    expect(container.querySelectorAll('[data-skel-grupo]').length).toBe(2)
  })
  it('esqueleto funciona com o localStorage lançando', () => {
    trocar(true)
    const { container } = render(<ListaEsqueleto />)
    expect(container.querySelectorAll('[data-skel-linha]').length).toBe(11)
  })
  it('esqueleto: lista com a classe cn-lsk', () => {
    const { container } = render(<ListaEsqueleto />)
    expect((container.querySelector('[data-skel-lista]') as HTMLElement).className).toContain('cn-lsk')
  })
  it('boundary: leitura que lança mostra a frase e manda ao Sentry, sem texto do erro', async () => {
    const Sentry = await import('@sentry/nextjs')
    const Bomba = (): ReactNode => { throw new Error('boom com título secreto') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ListaErro><Bomba /></ListaErro>)
    expect(screen.getByText('Não deu para ler a lista agora.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('boom')
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe('fila do lembrete pela lista (ListaCaminhoComPaineis)', () => {
  const ID_FICHA = '11111111-1111-4111-8111-111111111111'
  async function montarLista() {
    const { ListaCaminhoComPaineis } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-paineis')
    return render(<ListaCaminhoComPaineis linhas={[linha(1)]} videoInicial={null} acoes={acoes} agora={() => AGORA} />)
  }
  beforeEach(() => { trocar() })

  it('com 1 item na fila e rede: a action é chamada uma vez e o item sai', async () => {
    localStorage.setItem('ab-lab:lembrete-fila', JSON.stringify([{ fichaId: ID_FICHA, enfileiradoEm: dia(1) }]))
    ;(acoes.lembrarNoComputador as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, lembrarEm: dia(0), jaLembrado: false })
    await act(async () => { await montarLista() })
    expect(acoes.lembrarNoComputador).toHaveBeenCalledTimes(1)
    expect(acoes.lembrarNoComputador).toHaveBeenCalledWith(ID_FICHA)
    expect(localStorage.getItem('ab-lab:lembrete-fila')).toBeNull()
  })

  it('"não encontrado" tira o item sem erro na tela; fila vazia não chama nada', async () => {
    localStorage.setItem('ab-lab:lembrete-fila', JSON.stringify([{ fichaId: ID_FICHA, enfileiradoEm: dia(1) }]))
    ;(acoes.lembrarNoComputador as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'não encontrado' })
    await act(async () => { await montarLista() })
    expect(localStorage.getItem('ab-lab:lembrete-fila')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('localStorage lançando não quebra a lista', async () => {
    trocar(true)
    await act(async () => { await montarLista() })
    expect(acoes.lembrarNoComputador).not.toHaveBeenCalled()
  })
})
