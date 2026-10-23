'use client'
// Lista "Vídeos do A/B Lab" (F1a-tela-1, T7): o caminho do teste de cada vídeo, o que espera resposta primeiro.
// Slots que as próximas tarefas preenchem: `painel` (ficha: T8/T9; cartão S7: T10) e `responder` (dia 14 com 2 versões: T10b).
// Actions chegam por props tipadas (nenhum client importa `../actions`/`../actions-nativo`); `import type` some no build.
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import type {
  abrirFicha, lerFichaDoVideo, recomecarFicha, salvarFicha, marcarStudioAberto, enviarImagemDaFicha, lembrarNoComputador,
  jaIniciei, confirmarDetectado, naoETeste, responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube,
} from '../../actions-nativo'
import type { pauseAbTest, retryRestore } from '../../actions'
import { agruparLinhas, resumoDaLista, type LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { ContextoAssistente, videoDaLinha } from './assistente-contexto'
import { LinhaCaminho, type SlotResponder } from './linha-caminho'
import '../caminho-nativo.css'
import '../lista-caminho.css'

export type AcoesCaminho = {
  abrirFicha: typeof abrirFicha
  lerFichaDoVideo: typeof lerFichaDoVideo
  recomecarFicha: typeof recomecarFicha
  salvarFicha: typeof salvarFicha
  marcarStudioAberto: typeof marcarStudioAberto
  enviarImagemDaFicha: typeof enviarImagemDaFicha
  lembrarNoComputador: typeof lembrarNoComputador
  jaIniciei: typeof jaIniciei
  confirmarDetectado: typeof confirmarDetectado
  naoETeste: typeof naoETeste
  responderTesteDoYouTube: typeof responderTesteDoYouTube
  mudarRespostaDoTesteDoYouTube: typeof mudarRespostaDoTesteDoYouTube
  pauseAbTest: typeof pauseAbTest
  retryRestore: typeof retryRestore
}

export interface ContextoPainel {
  vista: 'ficha' | 's7'
  /** Cartão S7: 1 = visto de fora (sem `confirmadoEm`), 2 = confirmado. Nulo na ficha. */
  estadoS7: 1 | 2 | null
  fechar: () => void
}
export type SlotPainel = (l: LinhaDoCaminho, c: ContextoPainel) => ReactNode

export interface ListaCaminhoProps {
  linhas: LinhaDoCaminho[]
  /** `?video=<ytId>` já validado pelo formato; desconhecido não abre nada. */
  videoInicial: string | null
  acoes: AcoesCaminho
  painel: SlotPainel
  responder?: SlotResponder
  agora?: () => Date
}

const CHAVE_CONTAGEM = 'ab-lab:linhas'
const chaveCaminho = (ytId: string): string => `ab-lab:caminho:${ytId}`

function lerEscolhas(linhas: LinhaDoCaminho[]): Record<string, true> {
  const r: Record<string, true> = {}
  for (const l of linhas) {
    try { if (window.sessionStorage.getItem(chaveCaminho(l.ytId)) === 'nosso') r[l.ytId] = true } catch { /* storage bloqueado: segue sem a escolha */ }
  }
  return r
}

type Aberta = { videoId: string; vista: 'ficha' | 's7' } | null

/** Estados cujo "Ver teste"/"Ver as duas" abre o bloco do dia 14 na própria linha (T7). */
const RESPONDIDOS = new Set<LinhaDoCaminho['estado']>(['ficou_no_ar', 'respostas_diferentes', 'respondido_sem_vencedor'])

function abertaInicial(linhas: LinhaDoCaminho[], yt: string | null): { aberta: Aberta; achada: LinhaDoCaminho | null } {
  const achada = yt ? (linhas.find((l) => l.ytId === yt) ?? null) : null
  if (!achada) return { aberta: null, achada: null }
  if (achada.estado === 'em_teste_studio' && achada.registro) return { aberta: { videoId: achada.videoId, vista: 's7' }, achada }
  if (achada.estado === 'resultado_pronto' || achada.estado === 'sem_resposta' || achada.estado === 'ficou_no_ar'
    || achada.estado === 'respostas_diferentes' || achada.estado === 'respondido_sem_vencedor' || achada.estado === 'nosso_rodando') return { aberta: null, achada }
  // Ficha aberta (em preparo) ou vencida (a linha segue sugerida, mas `fichaId` existe): o painel decide entre ficha e `ficha-15d`.
  if (achada.fichaId) return { aberta: { videoId: achada.videoId, vista: 'ficha' }, achada }
  return { aberta: null, achada }
}

export function ListaCaminho({ linhas, videoInicial, acoes, painel, responder, agora }: ListaCaminhoProps): ReactElement {
  const ctrl = useContext(ContextoAssistente)
  const relogio = useMemo(() => agora ?? (() => new Date()), [agora])
  const inicial = useRef(abertaInicial(linhas, videoInicial))
  const [aberta, setAberta] = useState<Aberta>(inicial.current.aberta)
  const [escolhas, setEscolhas] = useState<Record<string, true>>({})
  const [responderAberto, setResponderAberto] = useState<string | null>(() => {
    const a = inicial.current.achada
    // Pelo estado da linha (dia 14), não pela contagem: ficha de 2 ou 3 versões e derivada (com ou sem original) abrem a pergunta.
    return a && (a.estado === 'resultado_pronto' || a.estado === 'sem_resposta') && a.registro ? a.videoId : null
  })
  // Bloco respondido/conflito aberto na linha (`?video=` de linha respondida já o abre); um por vez.
  const [blocoAberto, setBlocoAberto] = useState<string | null>(() => {
    const a = inicial.current.achada
    return a && RESPONDIDOS.has(a.estado) && a.registro ? a.videoId : null
  })
  const [anuncio, setAnuncio] = useState('')
  const focoAposResposta = useRef<string | null>(null)
  const raiz = useRef<HTMLElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const voltarFocoPara = useRef<{ videoId: string; acao: 'abrir' | 'iniciar' } | null>(null)

  const g = useMemo(() => agruparLinhas(linhas), [linhas])
  const resumo = useMemo(() => resumoDaLista(g), [g])
  const { registrarLinhas } = ctrl
  const primarioId = useMemo(() => g.precisaDeVoce.find((l) => (l.estado === 'resultado_pronto' || l.estado === 'sem_resposta') && l.registro)?.videoId ?? null, [g])

  useEffect(() => { registrarLinhas(linhas) }, [linhas, registrarLinhas])
  useEffect(() => { setEscolhas(lerEscolhas(linhas)) }, [linhas])
  useEffect(() => {
    try { window.localStorage.setItem(CHAVE_CONTAGEM, JSON.stringify({ n: linhas.length, p: g.precisaDeVoce.length })) } catch { /* storage bloqueado */ }
  }, [linhas.length, g.precisaDeVoce.length])

  const linhaEl = useCallback((videoId: string): HTMLElement | null =>
    raiz.current?.querySelector<HTMLElement>(`[data-linha="${CSS.escape(videoId)}"]`) ?? null, [])

  // Abertura por `?video=`: rola até a linha e foca (selo nas linhas de resposta; painel já aberto se for o caso).
  useEffect(() => {
    const a = inicial.current.achada
    if (!a) return
    const el = linhaEl(a.videoId)
    el?.scrollIntoView?.({ block: 'center' })
    if (!inicial.current.aberta && !(RESPONDIDOS.has(a.estado) && a.registro)) el?.querySelector<HTMLElement>('[data-foco-selo]')?.focus()
  }, [linhaEl])

  // `?video=` mudou com a tela já montada (sino a partir do próprio Lab, Gio F-6): abre a ficha/cartão do vídeo como na montagem.
  const videoAnterior = useRef(videoInicial)
  useEffect(() => {
    if (videoAnterior.current === videoInicial) return
    videoAnterior.current = videoInicial
    const r = abertaInicial(linhas, videoInicial)
    if (!r.achada) return
    inicial.current = r
    setAberta(r.aberta)
    const comBloco = RESPONDIDOS.has(r.achada.estado) && Boolean(r.achada.registro)
    if (comBloco) setBlocoAberto(r.achada.videoId)
    linhaEl(r.achada.videoId)?.scrollIntoView?.({ block: 'center' })
    if (!r.aberta && !comBloco) linhaEl(r.achada.videoId)?.querySelector<HTMLElement>('[data-foco-selo]')?.focus()
  }, [videoInicial, linhas, linhaEl])

  // Bloco aberto (botão ou `?video=`): o foco vai para o título do bloco.
  useEffect(() => {
    if (blocoAberto) linhaEl(blocoAberto)?.querySelector<HTMLElement>('[data-foco-bloco]')?.focus()
  }, [blocoAberto, linhaEl])
  // Depois de responder ou mudar, a linha relê e o nó que tinha o foco desmonta (o foco cairia no body): vai para o link da linha.
  useEffect(() => {
    const v = focoAposResposta.current
    if (!v) return
    const l = linhas.find((x) => x.videoId === v)
    if (!l || !RESPONDIDOS.has(l.estado)) return
    focoAposResposta.current = null
    const ativo = document.activeElement
    if (ativo && ativo !== document.body && ativo.isConnected) return
    const li = linhaEl(v)
    ;(li?.querySelector<HTMLElement>('[data-acao="mudar-resposta"]') ?? li?.querySelector<HTMLElement>('[data-foco-selo]'))?.focus()
  }, [linhas, linhaEl])

  // Foco no h2 do painel ao abrir; ao fechar, de volta ao botão que o abriu.
  useEffect(() => {
    if (aberta) {
      const h = painelRef.current?.querySelector<HTMLElement>('h2[tabindex="-1"]') ?? painelRef.current
      h?.focus()
    }
  }, [aberta])
  useEffect(() => {
    const v = voltarFocoPara.current
    if (!v || aberta || ctrl.perguntaAberta) return
    voltarFocoPara.current = null
    linhaEl(v.videoId)?.querySelector<HTMLElement>(`[data-acao="${v.acao}"]`)?.focus()
  }, [aberta, ctrl.perguntaAberta, linhaEl])
  // Pergunta aberta por outra porta (seletor, Sugeridos): leva a linha à vista.
  useEffect(() => {
    if (ctrl.perguntaAberta) linhaEl(ctrl.perguntaAberta)?.scrollIntoView?.({ block: 'nearest' })
  }, [ctrl.perguntaAberta, linhaEl])

  function preferir(l: LinhaDoCaminho, nosso: boolean): void {
    try {
      if (nosso) window.sessionStorage.setItem(chaveCaminho(l.ytId), 'nosso')
      else window.sessionStorage.removeItem(chaveCaminho(l.ytId))
    } catch { /* storage bloqueado: vale só nesta tela */ }
    setEscolhas((e) => {
      const n = { ...e }
      if (nosso) n[l.ytId] = true
      else delete n[l.ytId]
      return n
    })
  }

  function fecharPainel(): void {
    if (aberta) voltarFocoPara.current = { videoId: aberta.videoId, acao: 'abrir' }
    setAberta(null)
  }
  function teclasDoPainel(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    fecharPainel()
  }
  function fecharPergunta(): void {
    if (ctrl.perguntaAberta) voltarFocoPara.current = { videoId: ctrl.perguntaAberta, acao: 'iniciar' }
    ctrl.fecharPergunta()
  }

  const agoraData = relogio()
  const linhaProps = (l: LinhaDoCaminho): Parameters<typeof LinhaCaminho>[0] => ({
    l, agora: agoraData, escolhaNosso: escolhas[l.ytId] === true,
    aoPreferir: preferir,
    aoAbrirPainel: (x, vista) => setAberta({ videoId: x.videoId, vista }),
    aoIniciar: (x) => ctrl.abrirAssistente(videoDaLinha(x)),
    perguntaAberta: ctrl.perguntaAberta === l.videoId,
    aoSeguirComNosso: ctrl.seguirComNosso,
    aoFecharPergunta: fecharPergunta,
    // Registro gravado: a pergunta fecha e a linha relê (passa a "Em teste no Studio").
    aoAtualizar: ctrl.atualizar,
    aoRegistrar: () => { ctrl.fecharPergunta(); ctrl.atualizar() },
    jaIniciei: acoes.jaIniciei,
    responder, responderDia14: acoes.responderTesteDoYouTube, responderAberta: responderAberto === l.videoId, responderPrimario: l.videoId === primarioId,
    aoMudarResponder: (ab) => setResponderAberto(ab ? l.videoId : null),
    mudarDia14: acoes.mudarRespostaDoTesteDoYouTube,
    blocoAberto: blocoAberto === l.videoId,
    aoMudarBloco: (ab) => setBlocoAberto(ab ? l.videoId : null),
    // 1ª resposta gravada: a linha relê e já abre o bloco respondido.
    aoRespondeu: () => { focoAposResposta.current = l.videoId; setBlocoAberto(l.videoId); ctrl.atualizar() },
    // Zera antes: o mesmo texto de novo (B->C, C->B, B->C) ainda é lido.
    aoAnunciar: (t) => { focoAposResposta.current = l.videoId; setAnuncio(''); requestAnimationFrame(() => setAnuncio(t)) },
  })

  const renderLinha = (l: LinhaDoCaminho): ReactElement => {
    if (aberta?.videoId === l.videoId) {
      const s7 = aberta.vista === 's7'
      return (
        <li key={l.videoId} className="cn-vrow aberta" data-linha={l.videoId} data-yt={l.ytId} data-estado={l.estado}>
          <div className="cn-painel" ref={painelRef} onKeyDown={teclasDoPainel}>
            {painel(l, { vista: aberta.vista, estadoS7: s7 ? (l.registro?.confirmadoEm ? 2 : 1) : null, fechar: fecharPainel })}
          </div>
        </li>
      )
    }
    return <LinhaCaminho key={l.videoId} {...linhaProps(l)} />
  }

  const total = linhas.length
  const haEscolha = Object.keys(escolhas).length > 0

  return (
    <section className="cn-raiz" aria-label="Vídeos do A/B Lab" ref={raiz}>
      <p className="cn-sum">
        {resumo.frase}
        {resumo.apoio ? <small>{resumo.apoio}</small> : null}
      </p>
      {haEscolha ? <p className="cn-meta" role="status">{FRASES.lista.caminhoTrocado.frase}</p> : null}
      <p className="cn-sr" role="status" data-testid="anuncio-dia-14">{anuncio}</p>
      <div className="cn-lista">
        <div className="cn-lhd">
          <span>{total === 1 ? '1 vídeo' : `${total} vídeos`}</span>
          <span>{g.precisaDeVoce.length > 0 ? 'Primeiro o que espera resposta, depois os mais recentes' : 'Ordem: mais recentes'}</span>
        </div>
        {g.precisaDeVoce.length > 0 ? (
          <>
            <div className="cn-grp-h" data-testid="grupo"><span>Precisa de você</span><span>{contagem(g.precisaDeVoce.length)}</span></div>
            <ul className="cn-grupo" aria-label="Precisa de você" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{g.precisaDeVoce.map(renderLinha)}</ul>
            <div className="cn-grp-h" data-testid="grupo"><span>Outros vídeos</span><span>{contagem(g.outros.length)}</span></div>
          </>
        ) : null}
        <ul className="cn-grupo" aria-label="Outros vídeos" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{g.outros.map(renderLinha)}</ul>
        <p className="cn-rodape">{FRASES.lista.rodape}</p>
      </div>
    </section>
  )
}

const contagem = (n: number): string => (n === 1 ? '1 vídeo' : `${n} vídeos`)
