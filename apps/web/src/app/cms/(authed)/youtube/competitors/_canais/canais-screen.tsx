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
import type { ForjaAsk } from '../_chrome/forja-drawer'
import { AddChannelForm, type AddFn } from './add-channel-form'
import { NicheEditorDialog } from './niche-editor'
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

export function CanaisScreen({ view, canUnlock, onAdd, onRemove, onUnlock, onSetNiche, onSyncOne, onAskForja }: CanaisScreenProps) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const toast = useToast()
  const wide = useWide()
  const { running } = useChromeSync()
  const [q, setQ] = useState(search?.get('q') ?? '')
  const [closedDrawer, setClosedDrawer] = useState<string | null>(null)
  const [addClosed, setAddClosed] = useState(false)
  const [nicheClosed, setNicheClosed] = useState(false)
  const [menu, setMenu] = useState<null | { id: string; top: number; left: number }>(null)
  const [confirm, setConfirm] = useState<null | { id: string; name: string }>(null)
  const [local, setLocal] = useState<Record<string, LocalSync>>({})
  const menuTrigger = useRef<HTMLElement | null>(null), returnFocus = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null), menuRef = useRef<HTMLDivElement>(null)

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
  const closeMenu = (focus: boolean) => { setMenu(null); if (focus) menuTrigger.current?.focus() }
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
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-menu]')) setMenu(null) }
    document.addEventListener('mousedown', onDown)
    menuRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  const rowOf = useCallback((id: string) => view.rows.find(r => r.id === id) ?? view.groups.flatMap(g => g.rows).find(r => r.id === id) ?? null, [view])

  const setNiche = async (r: { id: string; name: string }, n: Niche) => {
    const res = await onSetNiche(r.id, n)
    if (!res.ok) { toast('bad', 'Não deu para mudar o nicho', `${r.name} continua no nicho anterior.`); return }
    const left = view.niche !== 'todos' && view.niche !== n
    toast('ok', `Nicho de ${r.name} alterado para ${n === 'ia' ? 'IA' : 'Viagem'}`, left ? `Ele saiu do filtro ${view.nicheLabel}.` : '')
    router.refresh()
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
    : view.filter === 'problemas' ? <>{view.emptyText} <Link className="btn small link" href={view.problems.clearHref}>Mostrar todos</Link></> : <>{view.emptyText}</>

  const h: RowHandlers = {
    open: openDrawer, niche: (r, n) => { void setNiche(r, n) },
    menu: (id, btn) => {
      if (menu?.id === id) { closeMenu(true); return }
      menuTrigger.current = btn
      const rc = btn.getBoundingClientRect()
      setMenu({ id, top: Math.min(rc.bottom + 4, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260), left: Math.max(8, rc.right - 230) })
    },
    retry: id => { void syncOne(id) }, remove: askRemove, local: id => local[id], roundRunning: running, upnextHref: UPNEXT, menuFor: menu?.id ?? null, selected: drawer?.id ?? null,
  }
  const onSort = (k: CanaisSort) => go({ sort: k === 'active' && view.sort !== 'active' ? null : k, dir: view.sort === k ? (view.dir === 'desc' ? 'asc' : null) : null })
  const seg = (key: 'fmt' | 'scale' | 'layout', val: string, dflt: string) => go({ [key]: val === dflt ? null : val })

  const menuRow = menu ? rowOf(menu.id) : null
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    if (e.key === 'Tab') closeMenu(false)
  }

  const s = view.slots, full = s.free === 0
  return (
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
            ? <ChannelTable view={view} own={view.own.row} groups={groups} h={h} onSort={onSort} empty={empty} />
            : <ChannelCards view={view} own={view.own.row} groups={groups} h={h} empty={empty} />}

          <div className="legend">
            <span><i aria-hidden="true" /> vídeo longo</span>
            <span><i className="s" aria-hidden="true" /> Short</span>
            <span><i className="e" aria-hidden="true" /> semana sem upload</span>
            <span>Outlier: <span><b className="mult mid num">{view.legend.mid}</b> <b className="mult high num">{view.legend.high}</b> <b className="mult top num">{view.legend.top}</b></span> contra os outros vídeos do canal na mesma idade, sem contar o próprio vídeo; abaixo de 2× aparece só como “a mediana”</span>
            <span>{view.tzLabel}</span>
          </div>
        </div>

        {drawer ? (
          <>
            {drawerModal ? <button type="button" className="cn-backdrop" aria-label="Fechar detalhes do canal" tabIndex={-1} onClick={closeDrawer} /> : null}
            <ChannelDrawer d={drawer} modal={drawerModal} upnextHref={UPNEXT} onClose={closeDrawer} closeRef={closeRef} trap={trapTab}
              onRemove={from => askRemove(drawer.id, from)} onNiche={n => { void setNiche({ id: drawer.id, name: drawer.name }, n) }}
              forjaSlot={view.drawerForja && view.drawerForja.niche === drawer.niche ? <DrawerForjaBox f={view.drawerForja} /> : null}
              forjaFootSlot={view.drawerForja && view.drawerForja.niche === drawer.niche ? <DrawerForjaFoot f={view.drawerForja} onAsk={onAskForja} /> : null} />
          </>
        ) : null}
      </div>

      {menu && menuRow ? (
        <div className="menu on" role="menu" aria-label="Ações do canal" ref={menuRef} style={{ top: menu.top, left: menu.left }} onKeyDown={onMenuKey}>
          <button type="button" role="menuitem" onClick={() => openDrawer(menuRow.id)}>Abrir detalhes</button>
          <button type="button" role="menuitem" disabled={menuRow.backfill} title={menuRow.backfill ? 'Ainda buscando vídeos: a sincronização só depois da busca' : undefined}
            onClick={() => { closeMenu(true); void syncOne(menuRow.id) }}>Sincronizar só este canal</button>
          <button type="button" role="menuitem" onClick={() => { closeMenu(true); window.open(menuRow.url, '_blank', 'noopener') }}>Abrir no YouTube</button>
          <button type="button" role="menuitem" onClick={() => { closeMenu(true); void copyCowork(menuRow) }}><span className="cw">Copiar pedido para o Cowork</span></button>
          <hr />
          <button type="button" role="menuitem" className="del" onClick={() => askRemove(menuRow.id, menuTrigger.current)}>Remover canal…</button>
        </div>
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
        <NicheEditorDialog rows={view.nicheRows} onNiche={(r, n) => { void setNiche(r, n) }} onClose={closeNiche} trap={trapTab} />
      ) : null}
    </div>
  )
}
