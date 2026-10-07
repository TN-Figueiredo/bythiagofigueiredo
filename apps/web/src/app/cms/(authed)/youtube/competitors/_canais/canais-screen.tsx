'use client'
/**
 * Canais screen of the Observatório (port of canais.html). Rendered inside the chrome (its [data-obs] tokens and
 * toasts). Everything shown comes from the view model; URL state (fmt, scale, layout, sort, filter, add, channel,
 * nicheEditor) goes through router.replace and the server re-renders the view. Server actions arrive as props.
 *
 * Every one of those navigations runs inside a transition with an optimistic overlay (`opt`), so the click answers at
 * once: the drawer opens as a shell of the clicked row, the pressed option of Formato/Escala flips, Tabela/Cards swaps
 * (same data), the add form opens; what only the server can say (numbers, order) keeps the previous content marked
 * aria-busy until it arrives. The overlay is dropped by React when the navigation ends, so it can never outlive it.
 */
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import { DEFAULT_SORT, type CanaisRow, type CanaisSort, type CanaisView } from './view-model'
import { useToast } from '../_chrome/toasts'
import { useChromeSync } from '../_chrome/sync-context'
import { ChannelTable, type RowHandlers } from './channel-table'
import { ChannelCards } from './channel-cards'
import { ChannelDrawer, type DrawerShell } from './channel-drawer'
import { DrawerForjaBox, DrawerForjaFoot } from './drawer-forja'
import type { ForjaAsk } from '../_chrome/forja-view-model'
import { PinProvider, type PinAction } from '../_chrome/pin-kit'
import { RemoveDialog, type ImpactAnswer } from './remove-dialog'
import { AddChannelForm, type AddFn } from './add-channel-form'
import { RowMenu, rowMenuButton } from './row-menu'
import { NicheEditorDialog, NicheOptionsContext, NichePendingContext, type NichePending } from './niche-editor'
import { Ic, Tip, type LocalSync } from './cells'
import './canais.css'

export interface CanaisScreenProps {
  view: CanaisView
  /** site_users.role ∈ {super_admin, org_admin}, decided on the server. */
  canUnlock: boolean
  onAdd: AddFn
  onRemove: (id: string) => Promise<{ ok: boolean; error?: string }>
  onUnlock: () => Promise<{ ok: boolean; error?: string }>
  onSetNiche: (id: string, niche: Niche) => Promise<{ ok: boolean }>
  /** Niche of an own channel (server action setOwnChannelNiche): another table, so another action. */
  onSetOwnNiche: (id: string, niche: Niche) => Promise<{ ok: boolean; error?: string }>
  onSyncOne: (id: string) => Promise<{ ok: boolean }>
  /** "Pedir leitura à forja" in the channel drawer (server action askForjaReading). */
  onAskForja?: ForjaAsk
  /** Server actions pinVideo / unpinVideo, for "Desafixar" in the drawer's list of pinned videos. */
  onPin?: PinAction
  onUnpin?: PinAction
  /** Server action getCompetitorRemovalImpactAction: what removing the channel deletes, asked when the dialog opens. */
  onRemovalImpact?: (id: string) => Promise<ImpactAnswer>
}

const UPNEXT = '/cms/up-next'
/** After an add: one refresh every ADD_WATCH_MS, at most ADD_WATCH_MAX times (3 min). */
const ADD_WATCH_MS = 6_000, ADD_WATCH_MAX = 30
const WIDE = '(min-width: 1280px)'
function useWide(): boolean {
  return useSyncExternalStore(
    cb => { if (typeof window === 'undefined' || !window.matchMedia) return () => {}; const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE).matches),
    () => true,
  )
}
/**
 * What the screen shows ahead of the server while a navigation is in flight. `channel`: the drawer asked for (null:
 * closed). `busy`: the list's numbers or order are about to change (the list is marked aria-busy, never rewritten).
 */
interface Optimistic { channel?: string | null; fmt?: CanaisView['fmt']; scale?: CanaisView['scale']; layout?: CanaisView['layout']; add?: boolean; sort?: CanaisSort; dir?: CanaisView['dir']; busy?: boolean }
const FOCUSABLE = 'button:not([disabled]),a[href],select,input,textarea,[tabindex="0"]'
/** Tab / Shift+Tab stay inside the dialog (canais.html trapEl). */
function trapTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return
  const f = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => !x.closest('[hidden]'))
  if (!f.length) return
  const first = f[0]!, last = f[f.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

export function CanaisScreen({ view, canUnlock, onAdd, onRemove, onUnlock, onSetNiche, onSetOwnNiche, onSyncOne, onAskForja, onPin, onUnpin, onRemovalImpact }: CanaisScreenProps) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const toast = useToast()
  const wide = useWide()
  const { running } = useChromeSync()
  const [q, setQ] = useState(search?.get('q') ?? '')
  const [closedDrawer, setClosedDrawer] = useState<string | null>(null)
  const [addClosed, setAddClosed] = useState(false)
  const [nicheClosed, setNicheClosed] = useState(false)
  /** The channel whose ⋯ menu is open. Only the id: the menu measures its button itself (row-menu.tsx). */
  const [menu, setMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | { id: string; name: string }>(null)
  const [local, setLocal] = useState<Record<string, LocalSync>>({})
  const returnFocus = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const urlWith = useCallback((set: Record<string, string | null>) => {
    const u = new URLSearchParams(search?.toString() ?? '')
    for (const [k, v] of Object.entries(set)) { if (v == null) u.delete(k); else u.set(k, v) }
    const s = u.toString()
    return pathname + (s ? '?' + s : '')
  }, [pathname, search])
  const [navPending, startNav] = useTransition()
  const [opt, addOpt] = useOptimistic<Optimistic, Optimistic>({}, (cur, x) => ({ ...cur, ...x }))
  /** A navigation of this screen: the optimistic overlay goes up in the same transition and comes down when it ends. */
  const nav = useCallback((mode: 'replace' | 'push', url: string, o?: Optimistic) => startNav(() => {
    if (o) addOpt(o)
    return router[mode](url, { scroll: false })
  }), [router, addOpt])
  const go = useCallback((set: Record<string, string | null>, o?: Optimistic) => nav('replace', urlWith(set), o), [nav, urlWith])
  /** A same-page <Link>: a plain click navigates inside the transition; a modified click (new tab) is the browser's. */
  const linkNav = (e: ReactMouseEvent<HTMLAnchorElement>, href: string, o?: Optimistic) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    nav('push', href, o)
  }

  // The server opened a new drawer / form: forget the local "closed" marks.
  const drawerId = view.drawer?.id ?? null
  const [seenDrawer, setSeenDrawer] = useState(drawerId)
  if (seenDrawer !== drawerId) { setSeenDrawer(drawerId); setClosedDrawer(null) }
  const [seenAdd, setSeenAdd] = useState(view.addOpen)
  if (seenAdd !== view.addOpen) { setSeenAdd(view.addOpen); setAddClosed(false) }
  // own.rows too: under "só canais com problema" view.rows leaves the own channels out, and they are still on screen
  const rowOf = useCallback((id: string) => view.rows.find(r => r.id === id) ?? view.own.rows.find(r => r.id === id) ?? view.groups.flatMap(g => g.rows).find(r => r.id === id) ?? null, [view])
  const drawer = view.drawer && closedDrawer !== view.drawer.id && (opt.channel === undefined || opt.channel === view.drawer.id) ? view.drawer : null
  /** The drawer asked for and not yet sent by the server: its head comes from the row that was clicked. */
  const shellRow = opt.channel && !drawer && closedDrawer !== opt.channel ? rowOf(opt.channel) : null
  const shell: DrawerShell | null = shellRow
  const panel = drawer ?? shell
  const layout = opt.layout ?? view.layout
  const listBusy = (navPending && opt.busy) || undefined
  const addOpen = (opt.add ?? view.addOpen) && !addClosed
  const nicheOpen = view.nicheEditorOpen && !nicheClosed
  const drawerModal = !!panel && !wide
  const anyModal = addOpen || nicheOpen || !!confirm || drawerModal

  // Focus the drawer's close button when it opens (canais.html openDrawer).
  // "Ver fixados" (…#fixados) lands on the list of pinned videos: the drawer then focuses that list's title, not "Fechar"
  useEffect(() => {
    if (!panel) return
    const toPinned = typeof window !== 'undefined' && window.location.hash === '#fixados' && !!document.getElementById('cn-fxPinH') && !document.getElementById('cn-pVid')?.hasAttribute('hidden')
    if (!toPinned) closeRef.current?.focus()
  }, [panel?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rowButton = (id: string) => document.querySelector<HTMLElement>(`[data-obs-screen="canais"] .nmbtn[data-open="${CSS.escape(id)}"]`)
  const openDrawer = (id: string) => { returnFocus.current = rowButton(id); setMenu(null); setClosedDrawer(null); go({ channel: id, tab: null }, { channel: id }) }
  const closeDrawer = useCallback(() => {
    if (!panel) return
    const id = panel.id
    setClosedDrawer(id)
    go({ channel: null, tab: null }, { channel: null })
    const t = returnFocus.current && returnFocus.current.isConnected ? returnFocus.current : rowButton(id)
    requestAnimationFrame(() => (t ?? rowButton(id))?.focus())
    t?.focus()
  }, [panel, go])
  const closeAdd = () => { setAddClosed(true); go({ add: null }, { add: false }) }
  const closeNiche = () => { setNicheClosed(true); go({ nicheEditor: null }) }
  const closeMenu = (focus: boolean) => { const id = menu; setMenu(null); if (focus && id) rowMenuButton(id)?.focus() }
  const closeConfirm = () => { setConfirm(null); returnFocus.current?.focus() }

  // Esc closes the topmost layer (canais.html keydown).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menu) { closeMenu(true); return }
      if (confirm) { closeConfirm(); return }
      if (addOpen) { closeAdd(); return }
      if (nicheOpen) { closeNiche(); return }
      if (panel) closeDrawer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
  // Click outside closes the row menu.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[role="menu"],[data-menu]')) setMenu(null) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  // The server said the channel of ?channel= is in another niche than the explicit filter: drop it from the URL.
  useEffect(() => { if (view.drawerDropped) go({ channel: null, tab: null }) }, [view.drawerDropped]) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimistic niche: per channel id, shown by every NicheSelect at once. It is dropped when the action fails, or (once the
  // action succeeded) when the server sends new data. nicheSeq makes the last pick of a channel win over late answers.
  const [pending, setPending] = useState<NichePending>({})
  const nicheSeq = useRef<Record<string, number>>({})
  const [seenView, setSeenView] = useState(view)
  if (seenView !== view) {
    setSeenView(view)
    if (Object.values(pending).some(p => !p.busy)) setPending(cur => Object.fromEntries(Object.entries(cur).filter(([, p]) => p.busy)))
  }
  const setNiche = async (r: { id: string; name: string; own: boolean; niche: Niche | null }, n: Niche, ctx: string) => {
    const seq = (nicheSeq.current[r.id] ?? 0) + 1
    nicheSeq.current[r.id] = seq
    setPending(cur => ({ ...cur, [r.id]: { niche: n, busy: true } }))
    let ok = false, refusal: string | undefined
    try { const res: { ok: boolean; error?: string } = await (r.own ? onSetOwnNiche : onSetNiche)(r.id, n); ok = res.ok; refusal = res.error } catch { ok = false }
    if (nicheSeq.current[r.id] === seq) {
      if (ok) setPending(cur => ({ ...cur, [r.id]: { niche: n, busy: false } }))
      else setPending(cur => Object.fromEntries(Object.entries(cur).filter(([id]) => id !== r.id)))
    }
    if (!ok) { toast('bad', 'Não deu para mudar o nicho', refusal ?? (r.niche ? `${r.name} continua no nicho anterior.` : `${r.name} continua sem nicho.`)); return }
    const NLn = view.niches.find(o => o.id === n)?.label ?? n
    const left = view.niche !== 'todos' && view.niche !== n
    toast('ok', r.own ? `Nicho de ${r.name} definido como ${NLn}` : `Nicho de ${r.name} alterado para ${NLn}`, left ? `Ele saiu do filtro ${view.nicheLabel}.` : '')
    // the channel left the filter and its drawer is the open one: close it
    if (left && panel?.id === r.id) { setClosedDrawer(r.id); go({ channel: null, tab: null }, { channel: null }) }
    router.refresh()
    // canais.html: the focus goes back to the select that changed. A channel that left the filter loses its row (and
    // its drawer) on the refresh, so the focus goes to the first row that stays; the editor dialog lists every niche.
    const root = '[data-obs-screen="canais"]'
    if (left && ctx !== 'editor') {
      const stay = () => [...document.querySelectorAll<HTMLElement>(`${root} .nmbtn`)].find(b => b.dataset.open !== r.id)?.focus()
      stay(); requestAnimationFrame(stay) // again after the drawer closed: until then the table is inert
    } else document.querySelector<HTMLElement>(`${root} select[data-niche="${CSS.escape(r.id)}"][data-ctx="${CSS.escape(ctx)}"]`)?.focus()
  }
  const syncOne = async (id: string) => {
    const r = rowOf(id); if (!r) return
    const T = r.syncOneText
    if (r.backfill) { toast('warn', T.backfill, ''); return }
    setLocal(s => ({ ...s, [id]: 'now' }))
    toast('', T.start, '')
    let ok = false
    try { ok = (await onSyncOne(id)).ok } catch { ok = false }
    setLocal(s => ({ ...s, [id]: ok ? 'just' : undefined }))
    if (ok) toast('ok', T.ok, T.okBody)
    else toast('bad', T.fail, T.failBody)
    router.refresh()
  }
  const askRemove = (id: string, from: HTMLElement | null) => {
    const r = rowOf(id) ?? (panel?.id === id ? { name: panel.name } : null); if (!r) return
    returnFocus.current = from ?? document.activeElement as HTMLElement | null
    setMenu(null); setConfirm({ id, name: r.name })
  }
  const doRemove = async () => {
    if (!confirm) return
    const { id, name } = confirm
    setConfirm(null)
    const res = await onRemove(id)
    if (!res.ok) { toast('bad', 'Não deu para remover o canal', res.error ?? `${name} continua no observatório.`); return }
    toast('ok', `${name} removido`, 'O canal saiu do observatório e os dados coletados dele foram apagados.')
    if (panel?.id === id) { setClosedDrawer(id); go({ channel: null, tab: null }, { channel: null }) }
    router.refresh()
  }
  const unlock = async () => {
    const res = await onUnlock()
    if (!res.ok) { toast('bad', 'Não deu para destravar vagas', res.error === 'forbidden' ? 'Só administradores destravam vagas.' : res.error ?? ''); return }
    toast('ok', 'Vagas destravadas', view.slots.unlockDone)
    router.refresh()
  }
  const copyCowork = async (r: CanaisRow) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sem área de transferência')
      await navigator.clipboard.writeText(r.cowork)
      toast('ok', 'Pedido copiado para o Cowork', 'Cole no Cowork com ⌘V.')
    } catch {
      toast('warn', 'Não deu para copiar', 'O navegador bloqueou a área de transferência. Selecione o texto abaixo e copie com ⌘C.', { selectable: r.cowork })
    }
  }

  const ql = q.trim().toLowerCase()
  const groups = useMemo(() => view.groups.map(g => ({ ...g, rows: g.rows.filter(r => r.name.toLowerCase().includes(ql)) })).filter(g => g.rows.length), [view.groups, ql])
  const empty = ql
    ? <>Nenhum canal com “{q}”{view.niche !== 'todos' ? ` em ${view.nicheLabel}` : ''}{view.filter === 'problemas' ? ' entre os que têm problema' : ''}. Para acompanhar um canal novo, use Adicionar canal.</>
    : view.filter === 'problemas' ? <>{view.emptyText} <Link className="btn small link" href={view.problems.clearHref} onClick={e => linkNav(e, view.problems.clearHref, { busy: true })}>Mostrar todos</Link></> : view.emptyLink ? <>{view.emptyText.slice(0, view.emptyText.lastIndexOf(view.emptyLink.text))}<Link className="inl" href={view.emptyLink.href}>{view.emptyLink.text}</Link>.</> : <>{view.emptyText}</>

  const h: RowHandlers = {
    open: openDrawer, niche: (r, n, ctx) => { void setNiche(r, n, ctx) },
    menu: id => { if (menu === id) closeMenu(true); else setMenu(id) },
    retry: id => { void syncOne(id) }, remove: askRemove, local: id => local[id], roundRunning: running, upnextHref: UPNEXT, menuFor: menu, selected: panel?.id ?? null,
  }
  // The order asked for last, even if the server has not answered it yet: a second click on the same header flips it.
  const sort = opt.sort ?? view.sort, dir = opt.sort ? (opt.dir ?? 'desc') : view.dir
  const onSort = (k: CanaisSort) => {
    const asc = sort === k && dir === 'desc'
    go({ sort: k === DEFAULT_SORT ? null : k, dir: asc ? 'asc' : null }, { sort: k, dir: asc ? 'asc' : 'desc', busy: true })
  }
  const onCardSort = (k: CanaisSort) => go({ sort: k === DEFAULT_SORT ? null : k, dir: null }, { sort: k, dir: 'desc', busy: true })
  // Tabela/Cards draws the same rows another way: it swaps at once. Formato and Escala change numbers only the server has.
  const fmt = opt.fmt ?? view.fmt, scale = opt.scale ?? view.scale
  const pickFmt = (v: CanaisView['fmt']) => go({ fmt: v === 'long' ? null : v }, { fmt: v, busy: true })
  const pickScale = (v: CanaisView['scale']) => go({ scale: v === 'per-mil' ? null : v }, { scale: v, busy: true })
  const pickLayout = (v: CanaisView['layout']) => go({ layout: v === 'table' ? null : v }, { layout: v })

  const menuRow = menu ? rowOf(menu) : null

  // A channel added here syncs in the background: the screen asks the server again every few seconds until its row
  // leaves "buscando vídeos" (or ADD_WATCH_MAX tries pass), and only then says it is ready.
  const [watch, setWatch] = useState<null | { name: string; tries: number }>(null)
  const watchName = watch?.name ?? null
  useEffect(() => {
    if (!watchName) return
    const t = setInterval(() => {
      setWatch(w => (w && w.tries + 1 < ADD_WATCH_MAX ? { ...w, tries: w.tries + 1 } : null))
      router.refresh()
    }, ADD_WATCH_MS)
    return () => clearInterval(t)
  }, [watchName, router])
  useEffect(() => {
    if (!watchName) return
    const r = [...view.rows, ...view.groups.flatMap(g => g.rows)].find(x => !x.own && x.name === watchName)
    // the first answer after the add may still be the list without the row: only a row that is there and done ends the wait
    if (r && !r.backfill) { setWatch(null); toast('ok', `${watchName} pronto`, 'Os vídeos foram buscados e o canal já entrou na ordem da lista.') }
  }, [view, watchName, toast])

  const s = view.slots, full = s.free === 0
  return (
    <NicheOptionsContext.Provider value={view.niches}>
    <NichePendingContext.Provider value={pending}>
    <div data-obs-screen="canais" className={panel ? 'drawer-open' : undefined} data-nav-pending={navPending ? '' : undefined}>
      {navPending ? <div className="cn-navbar" aria-hidden="true"><i /></div> : null}
      <div className="cn-page">
        <div className={'wrap' + (layout === 'cards' ? ' view-cards' : '')} inert={anyModal || undefined}>
          <div className={'syncbar' + (running ? ' on' : '')} role="status" aria-live="polite" data-k="syncbar">
            {running ? (
              <>
                <span style={{ color: 'var(--info)' }}><Ic n="spin" spin /></span>
                <div><strong>{view.syncbar.text}</strong><div className="meta">{view.syncbar.meta}</div></div>
                <div className="track" aria-hidden="true"><i /></div>
              </>
            ) : null}
          </div>
          {view.forjaBar ? (
            <details className="fbar" id="forjaBar" data-forja-anchor=""><summary><b>forja</b> <span>{view.forjaBar.lines}</span></summary><p>{view.forjaBar.text}</p></details>
          ) : null}
          <div className="toolbar">
            <div className="search">
              <Ic n="search" />
              <input name="q" type="search" placeholder="Buscar canal" aria-label="Buscar canal" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="seg" role="group" aria-label="Formato">
              <button type="button" aria-pressed={fmt === 'long'} onClick={() => pickFmt('long')}>Longos</button>
              <button type="button" aria-pressed={fmt === 'short'} onClick={() => pickFmt('short')}>Shorts</button>
            </div>
            <div className="seg" role="group" aria-label="Escala de views/dia">
              <button type="button" aria-pressed={scale === 'abs'} onClick={() => pickScale('abs')}>Absoluto</button>
              <button type="button" aria-pressed={scale === 'per-mil'} onClick={() => pickScale('per-mil')}>Por mil inscritos</button>
            </div>
            <div className="seg" role="group" aria-label="Visualização">
              <button type="button" aria-pressed={layout === 'table'} onClick={() => pickLayout('table')}>Tabela</button>
              <button type="button" aria-pressed={layout === 'cards'} onClick={() => pickLayout('cards')}>Cards</button>
            </div>
            <label className="cardsort"><span className="sr">Ordenar cards por</span>
              <select className="sel" name="cardSort" value={sort} onChange={e => onCardSort(e.target.value as CanaisSort)}>
                <option value="vpd">Views/dia</option><option value="subs">Inscritos</option><option value="active">Ritmo</option><option value="outliers">Outliers</option><option value="swaps">Trocas</option><option value="growth">Crescimento</option>
              </select>
            </label>
          </div>
          <div className="toolbar2">
            <span className="sortnote" aria-live="polite">{view.sortNote}</span>
            <span>
              {view.filter === 'problemas'
                ? <span className="chip">Só canais com problema ({view.problems.n}) <Link className="btn small link" href={view.problems.clearHref} onClick={e => linkNav(e, view.problems.clearHref, { busy: true })}>Mostrar todos</Link></span>
                : view.problems.n ? <Link className="btn small link" href={view.problems.filterHref} onClick={e => linkNav(e, view.problems.filterHref, { busy: true })}>Ver só canais com problema ({view.problems.n})</Link> : null}
            </span>
            <span className="spacer" />
            <span className="quota">
              <span className="num" data-k="nCh">{s.used}</span>{' '}de{' '}<span className="num" data-k="nLim">{s.limit}</span>{' '}canais
              <Tip label="Sobre o limite de canais" left>{s.tip}</Tip>
            </span>
            {canUnlock && s.nearFull ? <button type="button" className="btn small" onClick={() => { void unlock() }}>{s.unlockText}</button> : null}
            {full ? (
              <a className="btn primary btn-primary is-off" aria-disabled="true" role="link" tabIndex={0} title={s.fullText ?? undefined}
                onClick={e => { e.preventDefault(); toast('warn', s.fullText ?? '', '') }}
                onKeyDown={e => { if (e.key === 'Enter') toast('warn', s.fullText ?? '', '') }}>
                <Ic n="plus" />Adicionar canal
              </a>
            ) : (
              <Link className="btn primary btn-primary" href={urlWith({ add: '1' })} scroll={false} onClick={e => { setAddClosed(false); linkNav(e, urlWith({ add: '1' }), { add: true }) }}><Ic n="plus" />Adicionar canal</Link>
            )}
          </div>

          {layout === 'table'
            ? <ChannelTable view={view} own={view.own} groups={groups} h={h} onSort={onSort} empty={empty} busy={listBusy} busySort={listBusy ? opt.sort : undefined} />
            : <ChannelCards view={view} own={view.own} groups={groups} h={h} empty={empty} busy={listBusy} />}

          <div className="legend">
            <span><i aria-hidden="true" /> vídeo longo</span>
            <span><i className="s" aria-hidden="true" /> Short</span>
            <span><i className="e" aria-hidden="true" /> semana sem upload</span>
            <span>Outlier: <span><b className="mult mid num">{view.legend.mid}</b> <b className="mult high num">{view.legend.high}</b> <b className="mult top num">{view.legend.top}</b></span> contra os outros vídeos do canal na mesma idade, sem contar o próprio vídeo; abaixo de 2× aparece só como “a mediana”</span>
          </div>
        </div>

        {panel ? (
          <>
            {drawerModal ? <button type="button" className="cn-backdrop" aria-label="Fechar detalhes do canal" tabIndex={-1} onClick={closeDrawer} /> : null}
            <PinProvider onPin={onPin} onUnpin={onUnpin}>
            <ChannelDrawer d={panel} modal={drawerModal} upnextHref={UPNEXT} onClose={closeDrawer} closeRef={closeRef} trap={trapTab}
              onRemove={from => askRemove(panel.id, from)} onNiche={n => { void setNiche({ id: panel.id, name: panel.name, own: panel.own, niche: panel.niche }, n, 'drawer') }}
              forjaSlot={drawer && view.drawerForja && view.drawerForja.niche === drawer.niche ? <DrawerForjaBox f={view.drawerForja} /> : null}
              forjaFootSlot={drawer && view.drawerForja && view.drawerForja.niche === drawer.niche ? <DrawerForjaFoot f={view.drawerForja} onAsk={onAskForja} /> : null} />
            </PinProvider>
          </>
        ) : null}
      </div>

      {menuRow ? (
        <RowMenu row={menuRow} onClose={closeMenu}
          onOpen={() => openDrawer(menuRow.id)}
          onSync={() => { closeMenu(true); void syncOne(menuRow.id) }}
          onYoutube={() => { closeMenu(true); window.open(menuRow.url, '_blank', 'noopener') }}
          onCopy={() => { closeMenu(true); void copyCowork(menuRow) }}
          onRemove={() => askRemove(menuRow.id, rowMenuButton(menuRow.id))} />
      ) : null}

      {confirm ? <RemoveDialog id={confirm.id} name={confirm.name} onImpact={onRemovalImpact} onCancel={closeConfirm} onConfirm={() => { void doRemove() }} trap={trapTab} /> : null}

      {addOpen ? (
        <AddChannelForm view={view} onAdd={onAdd} onClose={closeAdd} trap={trapTab}
          onAdded={(input, title) => { closeAdd(); toast('ok', 'Canal adicionado', `${title ?? input.channel} entrou em ${view.niches.find(o => o.id === input.niche)?.label ?? input.niche}. A busca dos vídeos leva cerca de um minuto; até lá ele fica no fim da lista como “buscando vídeos”.`); if (title) setWatch({ name: title, tries: 0 }); router.refresh() }} />
      ) : null}

      {nicheOpen ? (
        <NicheEditorDialog rows={view.nicheRows} onNiche={(r, n) => { void setNiche({ ...r, own: false }, n, 'editor') }} onClose={closeNiche} trap={trapTab} />
      ) : null}
    </div>
    </NichePendingContext.Provider>
    </NicheOptionsContext.Provider>
  )
}
