'use client'
/**
 * A2, Tarefa 8: o cartão "Leitura da forja" do Histórico do vídeo e o botão do cabeçalho (spec 6.5, 7.1, 7.2, 7.4). O modelo (`forja-card-model.ts`) já decidiu a
 * situação, as frases e as etapas; aqui só se desenha e se atende o clique. A "forja" é uma máquina do dono que escreve leituras a pedido: o site enfileira o
 * pedido e mostra o estado que o SERVIDOR devolve. Nenhuma etapa nasce de estado local ("Pedindo…" e o motivo da recusa são do botão, não do cartão).
 *
 * Os dois botões de pedir (cabeçalho e cartão) são o mesmo pedido: `usePedidoForja` guarda um só voo, um só "Pedindo…" e um só motivo de recusa, e mora na tela
 * (que o Next 16 não remonta no `router.refresh()` nem quando só a query muda). As ações chegam por props; nada do servidor é importado aqui.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from 'react'
import { Popover } from '../_chrome/flut/flut'
import { useToast } from '../_chrome/toasts'
import { DOUBLE_CLICK_MS, rolavel } from '../_canal/use-rolagem-ao-voltar'
import type { ForjaAsk, ForjaCancel, ForjaView } from '../_chrome/forja-view-model'
import { PODE_SAIR, type EtapaView, type ForjaCardView, type HeaderAskView, type LeituraView } from './forja-card-model'
import './forja-card.css'

const FORJA = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 15h11l3-5H7zM9 15v4M14 15v4M6 19h11" /></svg>
const FORJA12 = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 15h11l3-5H7zM9 15v4M14 15v4M6 19h11" /></svg>
const ico = (name: string, d: ReactNode) => <svg className="obs-fj-ico" data-ico={name} viewBox="0 0 16 16" aria-hidden="true">{d}</svg>
const IC = {
  clock: ico('clock', <><circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.4" /></>),
  clockw: ico('clockw', <><circle cx="8" cy="7.2" r="5.2" /><path d="M8 4.4v3l2 1.2M8 13.6v.2" /></>),
  ok: ico('ok', <><circle cx="8" cy="8" r="6" /><path d="M5.2 8.2l1.9 1.9 3.7-3.9" /></>),
  warn: ico('warn', <path d="M8 2.2l6.2 11H1.8zM8 6.5v3.2M8 11.6v.2" />),
  stale: ico('stale', <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5.2h-2.7M8 5.2V8l1.8 1.2" />),
}
const INFO = <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.1v.2" /></svg>
const CHK = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 8.3l2.4 2.4 5.2-5.4" /></svg>
const XIS = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5l6 6M11 5l-6 6" /></svg>

const QUEUE_DOWN = 'A fila da forja não respondeu. Tente de novo em alguns minutos.'
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const endDot = (t: string) => { const s = t.trim(); return /[.!?…]$/.test(s) ? s : s + '.' }
/** O motivo que o servidor deu, como frase de tela. */
const frasePedido = (r: string) => endDot(cap(r))
/** Folga entre o topo do contêiner que rola e o cartão, em px. */
const FOLGA = 16

const reduzido = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Rola até o cartão e põe o foco no título dele. A casca do CMS rola dentro de `main`, não na janela: o contêiner é o ancestral que rola (o mesmo da volta ao
 * canal). O cartão é achado pela `ref` da tela, nunca pelo documento (depois de um Voltar o Next mantém a árvore antiga escondida). Devolve false sem cartão.
 */
function rolarAte(el: HTMLElement): void {
  const box = rolavel(el)
  const janela = box === document.scrollingElement || box === document.documentElement
  const topo = Math.max(0, el.getBoundingClientRect().top - (janela ? 0 : box.getBoundingClientRect().top) + box.scrollTop - FOLGA)
  const behavior: ScrollBehavior = reduzido() ? 'auto' : 'smooth'
  if (typeof box.scrollTo === 'function') box.scrollTo({ top: topo, behavior })
  else box.scrollTop = topo
}
export function irAoCartao(cartao: RefObject<HTMLElement | null>): boolean {
  const el = cartao.current
  if (!el) return false
  rolarAte(el)
  el.querySelector<HTMLElement>('[data-fj-titulo]')?.focus({ preventScroll: true })
  return true
}

/**
 * O clique do cabeçalho: a AÇÃO sai na hora, mas a rolagem e o foco no título esperam a janela do duplo clique (como o clique na miniatura da raia): rolar já no
 * primeiro clique tirava o botão de baixo do cursor e o segundo clique caía em outro controle. O segundo clique reagenda a espera (uma rolagem só); teclado
 * (`detail === 0`) não espera; outro vídeo, ou a saída da tela, cancela a que estava marcada.
 */
export function useIrAoCartao(cartao: RefObject<HTMLElement | null>, videoId: string | undefined): (detail: number) => void {
  const timer = useRef<number | null>(null)
  const cancelar = useCallback(() => { if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null } }, [])
  useEffect(() => cancelar, [cancelar])
  useEffect(() => { cancelar() }, [videoId, cancelar])
  return useCallback((detail: number) => {
    cancelar()
    if (!detail) { irAoCartao(cartao); return }
    timer.current = window.setTimeout(() => { timer.current = null; irAoCartao(cartao) }, DOUBLE_CLICK_MS)
  }, [cartao, cancelar])
}

/* ------------------------------------------------------------------ o pedido (um só para os dois botões) */
export interface PedidoForja {
  /** O servidor ainda está respondendo, ou a tela nova ainda não chegou depois do aceite. */
  busy: boolean
  /** O motivo da última recusa (ou da falha da ação); null = nenhum. */
  recusa: string | null
  /** Envia o pedido do vídeo da tela: um só por vez. Devolve se o servidor aceitou. */
  pedir: () => Promise<boolean>
}
/**
 * O pedido de leitura do vídeo. O voo é uma `ref` (o estado só muda depois do render, e dois cliques cabem antes dele); "Pedindo…" dura até a tela nova chegar
 * (`useTransition` + `router.refresh()`); o motivo da recusa sobrevive ao refresh e zera quando o vídeo muda (o Next não remonta a tela nesse caso).
 */
export function usePedidoForja({ forja, onAsk, videoId, situacao = null }: { forja: ForjaView | null; onAsk?: ForjaAsk; videoId: string | undefined; situacao?: ForjaCardView['situacao'] }): PedidoForja {
  const router = useRouter(), toast = useToast()
  const [asking, setAsking] = useState(false)
  const [recusa, setRecusa] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const voo = useRef(false)
  const vivo = useRef({ forja, onAsk, videoId })
  useLayoutEffect(() => { vivo.current = { forja, onAsk, videoId } })
  // outro vídeo: um pedido que ainda não voltou deixa de valer para esta tela (a resposta dele é descartada abaixo)
  useEffect(() => { voo.current = false; setAsking(false) }, [videoId])
  // o motivo da recusa vale para o pedido em que veio: outro vídeo, ou uma situação nova (a leitura chegou por outro caminho), zera
  useEffect(() => { setRecusa(null) }, [videoId, situacao])
  const pedir = useCallback(async (): Promise<boolean> => {
    const { forja: f, onAsk: ask } = vivo.current
    if (voo.current || !ask || !f || !f.videoId) return false
    voo.current = true
    const de = f.videoId
    setAsking(true); setRecusa(null)
    let r: Awaited<ReturnType<ForjaAsk>>
    try { r = await ask('leitura-video', f.niche, de) } catch { r = { ok: false, reason: QUEUE_DOWN, results: [] } }
    if (r.ok) toast('forja', 'Pedido enviado à forja', '')
    if (vivo.current.videoId !== de) return r.ok   // a tela já é de outro vídeo: nada do que voltou pertence a ela
    voo.current = false; setAsking(false)
    if (!r.ok) { setRecusa(r.reason ?? 'não foi possível pedir agora'); return false }
    start(() => { router.refresh() })
    return true
  }, [router, toast])
  return { busy: asking || pending, recusa, pedir }
}

/** A mensagem de bloqueio: o título do outro vídeo vira o link para o histórico dele (spec 2.6). */
function Bloqueado({ b }: { b: NonNullable<ForjaCardView['bloqueado']> }) {
  const q = '“' + b.title + '”', i = b.text.indexOf(q)
  if (i < 0) return <>{b.text} <Link className="inl" href={b.href}>{b.title}</Link></>
  return <>{b.text.slice(0, i)}“<Link className="inl" href={b.href} data-go="">{b.title}</Link>”{b.text.slice(i + q.length)}</>
}

/* ------------------------------------------------------------------ o botão do cabeçalho */
export function HeaderAskButton({ ask, pedido, cardRef, say, bloqueado, videoId }: {
  ask: HeaderAskView; pedido: PedidoForja; cardRef: RefObject<HTMLElement | null>
  /** O status da tela (`role="status"`): lê o aviso ao rolar e o motivo da recusa. */
  say: (t: string) => void
  /** O outro vídeo do nicho que tem o pedido; a tela só o passa quando o botão está apagado POR ISSO (`botao.por === 'bloqueado'`): o link não depende de igualdade de frase. */
  bloqueado: ForjaCardView['bloqueado']
  videoId?: string
}) {
  const ocupado = pedido.busy && ask.modo === 'pedir'
  const recusa = pedido.recusa != null ? frasePedido(pedido.recusa) : null
  const irAo = useIrAoCartao(cardRef, videoId)
  useEffect(() => { if (recusa) say(recusa) }, [recusa, say])
  const clicar = (e: ReactMouseEvent) => {
    if (ask.modo === 'apagado') return
    irAo(e.detail)                                             // a rolagem e o foco esperam o duplo clique; o pedido abaixo não espera
    if (ask.modo === 'so-rola') { if (ask.aviso) say(ask.aviso); return }
    if (ocupado) return                                        // "Pedindo…" (a ação respondeu e a tela nova ainda não chegou): o clique só rola
    void pedido.pedir()                                        // um voo só: o segundo clique do duplo não envia outro
  }
  const nota: ReactNode = recusa ?? (ask.modo === 'apagado' && bloqueado ? <Bloqueado b={bloqueado} /> : ask.frase)
  return (
    <>
      <button className="btn forja-solid" type="button" id="askForja" aria-disabled={ask.modo === 'apagado' || undefined} aria-busy={ocupado || undefined}
        aria-describedby={nota ? 'askStatus' : undefined} onClick={clicar}
        // um segundo clique seguido (duplo clique) não pode roubar do título do cartão o foco que a rolagem acabou de pôr lá
        onMouseDown={e => { if (ocupado) e.preventDefault() }}>
        {ocupado ? <span className="obs-fj-pulso" aria-hidden="true" /> : FORJA}{ocupado ? 'Pedindo…' : ask.label}
      </button>
      {nota ? <span className="fstatus" id="askStatus">{nota}</span> : null}
    </>
  )
}

/* ------------------------------------------------------------------ o cartão */
const CLASSE_ETAPA: Record<EtapaView['estado'], string> = { feita: 'done', atual: 'now', atrasada: 'late', parou: 'fail', futura: 'todo' }
const CLASSE_FAIXA: Record<NonNullable<ForjaCardView['situacao']>, { k: 'wait' | 'late' | 'ok' | 'bad'; ic: ReactNode }> = {
  aguardando: { k: 'wait', ic: IC.clock }, atrasado: { k: 'late', ic: IC.clockw }, pronta: { k: 'ok', ic: IC.ok },
  desatualizada: { k: 'late', ic: IC.stale }, 'precisa-de-voce': { k: 'bad', ic: IC.warn }, 'nao-deu': { k: 'bad', ic: IC.warn },
}

function Etapas({ etapas }: { etapas: EtapaView[] }) {
  return (
    <ol className="obs-fj-steps" aria-label="Etapas do pedido">
      {etapas.map(e => {
        const sub = e.estado === 'feita' ? 'concluída' : e.texto
        return (
          <li key={e.id} className={'obs-fj-' + CLASSE_ETAPA[e.estado]} aria-current={e.estado === 'atual' || e.estado === 'atrasada' ? 'step' : undefined}>
            <span className="obs-fj-dot" aria-hidden="true">{e.estado === 'feita' ? CHK : e.estado === 'parou' ? XIS : null}</span>
            <span className="obs-fj-sn">{e.label}</span>
            {sub ? <span className="obs-fj-ss">{sub}</span> : <span className="sr">, a seguir</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** A situação só é anunciada quando muda (ou quando o pedido passa de etapa): a hora do pedido e o "há N min" mudam sem anúncio. */
function useAnuncio(card: ForjaCardView): string {
  const etapa = card.etapas?.find(e => e.estado !== 'feita' && e.estado !== 'futura')?.id ?? ''
  const chave = (card.situacao ?? '') + '|' + etapa
  const [txt, setTxt] = useState('')
  const ant = useRef(chave)
  useEffect(() => {
    if (ant.current === chave) return
    ant.current = chave
    setTxt(card.frase ?? '')
  }, [chave, card.frase])
  return txt
}

/** O relógio da linha "Tela atualizada há N min": é texto, e anda sozinho. */
function useAgora(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ligado) return
    setAgora(Date.now())
    const t = setInterval(() => setAgora(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [ligado])
  return agora
}

function LeituraBloco({ l, aninhada = false }: { l: LeituraView; aninhada?: boolean }) {
  const [info, setInfo] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pid = useId()
  const refs = l.itens.flatMap(i => i.refs)
  return (
    <div className="obs-fj-leitura" data-reading={l.id}>
      <div className="obs-fj-row">
        <span className="obs-fj-stamp">{FORJA12}{l.selo}</span>
        <button ref={btn} type="button" className="obs-fj-i" aria-expanded={info} aria-controls={pid} aria-label="Sobre o selo em treino" onClick={() => setInfo(o => !o)}>{INFO}</button>
        {l.rotulo && !aninhada ? <span className="obs-fj-rotulo">{l.rotulo}</span> : null}
      </div>
      <Popover open={info} anchor={() => btn.current} onClose={() => setInfo(false)} id={pid} role="dialog" label="Sobre o selo em treino" className="obs-fj-pop" pref="baixo" align="inicio" maxW={340}>{l.seloInfo}</Popover>
      {l.leu ? <p className="obs-fj-leu">{l.leu}</p> : null}
      <div className="obs-fj-texto" lang="pt-BR">
        {l.lead ? <p className="obs-fj-lead">{l.lead}</p> : null}
        {l.itens.length ? (
          <ul className="obs-fj-itens">
            {l.itens.map((it, i) => (
              <li key={i}>{it.texto}{it.refs.map(r => <Link key={r.n} className="obs-fj-fn" href={r.href} aria-label={'Evidência ' + r.n + ': ' + r.label}><sup>{r.n}</sup></Link>)}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {refs.length ? (
        <div className="obs-fj-evid">
          <h4>Evidências</h4>
          <ol>{refs.map(r => <li key={r.n} value={r.n}><Link href={r.href}>{r.label}</Link></li>)}</ol>
        </div>
      ) : null}
      {l.doSite.length ? (
        <div className="obs-fj-site">
          <p><b>Do site:</b> {l.doSite[0]}</p>
          {l.doSite.slice(1).map((t, i) => <p key={i}>{t}</p>)}
        </div>
      ) : null}
    </div>
  )
}

export interface AtualizacaoForja { paused: boolean; onTogglePause: () => void; lastAt: number }

export function ForjaCard({ card, forja, pedido, onCancel, onSyncChannel, refresh, cardRef, say }: {
  card: ForjaCardView; forja: ForjaView; pedido: PedidoForja
  onCancel?: ForjaCancel; onSyncChannel?: (channelRowId: string) => Promise<{ ok: boolean }>
  refresh: AtualizacaoForja; cardRef: RefObject<HTMLElement | null>
  say: (t: string) => void
}) {
  const router = useRouter(), toast = useToast()
  const tid = useId(), oq = useId(), nid = useId(), fid = useId()
  const [ajuda, setAjuda] = useState<boolean | null>(null)
  const aberta = ajuda ?? card.explicacao.aberta
  const [cancelando, setCancelando] = useState(false)
  const cancelVoo = useRef(false)
  const [sync, setSync] = useState<'parado' | 'ocupado' | 'ok' | 'falhou'>('parado')
  const syncVoo = useRef(false)
  // "Canal sincronizado…" é do momento em que a pessoa sincronizou: quando a situação muda (ela pediu, a leitura chegou) deixa de valer
  useEffect(() => { setSync(s => (s === 'ocupado' ? s : 'parado')) }, [card.situacao])
  // O foco nunca se perde: se o elemento que o tinha (Cancelar pedido, Pausar, o botão de pedir) some numa atualização, ele vai para o título do cartão;
  // quem está em outro lugar da tela não é tocado (só vale quando o foco caiu no corpo da página porque o elemento saiu).
  const focado = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const antes = focado.current
    if (!antes || antes.isConnected) return
    // o elemento saiu: o registro dele morre aqui, com o foco no corpo ou já em outro lugar (um registro velho puxaria o foco num refresh posterior)
    focado.current = null
    const ativo = document.activeElement
    if (ativo && ativo !== document.body) return
    cardRef.current?.querySelector<HTMLElement>('[data-fj-titulo]')?.focus({ preventScroll: true })
  })
  const anuncio = useAnuncio(card)
  const ativo = card.andamento != null
  const agora = useAgora(ativo)

  const cancelar = async () => {
    if (!onCancel || !forja.videoId || forja.niche === 'todos' || cancelVoo.current) return
    cancelVoo.current = true; setCancelando(true)
    const r = await onCancel('leitura-video', forja.niche, forja.videoId).catch(() => ({ ok: false, reason: 'A fila da forja não respondeu.' }))
    cancelVoo.current = false; setCancelando(false)
    if (r.ok) toast('forja', 'Pedido cancelado', '')
    else toast('warn', 'Não deu para cancelar', frasePedido(r.reason ?? ''))
    router.refresh()
  }
  // "Ver as trocas no gráfico": o gráfico é desta tela (`href` é o âncora `#hv-tlh`), achado pela raiz dela, nunca pelo documento
  const verRaias = (ancora: string) => {
    const titulo = cardRef.current?.closest('[data-obs-screen]')?.querySelector<HTMLElement>(ancora)
    const alvo = titulo?.closest<HTMLElement>('section') ?? titulo
    if (alvo) rolarAte(alvo)
  }
  const sincronizar = async () => {
    if (!onSyncChannel || syncVoo.current) return
    syncVoo.current = true; setSync('ocupado')
    let ok = false
    try { ok = (await onSyncChannel(card.canalId)).ok } catch { ok = false }
    syncVoo.current = false; setSync(ok ? 'ok' : 'falhou')
    router.refresh()
  }
  const pausar = () => { say(refresh.paused ? 'Atualização automática retomada.' : 'Atualização automática pausada.'); refresh.onTogglePause() }

  const faixa = card.situacao ? CLASSE_FAIXA[card.situacao] : null
  const b = card.botao
  const recusa = pedido.recusa != null ? frasePedido(pedido.recusa) : null
  const nota: ReactNode = recusa ?? (b.motivo != null ? (b.por === 'bloqueado' && card.bloqueado ? <Bloqueado b={card.bloqueado} /> : b.motivo) : card.vazio)
  // "Tela atualizada há N min" fica no meio da frase do modelo: ela é do navegador, o modelo não a conhece
  const quando = ativo ? Math.max(0, Math.floor((agora - refresh.lastAt) / 6e4)) : 0
  const andamento = card.andamento != null
    ? (card.andamento.endsWith(' ' + PODE_SAIR) ? card.andamento.slice(0, -PODE_SAIR.length - 1) : card.andamento) + ' Tela atualizada ' + (quando < 1 ? 'agora' : 'há ' + quando + ' min') + (refresh.paused ? ' (atualização pausada)' : '') + '. ' + PODE_SAIR
    : null
  // o motivo do botão apagado fecha a frase da situação no modelo ("…falhou às 21:00. Já há uma leitura…"): aparece UMA vez, sob o botão
  const sufixo = b.visivel && recusa == null && b.motivo != null && b.por !== 'sincronizar' ? ' ' + b.motivo : null
  const frase = card.frase != null && sufixo != null && card.frase.endsWith(sufixo) ? card.frase.slice(0, -sufixo.length) : card.frase
  const mostraAvisos = !b.visivel && (card.excluido != null || card.bloqueado != null)

  return (
    <section ref={cardRef} className="card obs-fj" role="region" aria-labelledby={tid} data-forja-anchor="" data-situacao={card.situacao ?? ''}
      onFocus={e => { const el = e.target as HTMLElement; if (e.currentTarget.contains(el)) focado.current = el }}
      // sair do botão por vontade da pessoa (clicar no corpo da página) limpa o registro; um botão que SAI da página também dispara isto, mas já desligado, e aí o registro serve
      onBlur={e => { const el = e.target as HTMLElement; queueMicrotask(() => { if (el.isConnected && focado.current === el) focado.current = null }) }}>
      <div className="obs-fj-top">
        <h3 id={tid} tabIndex={-1} data-fj-titulo="">Leitura da forja{ativo ? <>{' '}<span className="obs-fj-run">em andamento</span></> : null}</h3>
        <button type="button" className="obs-fj-lk" aria-expanded={aberta} aria-controls={oq} onClick={() => setAjuda(!aberta)}>O que é a forja?</button>
      </div>
      <p className="obs-fj-what" id={oq} hidden={!aberta}>{card.explicacao.texto}</p>
      {mostraAvisos ? <p className="obs-fj-aviso">{IC.warn}<span>{card.excluido != null ? card.excluido : card.bloqueado ? <Bloqueado b={card.bloqueado} /> : null}</span></p> : null}
      {card.etapas ? <Etapas etapas={card.etapas} /> : null}
      {faixa && frase ? (
        <div className={'obs-fj-sit obs-fj-' + faixa.k}>
          {faixa.ic}
          <p>{frase}</p>
          {andamento ? <p className="obs-fj-upd">{andamento}</p> : null}
          {card.cancelar || ativo || card.acoes.length || sync !== 'parado' ? (
            <div className="obs-fj-acts">
              {card.cancelar ? <button type="button" className="btn" data-fj="cancelar" aria-busy={cancelando || undefined} onClick={cancelar}>Cancelar pedido</button> : null}
              {ativo ? <button type="button" className="btn" data-fj="pausar" onClick={pausar}>{refresh.paused ? 'Retomar atualização automática' : 'Pausar atualização automática'}</button> : null}
              {card.acoes.map(a => a.id === 'ver-trocas'
                ? <Link key={a.id} className="btn" href={a.href}>{a.label}</Link>
                : a.id === 'ver-raias'
                  ? <button key={a.id} type="button" className="btn" data-fj="ver-raias" onClick={() => verRaias(a.href)}>{a.label}</button>
                  : <button key={a.id} type="button" className="btn" data-fj="sync" aria-busy={sync === 'ocupado' || undefined} onClick={sincronizar}>{a.label}</button>)}
              {sync !== 'parado' ? (
                <p className="obs-fj-sync" role="status" data-fj-sync-status="">
                  {sync === 'ocupado' ? 'Sincronizando…' : sync === 'ok' ? 'Canal sincronizado. Pode pedir de novo.' : 'A sincronização não respondeu. Tente de novo em alguns minutos.'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="sr" role="status" aria-live="polite" data-fj-live="">{anuncio}</p>
      {card.leitura ? <LeituraBloco l={card.leitura} /> : null}
      {card.anterior ? (
        <details className="obs-fj-prev">
          <summary>Leitura anterior · {card.anterior.selo}</summary>
          <LeituraBloco l={card.anterior} aninhada />
        </details>
      ) : null}
      {card.doNicho ? (card.doNicho.items.length ? (
        <section className="obs-fj-nicho" aria-labelledby={nid}>
          <h4 id={nid}>Do site</h4>
          <p>{card.doNicho.text}</p>
          <ul>{card.doNicho.items.map(x => <li key={x.href}>{x.text} <Link href={x.href}>{x.label}</Link></li>)}</ul>
          {card.doNicho.foot ? <p>{card.doNicho.foot}</p> : null}
        </section>
      ) : <p className="obs-fj-nicho">{card.doNicho.text}</p>) : null}
      {b.visivel ? (
        <div className="obs-fj-ask">
          <button type="button" className="btn forja-solid" data-fj="pedir" aria-disabled={!b.habilitado || undefined} aria-busy={pedido.busy || undefined} aria-describedby={nota ? fid : undefined}
            onClick={() => { if (b.habilitado && !pedido.busy) void pedido.pedir() }}>
            {pedido.busy ? <span className="obs-fj-pulso" aria-hidden="true" /> : FORJA}{pedido.busy ? 'Pedindo…' : b.label}
          </button>
          {nota ? <p id={fid}>{nota}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
