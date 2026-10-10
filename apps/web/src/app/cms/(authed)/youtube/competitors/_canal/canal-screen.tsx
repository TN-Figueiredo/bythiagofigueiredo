'use client'
/**
 * A página do canal do concorrente (spec 5). Nesta tarefa: o cabeçalho, a faixa de aviso de sincronização, o diálogo de remoção e a
 * aba Vídeos (controles, grade de capas e "Carregar mais"). A Lista, as abas Trocas e Leitura entram nas tarefas seguintes. Server
 * actions chegam por props (`actions`); nenhum `Link` chega de um Server Component.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Niche } from '@/lib/youtube/observatorio/niche'
import { link } from '@/lib/youtube/observatorio/links'
import type { syncCompetitorNow, removeCompetitorChannel, getCompetitorRemovalImpactAction } from '../actions'
import type { setChannelNiche } from '../niche-actions'
import { Icon } from '../_chrome/icons'
import { PinProvider, type PinAction } from '../_chrome/pin-kit'
import { useToast } from '../_chrome/toasts'
import { RemoveDialog } from '../_canais/remove-dialog'
import { NicheOptionsContext, NichePendingContext, type NichePending } from '../_canais/niche-editor'
import type { NicheOption } from '../_canais/view-model'
import { CanalHeader } from './canal-header'
import { CarregarMais } from './carregar-mais'
import { Controles, FMT_NOME, SORT_NOME } from './controles'
import { Grade } from './grade'
import { montarLista } from './lista'
import { canalQuery, LOTE, type CanalState } from './params'
import { useCanalState } from './use-canal-state'
import { PinMessages } from './video-menu'
import type { ChannelVideoView } from './videos-model'
import type { CanalView } from './view-model'
import './canal.css'

export interface CanalActions {
  onSyncOne: typeof syncCompetitorNow
  onRemove: typeof removeCompetitorChannel
  onRemovalImpact: typeof getCompetitorRemovalImpactAction
  onSetNiche: typeof setChannelNiche
  onPin: PinAction
  onUnpin: PinAction
}

const FOCUSABLE = 'button:not([disabled]),a[href],select,input,textarea,[tabindex="0"]'
/** Tab / Shift+Tab ficam dentro do diálogo. */
function trapTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return
  const f = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => !x.closest('[hidden]'))
  if (!f.length) return
  const first = f[0]!, last = f[f.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

/** O id não é um canal deste site (desconhecido, removido, de outro site): dentro da moldura, status 200, sem erro. */
export function CanalNotFound({ canaisHref }: { canaisHref: string }) {
  return (
    <div data-obs-screen="canal">
      <div className="vazio">
        <p>Canal não encontrado. Ele pode ter sido removido.</p>
        <Link className="obs-ch-btn" href={canaisHref}>Voltar para Canais</Link>
      </div>
    </div>
  )
}

/** "Atenção:" e "Erro:" saem em negrito; o resto da frase é o do modelo, sem mudar uma letra. */
function Banner({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'danger' }) {
  const m = /^(Atenção:|Erro:|Sincronizando:)([\s\S]*)$/.exec(text)
  const cls = tone === 'warn' ? 'warn' : tone === 'danger' ? 'err' : 'info'
  return (
    <div className={'band ' + cls}>
      {tone === 'ok' ? Icon.sync() : Icon.warn()}
      <p>{m ? <><b>{m[1]}</b>{m[2]}</> : text}</p>
    </div>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const contagem = (n: number) => plural(n, 'vídeo', 'vídeos')

/** Os ids de até 100 vídeos em torno de `i` (a janela encosta no começo e no fim da lista): a vizinhança do Anterior/Próximo do Histórico. */
function vizinhanca(ids: readonly string[], i: number): string[] {
  const a = Math.max(0, Math.min(i - 50, ids.length - 100))
  return ids.slice(a, a + 100)
}

/** A aba Vídeos: controles, grade de capas (a Lista chega na Tarefa 6), "Carregar mais" e a nota fixa. */
function AbaVideos({ view, state, set, nome, channelId, onSync }: {
  view: CanalView; state: CanalState; set: (patch: Partial<CanalState>) => void; nome: string; channelId: string; onSync: () => void
}) {
  const all = view.videos.videos
  const lista = useMemo(() => montarLista(all, state), [all, state.fmt, state.sort, state.dir, state.q, state.n])   // eslint-disable-line react-hooks/exhaustive-deps
  const listaRef = useRef(lista)
  useEffect(() => { listaRef.current = lista })

  /* status: role=status, atômico. Cada mudança anuncia uma vez; a busca espera 500 ms depois da última tecla. Nunca move o foco. */
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const anunciar = useCallback((txt: () => string, espera = 0) => {
    clearTimeout(timer.current)
    // o mesmo texto de novo precisa mudar o DOM para o leitor de tela falar outra vez
    const dizer = () => setMsg(prev => { const t = txt(); return t === prev ? t + '\u200b' : t })
    if (espera) timer.current = setTimeout(dizer, espera); else dizer()
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const barRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLInputElement>(null)
  const temControles = all.length > 0
  /* A linha de controles fica presa só com largura >= 768 px e altura >= 600 px; --obs-sticky-h (0 fora disso) alimenta o scroll-margin-top de todo alvo de foco */
  useEffect(() => {
    const bar = barRef.current, raiz = bar?.closest<HTMLElement>('[data-obs-screen]')
    if (!bar || !raiz) return
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width:768px) and (min-height:600px)') : null
    const medir = () => raiz.style.setProperty('--obs-sticky-h', mq?.matches ? Math.round(bar.getBoundingClientRect().height) + 'px' : '0px')
    medir()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    ro?.observe(bar)
    mq?.addEventListener?.('change', medir)
    return () => { ro?.disconnect(); mq?.removeEventListener?.('change', medir); raiz.style.removeProperty('--obs-sticky-h') }
  }, [temControles])

  /* filtro, ordenação e busca recomeçam em acompanhados (n zera); a vista mantém o que foi carregado */
  const onFmt = (fmt: CanalState['fmt']) => {
    const l = montarLista(all, { ...state, fmt, n: 0 })
    set({ fmt, n: 0 })
    anunciar(() => `${FMT_NOME[fmt]}, ${contagem(l.visiveis.length)}`)
  }
  const onSort = (sort: CanalState['sort']) => {
    const l = montarLista(all, { ...state, sort, dir: 'desc', n: 0 })
    set({ sort, dir: 'desc', n: 0 })
    anunciar(() => `Ordenado por ${SORT_NOME[sort]}, decrescente, ${contagem(l.visiveis.length)}`)
  }
  const onQ = (q: string) => {
    set({ q, n: 0 })
    anunciar(() => (q.trim() ? listaRef.current.resultado : contagem(listaRef.current.visiveis.length)), 500)
  }
  const onClearQ = () => {
    const l = montarLista(all, { ...state, q: '', n: 0 })
    set({ q: '', n: 0 })
    inputRef.current?.focus()
    anunciar(() => `Busca limpa, ${contagem(l.visiveis.length)}`)
  }
  const onVer = (ver: CanalState['ver']) => {
    set({ ver })
    anunciar(() => `Vista ${ver === 'lista' ? 'Lista' : 'Capas'}, ${contagem(lista.visiveis.length)}`)
  }
  const buscarEmTodos = () => {
    const l = montarLista(all, { ...state, fmt: 'todos', n: 0 })
    set({ fmt: 'todos', n: 0 })
    anunciar(() => `${FMT_NOME.todos}, ${contagem(l.visiveis.length)}`)
  }

  /* "Carregar mais": o foco vai para o primeiro cartão novo (sem rolar) e o status diz quantos vieram */
  const focoNoNovo = useRef<string | null>(null)
  useLayoutEffect(() => {
    const id = focoNoNovo.current
    if (!id) return
    focoNoNovo.current = null
    document.getElementById('cv-lnk-' + id)?.focus({ preventScroll: true })
  })
  const onMais = () => {
    const n = state.n + LOTE
    const depois = montarLista(all, { ...state, n })
    const antes = new Set(lista.visiveis)
    const novos = depois.visiveis.filter(id => !antes.has(id))
    focoNoNovo.current = novos[0] ?? null
    set({ n })
    anunciar(() => `Mostrando ${depois.visiveis.length} de ${depois.mais?.total ?? depois.visiveis.length} vídeos. `
      + `${plural(novos.length, 'vídeo antigo carregado', 'vídeos antigos carregados')}${depois.mais ? '.' : '. Não falta nenhum.'}`)
  }

  const ampliar = (v: ChannelVideoView) => { if (v.thumbSrc) window.open(v.thumbSrc, '_blank', 'noopener,noreferrer') }
  const verTrocas = (v: ChannelVideoView) => set({ tab: 'trocas', video: v.id })
  const hrefs = useMemo(() => {
    const back = canalQuery(state), pos = new Map(lista.visiveis.map((id, i) => [id, i]))
    return (v: ChannelVideoView) => link.historico(v.id, { from: 'canais', canal: channelId, back, ids: vizinhanca(lista.visiveis, pos.get(v.id) ?? 0) })
  }, [lista, state, channelId])   // eslint-disable-line react-hooks/exhaustive-deps

  if (state.tab !== 'videos') return null
  return (
    <section aria-labelledby="cv-h2" className="cv-sec">
      <h2 className="obs-ch-sr" id="cv-h2">Vídeos</h2>
      <p className="obs-ch-sr cv-status" role="status" aria-atomic="true">{msg}</p>
      {temControles ? (
        <>
          <Controles state={state} counts={lista.counts} barRef={barRef} inputRef={inputRef}
            onFmt={onFmt} onSort={onSort} onQ={onQ} onClearQ={onClearQ} onVer={onVer} />
          <PinMessages />
          {lista.secoes.length ? <a className="lk cv-skip" href="#cv-fim" onClick={e => { e.preventDefault(); document.getElementById('cv-fim')?.focus() }}>Pular a lista de vídeos</a> : null}
          {lista.secoes.length ? <Grade lista={lista} sort={state.sort} nome={nome} hrefDe={hrefs} onAmpliar={ampliar} onTrocas={verTrocas} /> : null}
          <div id="cv-fim" tabIndex={-1} />
          {lista.vazio ? (
            <div className="cv-empty">
              <p>{lista.vazio.text}</p>
              {lista.vazio.acao ? (
                <div className="cv-empty-acts">
                  <button type="button" className="obs-ch-btn" onClick={onClearQ}>Limpar busca</button>
                  {lista.vazio.acao === 'buscar-em-todos' ? <button type="button" className="obs-ch-btn" onClick={buscarEmTodos}>Buscar em Todos</button> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {lista.mais ? <CarregarMais mais={lista.mais} onMais={onMais} /> : null}
          <p className="cv-foot">{view.videos.nota}</p>
        </>
      ) : (
        <div className="cv-empty">
          <p>{view.videos.semVideos}</p>
          <button type="button" className="obs-ch-btn" onClick={onSync}>Sincronizar só este canal</button>
        </div>
      )}
    </section>
  )
}

export function CanalScreen({ view, niches, canAdmin, actions }: { view: CanalView; niches: NicheOption[]; canAdmin: boolean; leitura: ReactNode | null; actions: CanalActions }) {
  const router = useRouter(), toast = useToast()
  const h = view.header
  const [state, set] = useCanalState(view.state)
  const nums = state.nums
  const [syncing, setSyncing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)

  /** "Todos os números" põe nums=1 na URL SEM navegar (replaceState): o servidor não relê, e o resto da URL (from, back…) fica. */
  const toggleNums = () => set({ nums: !nums })

  const syncOne = async () => {
    if (syncing) return
    if (view.backfilling) { toast('warn', `${h.name} ainda está buscando vídeos; sincronize depois que a busca terminar.`, ''); return }
    setSyncing(true)
    toast('', `Sincronizando ${h.name}…`, '')
    let ok = false
    try { ok = (await actions.onSyncOne(h.id)).ok } catch { ok = false }
    setSyncing(false)
    if (ok) toast('ok', `${h.name} sincronizado`, 'Dados atualizados agora.')
    else toast('bad', `${h.name} não sincronizou`, 'A sincronização não respondeu. Tente de novo em alguns minutos.')
    router.refresh()
  }

  // nicho: o escolhido aparece já; some quando a ação falha ou quando o servidor manda dados novos
  const [pending, setPending] = useState<NichePending>({})
  const seq = useRef(0)
  const [seenView, setSeenView] = useState(view)
  if (seenView !== view) {
    setSeenView(view)
    if (Object.values(pending).some(p => !p.busy)) setPending(cur => Object.fromEntries(Object.entries(cur).filter(([, p]) => p.busy)))
  }
  const setNiche = async (n: Niche) => {
    const mine = ++seq.current
    setPending(cur => ({ ...cur, [h.id]: { niche: n, busy: true } }))
    let ok = false
    try { ok = (await actions.onSetNiche(h.id, n)).ok } catch { ok = false }
    if (seq.current === mine) {
      if (ok) setPending(cur => ({ ...cur, [h.id]: { niche: n, busy: false } }))
      else setPending(cur => Object.fromEntries(Object.entries(cur).filter(([id]) => id !== h.id)))
    }
    if (!ok) { toast('bad', 'Não deu para mudar o nicho', h.niche ? `${h.name} continua no nicho anterior.` : `${h.name} continua sem nicho.`); return }
    toast('ok', `Nicho de ${h.name} alterado para ${niches.find(o => o.id === n)?.label ?? n}`, '')
    router.refresh()
  }

  const closeConfirm = () => { setConfirm(false); requestAnimationFrame(() => menuBtn.current?.focus()) }
  const doRemove = async () => {
    setConfirm(false)
    let res: { ok: boolean; error?: string } = { ok: false }
    try { res = await actions.onRemove(h.id) } catch { res = { ok: false } }
    if (!res.ok) { toast('bad', 'Não deu para remover o canal', res.error ?? `${h.name} continua no observatório.`); return }
    toast('ok', `${h.name} removido`, 'O canal saiu do observatório e os dados coletados dele foram apagados.')
    router.replace(link.canais())
  }

  return (
    <NicheOptionsContext.Provider value={niches}>
      <NichePendingContext.Provider value={pending}>
        <div data-obs-screen="canal">
          <CanalHeader h={h} nums={nums} syncing={syncing} canAdmin={canAdmin} menuBtnRef={menuBtn}
            onToggleNums={toggleNums} onSync={() => { void syncOne() }} onAskRemove={() => setConfirm(true)} onNiche={n => { void setNiche(n) }} />
          {h.sync.banner ? <Banner text={h.sync.banner} tone={h.sync.tone} /> : null}
          <PinProvider onPin={actions.onPin} onUnpin={actions.onUnpin}>
            <AbaVideos view={view} state={state} set={set} nome={h.name} channelId={h.id} onSync={() => { void syncOne() }} />
          </PinProvider>
          {confirm ? <RemoveDialog id={h.id} name={h.name} onImpact={actions.onRemovalImpact} onCancel={closeConfirm} onConfirm={() => { void doRemove() }} trap={trapTab} /> : null}
        </div>
      </NichePendingContext.Provider>
    </NicheOptionsContext.Provider>
  )
}
