'use client'
/**
 * A página do canal próprio (spec 16): o cabeçalho, a seção "Como o canal está" (encaixada por quem monta a página, acima das abas), as abas
 * Vídeos / Trocas / Leitura / Retenção e a aba Vídeos (a MESMA do concorrente: controles, Capas ou Lista, "Carregar mais"; as colunas de
 * alcance vêm do dado). Trocas, Leitura e Retenção dizem, em frase, o que ainda não existe. Tudo troca no navegador (o servidor já mandou
 * o pacote inteiro); o estado nasce da URL e o hook o relê COMO canal próprio (`sort=imp` e `tab=retencao` não voltam ao padrão).
 * Recebe só o que o modelo montou: no estado `negado` nenhum número privado está nas props, e o token de edição não chega aqui.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { link, type CanalTab } from '@/lib/youtube/observatorio/links'
import { AbaVideos, porId } from '../_canal/canal-screen'
import { montarLista } from '../_canal/lista'
import { LOTE, parseCanalState, type CanalState } from '../_canal/params'
import { useCanalState } from '../_canal/use-canal-state'
import { aposRestaurar, pararRestauracao, useRolagemAoVoltar } from '../_canal/use-rolagem-ao-voltar'
import { precisaTrazer } from '../_canal/cartao-a-vista'
import type { ChannelVideoView } from '../_canal/videos-model'
import { SEM_VIDEOS_FRASE } from '../_chrome/own-channels'
import { descartarGatilhoSeNaoVoltou, lerGatilho } from '../_chrome/gatilho-volta'
import { useThumbViewer } from '../_chrome/thumb-viewer/thumb-viewer'
import { viewerSoAtual } from '../_chrome/thumb-viewer/thumb-viewer-versions'
import { chegouPelaTrilha, esquecerUltimoVideo, lerUltimoVideo } from '../_chrome/ultimo-video'
import { ProprioHeader } from './proprio-header'
import type { ProprioView } from './view-model'
import '../_canal/canal.css'
import './proprio.css'

/** A aba que não tem conteúdo ainda: o título, a frase do spec 16.4 e a nota. Sem botão, sem número. */
function AbaSemConteudo({ id, titulo, frase, nota }: { id: string; titulo: string; frase: string; nota: string }) {
  return (
    <section aria-labelledby={id} className="ct-sec">
      <h2 id={id} className="ct-h2" tabIndex={-1}>{titulo}</h2>
      <div className="cv-empty"><p>{frase}</p><p className="m">{nota}</p></div>
    </section>
  )
}

/**
 * Canal próprio sem vídeos (D10, spec 16.8): não tem página. A moldura diz isso, com a frase do plano e o caminho de volta (o atalho "Meu canal" já está
 * na trilha). Status 200; nada do dado privado foi lido para chegar aqui.
 */
export function ProprioSemVideos({ nome, canaisHref }: { nome: string; canaisHref: string }) {
  return (
    <div data-obs-screen="canal" data-own="1">
      <div className="cv-empty">
        <p><b>{nome}</b></p>
        <p>{SEM_VIDEOS_FRASE}</p>
        <Link className="obs-ch-btn" href={canaisHref}>Voltar para Canais</Link>
      </div>
    </div>
  )
}

const TITULOS: Record<Exclude<CanalTab, 'videos'>, string> = { trocas: 'Trocas', leitura: 'Leitura', retencao: 'Retenção' }

/** Ordem e nome das abas do canal próprio (spec 16.4). A contagem só na de Vídeos. */
function Abas({ view, state, resumo, onAba }: { view: ProprioView; state: CanalState; resumo: string | null; onAba: (tab: CanalTab) => void }) {
  const abas: Array<{ tab: CanalTab; texto: string; n: string }> = [
    { tab: 'videos', texto: 'Vídeos', n: String(view.videos.videos.length) },
    { tab: 'trocas', texto: 'Trocas', n: '' },
    { tab: 'leitura', texto: 'Leitura', n: '' },
    { tab: 'retencao', texto: 'Retenção', n: '' },
  ]
  return (
    <nav className="ctabs" aria-label="Seções do canal">
      <ul>
        {abas.map(a => {
          const href = link.canal(view.header.id, { tab: a.tab, fmt: state.fmt, sort: state.sort, dir: state.dir, q: state.q, ver: state.ver, n: state.n, nums: state.nums ? 1 : undefined })
          return (
            <li key={a.tab}>
              <a href={href} aria-current={state.tab === a.tab ? 'page' : undefined}
                onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); onAba(a.tab) }}>
                {a.texto}{a.n ? <> <span className="n">{a.n}</span></> : null}
              </a>
            </li>
          )
        })}
      </ul>
      {resumo ? <p className="res">{resumo}</p> : null}
    </nav>
  )
}

export function ProprioScreen({ view, comoEsta }: { view: ProprioView; comoEsta?: ReactNode; children?: never }) {
  const h = view.header
  const [state, set] = useCanalState(view.state, true)
  const raiz = useRef<HTMLDivElement>(null)
  const todos = view.videos.videos

  const aba = useRef<CanalTab>(state.tab)
  useLayoutEffect(() => { aba.current = state.tab })
  const { open: abrirViewer, node: viewerNode } = useThumbViewer({
    fallback: () => porId(raiz, aba.current === 'videos' ? 'cv-h2' : 'pr-h2'),
  })
  const ampliarVideo = useCallback((v: ChannelVideoView, trigger: HTMLElement | null) => { const vw = v.viewer ?? viewerSoAtual(v); if (vw) abrirViewer(vw, trigger) }, [abrirViewer])

  /* O Voltar da comparação e do Histórico (spec 3): o foco volta ao botão "Comparar com…" ou ao cartão do ÚLTIMO vídeo visto, e `n` cresce até incluí-lo. */
  const focoNoUltimo = useRef<{ id: string; n: number; ate: number } | null>(null)
  const focarUltimo = (id: string): void => {
    const el = porId(raiz, 'cv-lnk-' + id)
    if (!el) return
    el.focus({ preventScroll: true })
    aposRestaurar(() => {
      const caixa = el.closest('main')?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
      const r2 = el.getBoundingClientRect()
      if (!precisaTrazer({ top: r2.top, bottom: r2.bottom }, caixa)) return
      pararRestauracao()
      el.scrollIntoView?.({ block: 'nearest' })
      el.focus({ preventScroll: true })
    })
  }
  const aoVoltar = () => {
    if (lerGatilho('canal') === h.id) {
      const botao = raiz.current?.querySelector<HTMLElement>('[data-comparar-canal]')
      if (botao) { botao.focus({ preventScroll: true }); return }
    }
    const reg = lerUltimoVideo(h.id)
    if (!reg) return
    esquecerUltimoVideo(h.id)
    const atual = parseCanalState(Object.fromEntries(new URLSearchParams(window.location.search)), { own: true })
    if (atual.tab !== 'videos') return
    let n = atual.n
    while (n <= todos.length + LOTE && !montarLista(todos, { ...atual, n }).visiveis.includes(reg.id)) n += LOTE
    if (n > todos.length + LOTE) return
    if (n === atual.n) { focarUltimo(reg.id); return }
    focoNoUltimo.current = { id: reg.id, n, ate: Date.now() + 5000 }
    set({ n })
  }
  useRolagemAoVoltar(raiz, aoVoltar, () => chegouPelaTrilha(h.id))
  useEffect(() => { const t = window.setTimeout(() => descartarGatilhoSeNaoVoltou('canal'), 0); return () => window.clearTimeout(t) }, [])
  useLayoutEffect(() => {
    const alvo = focoNoUltimo.current
    if (!alvo) return
    if (Date.now() > alvo.ate) { focoNoUltimo.current = null; return }
    if (state.tab !== 'videos' || state.n < alvo.n) return
    focoNoUltimo.current = null
    focarUltimo(alvo.id)
  })

  const lista = useMemo(() => montarLista(todos, state), [todos, state.fmt, state.sort, state.dir, state.q, state.n])   // eslint-disable-line react-hooks/exhaustive-deps
  // à direita das abas, na aba Vídeos: a frase das views por dia de cada vídeo (UMA vez, D12 c); com busca, o resultado dela
  const resumo = state.tab !== 'videos' || !todos.length ? null : state.q.trim() ? (lista.vazio ? null : lista.resultado) : view.videos.semViewsDiarias

  /* trocar de aba move o foco para o título da aba nova; o Voltar do navegador (popstate) não mexe no foco */
  const focoNaAba = useRef(false)
  const setAba = useCallback((patch: Partial<CanalState>) => {
    if (patch.tab && patch.tab !== state.tab) focoNaAba.current = true
    set(patch)
  }, [set, state.tab])
  const irParaAba = (tab: CanalTab) => {
    if (tab === state.tab) { porId(raiz, tab === 'videos' ? 'cv-h2' : 'pr-h2')?.focus({ preventScroll: true }); return }
    setAba({ tab, video: null })
  }
  const abaAnterior = useRef(state.tab)
  useLayoutEffect(() => {
    const mudou = abaAnterior.current !== state.tab
    abaAnterior.current = state.tab
    const titulo = porId(raiz, state.tab === 'videos' ? 'cv-h2' : 'pr-h2')
    if (focoNaAba.current) { focoNaAba.current = false; titulo?.focus({ preventScroll: true }) }
    if (!mudou) return
    const reduzir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    titulo?.scrollIntoView?.({ block: 'start', behavior: reduzir ? 'auto' : 'smooth' })
  }, [state.tab])

  return (
    <div data-obs-screen="canal" data-own="1" ref={raiz}>
      <ProprioHeader h={h} nums={state.nums} onToggleNums={() => set({ nums: !state.nums })} compararHref={view.compararHref} compararTitulo={view.compararTitulo} />
      {comoEsta ?? null}
      <Abas view={view} state={state} resumo={resumo} onAba={irParaAba} />
      <AbaVideos videos={view.videos} state={state} lista={lista} set={setAba} nome={h.name} channelId={h.id} onAmpliar={ampliarVideo} raiz={raiz} proprio />
      {state.tab !== 'videos' ? (
        <AbaSemConteudo id="pr-h2" titulo={TITULOS[state.tab]} frase={view.abas[state.tab]} nota={view.abasNota[state.tab]} />
      ) : null}
      {viewerNode}
    </div>
  )
}
