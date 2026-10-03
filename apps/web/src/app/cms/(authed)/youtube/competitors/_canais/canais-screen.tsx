'use client'
/**
 * Canais screen of the Observatório (port of canais.html). Rendered inside the chrome (its [data-obs] tokens and
 * toasts). Everything shown comes from the view model; URL state (fmt, scale, layout, sort, filter, add, channel,
 * nicheEditor) goes through router.replace and the server re-renders the view. Server actions arrive as props.
 */
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import type { Niche } from '@/lib/youtube/observatorio/types'
import type { CanaisRow, CanaisSort, CanaisView } from './view-model'
import { useToast } from '../_chrome/toasts'
import { useChromeSync } from '../_chrome/sync-context'
import { ChannelTable, type RowHandlers } from './channel-table'
import { ChannelCards } from './channel-cards'
import { ChannelDrawer } from './channel-drawer'
import { DrawerForjaBox, DrawerForjaFoot } from './drawer-forja'
import type { ForjaAsk } from '../_chrome/forja-view-model'
import { AddChannelForm, type AddFn } from './add-channel-form'
import { RowMenu, rowMenuButton } from './row-menu'
import { NicheEditorDialog, NichePendingContext, type NichePending } from './niche-editor'
import { Ic, Tip, type LocalSync } from './cells'
import './canais.css'

export interface CanaisScreenProps {
  view: CanaisView
  /** site_users.role ∈ {super_admin, org_admin}, decided on the server. */
  canUnlock: boolean
  onAdd: AddFn
  onRemove: (id: string) => Promise<{ ok: boolean }>
  onUnlock: () => Promise<{ ok: boolean; error?: string }>
  onSetNiche: (id: string, niche: Niche) => Promise<{ ok: boolean }>
  /** Niche of an own channel (server action setOwnChannelNiche): another table, so another action. */
  onSetOwnNiche: (id: string, niche: Niche) => Promise<{ ok: boolean }>
  onSyncOne: (id: string) => Promise<{ ok: boolean }>
  /** "Pedir leitura à forja" in the channel drawer (server action askForjaReading). */
  onAskForja?: ForjaAsk
}

const UPNEXT = '/cms/up-next'
const WIDE = '(min-width: 1280px)'
function useWide(): boolean {
  return useSyncExternalStore(
    cb => { if (typeof window === 'undefined' || !window.matchMedia) return () => {}; const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE).matches),
    () => true,
  )
}
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

export function CanaisScreen({ view, canUnlock, onAdd, onRemove, onUnlock, onSetNiche, onSetOwnNiche, onSyncOne, onAskForja }: CanaisScreenProps) {
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
  const go = useCallback((set: Record<string, string | null>) => router.replace(urlWith(set), { scroll: false }), [router, urlWith])

  // The server opened a new drawer / form: forget the local "closed" marks.
  const drawerId = view.drawer?.id ?? null
  const [seenDrawer, setSeenDrawer] = useState(drawerId)
  if (seenDrawer !== drawerId) { setSeenDrawer(drawerId); setClosedDrawer(null) }
  const [seenAdd, setSeenAdd] = useState(view.addOpen)
  if (seenAdd !== view.addOpen) { setSeenAdd(view.addOpen); setAddClosed(false) }
  const drawer = view.drawer && closedDrawer !== view.drawer.id ? view.drawer : null
  const addOpen = view.addOpen && !addClosed
  const nicheOpen = view.nicheEditorOpen && !nicheClosed
  const drawerModal = !!drawer && !wide
  const anyModal = addOpen || nicheOpen || !!confirm || drawerModal

  // Focus the drawer's close button when it opens (canais.html openDrawer).
  useEffect(() => { if (drawer) closeRef.current?.focus() }, [drawer?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rowButton = (id: string) => document.querySelector<HTMLElement>(`[data-obs-screen="canais"] .nmbtn[data-open="${CSS.escape(id)}"]`)
  const openDrawer = (id: string) => { returnFocus.current = rowButton(id); setMenu(null); go({ channel: id, tab: null }) }
  const closeDrawer = useCallback(() => {
    if (!drawer) return
    const id = drawer.id
    setClosedDrawer(id)
    go({ channel: null, tab: null })
    const t = returnFocus.current && returnFocus.current.isConnected ? returnFocus.current : rowButton(id)
    requestAnimationFrame(() => (t ?? rowButton(id))?.focus())
    t?.focus()
  }, [drawer, go])
  const closeAdd = () => { setAddClosed(true); go({ add: null }) }
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
      if (drawer) closeDrawer()
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

  const rowOf = useCallback((id: string) => view.rows.find(r => r.id === id) ?? view.groups.flatMap(g => g.rows).find(r => r.id === id) ?? null, [view])

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
    let ok = false
    try { ok = (await (r.own ? onSetOwnNiche : onSetNiche)(r.id, n)).ok } catch { ok = false }
    if (nicheSeq.current[r.id] === seq) {
      if (ok) setPending(cur => ({ ...cur, [r.id]: { niche: n, busy: false } }))
      else setPending(cur => Object.fromEntries(Object.entries(cur).filter(([id]) => id !== r.id)))
    }
    if (!ok) { toast('bad', 'Não deu para mudar o nicho', r.niche ? `${r.name} continua no nicho anterior.` : `${r.name} continua sem nicho.`); return }
    const NLn = n === 'ia' ? 'IA' : 'Viagem'
    const left = view.niche !== 'todos' && view.niche !== n
    toast('ok', r.own ? `Nicho de ${r.name} definido como ${NLn}` : `Nicho de ${r.name} alterado para ${NLn}`, left ? `Ele saiu do filtro ${view.nicheLabel}.` : '')
    // the channel left the filter and its drawer is the open one: close it
    if (left && drawer?.id === r.id) { setClosedDrawer(r.id); go({ channel: null, tab: null }) }
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
    const r = rowOf(id) ?? (drawer?.id === id ? { name: drawer.name } : null); if (!r) return
    returnFocus.current = from ?? document.activeElement as HTMLElement | null
    setMenu(null); setConfirm({ id, name: r.name })
  }
  const doRemove = async () => {
    if (!confirm) return
    const { id, name } = confirm
    setConfirm(null)
    const res = await onRemove(id)
    if (!res.ok) { toast('bad', 'Não deu para remover o canal', `${name} continua no observatório.`); return }
    toast('ok', `${name} removido`, 'O canal saiu do observatório e os dados coletados dele foram apagados.')
    if (drawer?.id === id) { setClosedDrawer(id); go({ channel: null, tab: null }) }
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
    : view.filter === 'problemas' ? <>{view.emptyText} <Link className="btn small link" href={view.problems.clearHref}>Mostrar todos</Link></> : view.emptyLink ? <>{view.emptyText.slice(0, view.emptyText.lastIndexOf(view.emptyLink.text))}<Link className="inl" href={view.emptyLink.href}>{view.emptyLink.text}</Link>.</> : <>{view.emptyText}</>

  const h: RowHandlers = {
    open: openDrawer, niche: (r, n, ctx) => { void setNiche(r, n, ctx) },
    menu: id => { if (menu === id) closeMenu(true); else setMenu(id) },
    retry: id => { void syncOne(id) }, remove: askRemove, local: id => local[id], roundRunning: running, upnextHref: UPNEXT, menuFor: menu, selected: drawer?.id ?? null,
  }
  const onSort = (k: CanaisSort) => go({ sort: k === 'active' && view.sort !== 'active' ? null : k, dir: view.sort === k ? (view.dir === 'desc' ? 'asc' : null) : null })
  const seg = (key: 'fmt' | 'scale' | 'layout', val: string, dflt: string) => go({ [key]: val === dflt ? null : val })

  const menuRow = menu ? rowOf(menu) : null

  const s = view.slots, full = s.free === 0
  return (
    <NichePendingContext.Provider value={pending}>
    <div data-obs-screen="canais" className={drawer ? 'drawer-open' : undefined}>
      <div className="cn-page">
        <div className={'wrap' + (view.layout === 'cards' ? ' view-cards' : '')} inert={anyModal || undefined}>
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
              <button type="button" aria-pressed={view.fmt === 'long'} onClick={() => seg('fmt', 'long', 'long')}>Longos</button>
              <button type="button" aria-pressed={view.fmt === 'short'} onClick={() => seg('fmt', 'short', 'long')}>Shorts</button>
            </div>
            <div className="seg" role="group" aria-label="Escala de views/dia">
              <button type="button" aria-pressed={view.scale === 'abs'} onClick={() => seg('scale', 'abs', 'per-mil')}>Absoluto</button>
              <button type="button" aria-pressed={view.scale === 'per-mil'} onClick={() => seg('scale', 'per-mil', 'per-mil')}>Por mil inscritos</button>
            </div>
            <div className="seg" role="group" aria-label="Visualização">
              <button type="button" aria-pressed={view.layout === 'table'} onClick={() => seg('layout', 'table', 'table')}>Tabela</button>
              <button type="button" aria-pressed={view.layout === 'cards'} onClick={() => seg('layout', 'cards', 'table')}>Cards</button>
            </div>
            <label className="cardsort"><span className="sr">Ordenar cards por</span>
              <select className="sel" name="cardSort" value={view.sort} onChange={e => go({ sort: e.target.value === 'active' ? null : e.target.value, dir: null })}>
                <option value="active">Ritmo</option><option value="vpd">Views/dia</option><option value="outliers">Outliers</option><option value="swaps">Trocas</option><option value="growth">Crescimento</option>
              </select>
            </label>
          </div>
          <div className="toolbar2">
            <span className="sortnote" aria-live="polite">{view.sortNote}</span>
            <span>
              {view.filter === 'problemas'
                ? <span className="chip">Só canais com problema ({view.problems.n}) <Link className="btn small link" href={view.problems.clearHref}>Mostrar todos</Link></span>
                : view.problems.n ? <Link className="btn small link" href={view.problems.filterHref}>Ver só canais com problema ({view.problems.n})</Link> : null}
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
              <Link className="btn primary btn-primary" href={urlWith({ add: '1' })} scroll={false} onClick={() => setAddClosed(false)}><Ic n="plus" />Adicionar canal</Link>
            )}
          </div>

          {view.layout === 'table'
            ? <ChannelTable view={view} own={view.own} groups={groups} h={h} onSort={onSort} empty={empty} />
            : <ChannelCards view={view} own={view.own} groups={groups} h={h} empty={empty} />}

          <div className="legend">
            <span><i aria-hidden="true" /> vídeo longo</span>
            <span><i className="s" aria-hidden="true" /> Short</span>
            <span><i className="e" aria-hidden="true" /> semana sem upload</span>
            <span>Outlier: <span><b className="mult mid num">{view.legend.mid}</b> <b className="mult high num">{view.legend.high}</b> <b className="mult top num">{view.legend.top}</b></span> contra os outros vídeos do canal na mesma idade, sem contar o próprio vídeo; abaixo de 2× aparece só como “a mediana”</span>
          </div>
        </div>

        {drawer ? (
          <>
            {drawerModal ? <button type="button" className="cn-backdrop" aria-label="Fechar detalhes do canal" tabIndex={-1} onClick={closeDrawer} /> : null}
            <ChannelDrawer d={drawer} modal={drawerModal} upnextHref={UPNEXT} onClose={closeDrawer} closeRef={closeRef} trap={trapTab}
              onRemove={from => askRemove(drawer.id, from)} onNiche={n => { void setNiche({ id: drawer.id, name: drawer.name, own: drawer.own, niche: drawer.niche }, n, 'drawer') }}
              forjaSlot={view.drawerForja && view.drawerForja.niche === drawer.niche ? <DrawerForjaBox f={view.drawerForja} /> : null}
              forjaFootSlot={view.drawerForja && view.drawerForja.niche === drawer.niche ? <DrawerForjaFoot f={view.drawerForja} onAsk={onAskForja} /> : null} />
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

      {confirm ? (
        <div className="modal on" role="dialog" aria-modal="true" aria-labelledby="cn-cfT" onKeyDown={trapTab}>
          <div className="box">
            <h4 id="cn-cfT">Remover {confirm.name}?</h4>
            <p>O canal sai do observatório e para de sincronizar. Os vídeos, as versões de título, thumbnail e descrição e as views diárias já coletados dele são apagados.</p>
            <p>Não dá para desfazer. Se adicionar de novo, a coleta recomeça do zero.</p>
            <div className="acts">
              <button type="button" className="btn" autoFocus onClick={closeConfirm}>Cancelar</button>
              <button type="button" className="btn danger" onClick={() => { void doRemove() }}>Remover canal</button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <AddChannelForm view={view} onAdd={onAdd} onClose={closeAdd} trap={trapTab}
          onAdded={(input, title) => { closeAdd(); toast('ok', 'Canal adicionado', `${title ?? input.channel} entrou em ${input.niche === 'ia' ? 'IA' : 'Viagem'}; a busca dos vídeos começou.`); router.refresh() }} />
      ) : null}

      {nicheOpen ? (
        <NicheEditorDialog rows={view.nicheRows} onNiche={(r, n) => { void setNiche({ ...r, own: false }, n, 'editor') }} onClose={closeNiche} trap={trapTab} />
      ) : null}
    </div>
    </NichePendingContext.Provider>
  )
}
