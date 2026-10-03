'use client'
/**
 * The Observatório chrome (port of chrome.js mount/headHtml/navHtml): title, subtitle, actions (no filled button),
 * freshness line, tabs with counts, niche bar, menu ⋯ and toasts. Each page wraps its screen with it; the screen
 * starts 16 px below the tabs (D8). Server actions arrive as props (never imported here).
 */
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { ChromeView, SyncNowResult } from './view-model'
import { Freshness } from './freshness'
import { Tabs } from './tabs'
import { NicheBar } from './niche-bar'
import { Menu } from './menu'
import { ToastProvider, useToast } from './toasts'
import { ChromeSyncContext } from './sync-context'
import { Icon } from './icons'
import type { ForjaDrawerView } from './forja-view-model'
import { ForjaHeaderButtons, ForjaMachineSegment, goToForjaAnchor } from './forja-status'
import { ForjaDrawer, type DrawerFlow, type ForjaAsk, type ForjaCancel } from './forja-drawer'

export interface ObservatoryChromeProps {
  view: ChromeView
  children: ReactNode
  /** Persists the niche (server action setUserNiche). */
  onSetNiche?: (n: NicheScope) => Promise<{ ok: boolean }>
  /** "Sincronizar concorrentes" (server action syncCompetitorsNow). */
  onSyncNow?: () => Promise<SyncNowResult>
  /** The URL had an invalid ?niche=: it is ignored and removed with router.replace. */
  dropNicheParam?: boolean
  /** Opens the per-channel niche editor (Task 23); without it the menu item links to Canais. */
  onOpenNicheEditor?: () => void
  /** The forja drawer (Task 35) and its server actions (askForjaReading / cancelForjaReading). */
  forjaDrawer?: ForjaDrawerView | null
  onAskForja?: ForjaAsk
  onCancelForja?: ForjaCancel
  /** Insights: the shown reading as plain text ("Copiar texto da leitura" in the menu). */
  readingCopy?: string | null
}

export function ObservatoryChrome(props: ObservatoryChromeProps) {
  return (
    <div data-obs="" className="obs-ch-root">
      <ToastProvider>
        <ChromeInner {...props} />
      </ToastProvider>
    </div>
  )
}

type Pop = null | 'menu' | 'fresh'

/** ≥ 1280 px the drawer is a column; below, a modal (moldura-forja.html, CHROME.drawer). */
function useModalDrawer(): boolean {
  const [modal, setModal] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 1279px)')
    const on = () => setModal(mq.matches)
    on(); mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return modal
}

/** Minutes between refreshes while a forja request is in progress (the forja polls every 10 min). */
const FORJA_REFRESH_MS = 60_000

function ChromeInner({ view, children, onSetNiche, onSyncNow, dropNicheParam, onOpenNicheEditor, forjaDrawer, onAskForja, onCancelForja, readingCopy }: ObservatoryChromeProps) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const toast = useToast()
  const [pop, setPop] = useState<Pop>(null)
  const [menuAt, setMenuAt] = useState<'first' | 'last'>('first')
  const [pendingNiche, setPendingNiche] = useState<NicheScope | null>(null)
  const [syncing, setSyncing] = useState(false)
  const syncCtx = useMemo(() => ({ running: syncing }), [syncing])
  const menuBtn = useRef<HTMLButtonElement>(null), freshBtn = useRef<HTMLButtonElement>(null)
  const menuBox = useRef<HTMLDivElement>(null), freshBox = useRef<HTMLDivElement>(null)
  const forja = view.forja
  const modal = useModalDrawer()
  const [drawer, setDrawer] = useState<DrawerFlow | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const openDrawer = useCallback((flow: DrawerFlow) => {
    const ae = document.activeElement
    opener.current = ae instanceof HTMLElement && ae !== document.body && !ae.closest('#obs-forja-drawer') ? ae : null
    setPop(null); setDrawer(flow)
  }, [])
  const closeDrawer = useCallback(() => {
    setDrawer(null)
    // the redraw may replace the opener: fall back to the forja button or the status
    setTimeout(() => {
      const b = [opener.current && opener.current.isConnected ? opener.current : null, document.querySelector<HTMLElement>('[data-ck="forja-ask"]'), document.querySelector<HTMLElement>('[data-ck="forja"]')]
        .find((x): x is HTMLElement => !!x && !(x as HTMLButtonElement).disabled)
      b?.focus()
    }, 0)
  }, [])
  // while a request is in progress the page refreshes itself (the forja polls every 10 min); a request that reaches
  // "publicado" says so once ("Pedido enviado à forja" → "Leitura publicada")
  const active = !!forja?.status?.active
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => router.refresh(), FORJA_REFRESH_MS)
    return () => clearInterval(t)
  }, [active, router])
  const prevActive = useRef(active)
  useEffect(() => {
    if (prevActive.current && forja?.status && !forja.status.active && /publicad/.test(forja.status.text) && !forja.status.warn) toast('ok', 'Leitura publicada', forja.typeLabel)
    prevActive.current = active
  }, [active, forja, toast])

  // The server already rendered the new niche: drop the optimistic one.
  useEffect(() => { setPendingNiche(null) }, [view.niche])

  const urlWith = useCallback((key: string, val: string | null) => {
    const q = new URLSearchParams(search?.toString() ?? '')
    if (val == null) q.delete(key); else q.set(key, val)
    const s = q.toString()
    return pathname + (s ? '?' + s : '')
  }, [pathname, search])

  // Invalid ?niche= is ignored (the server used the persisted one) and leaves the URL, so it never wins on reload.
  useEffect(() => { if (dropNicheParam) router.replace(urlWith('niche', null), { scroll: false }) }, [dropNicheParam, router, urlWith])

  const close = useCallback((focusBack: boolean) => {
    const was = pop
    setPop(null)
    if (focusBack) (was === 'menu' ? menuBtn : freshBtn).current?.focus()
  }, [pop])

  // Click outside and focus leaving the open box close it (CHROME.md "Acessibilidade do chrome").
  useEffect(() => {
    if (!pop) return
    const box = () => (pop === 'menu' ? menuBox : freshBox).current
    const onDown = (e: MouseEvent) => { const b = box(); if (b && !b.contains(e.target as Node)) setPop(null) }
    const onFocus = (e: FocusEvent) => { const b = box(); if (b && e.target instanceof Node && !b.contains(e.target)) setPop(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('focusin', onFocus)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('focusin', onFocus) }
  }, [pop])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && pop) { e.stopPropagation(); close(true) }
  }

  const pickNiche = async (n: NicheScope) => {
    setPop(null)
    if (n === (pendingNiche ?? view.niche)) return
    setPendingNiche(n)
    if (onSetNiche) {
      const r = await onSetNiche(n).catch(() => ({ ok: false }))
      if (!r.ok) toast('warn', 'Não deu para salvar o nicho', 'O nicho mudou só nesta tela; nas outras abas continua o que estava salvo.')
    }
    router.replace(urlWith('niche', n), { scroll: false })
  }

  const sync = async (fromPop: boolean) => {
    if (syncing) return
    setPop(null)
    if (fromPop) freshBtn.current?.focus()
    if (!onSyncNow) return
    setSyncing(true)
    toast('', 'Sincronização iniciada', `${view.fresh.inRound} ${view.fresh.inRound === 1 ? 'canal' : 'canais'} na fila de sincronização.`)
    try {
      const res = await onSyncNow()
      if (res.toast) toast(res.toast.kind, res.toast.title, res.toast.body, { more: res.toast.more || undefined })
      else toast(res.ok ? 'ok' : 'warn', res.ok ? 'Concorrentes sincronizados' : 'Não deu para sincronizar', res.text)
      router.refresh()
    } catch {
      toast('bad', 'Não deu para sincronizar', 'A sincronização não respondeu. Tente de novo em alguns minutos.')
    } finally {
      setSyncing(false)
    }
  }

  const copy = async () => {
    const text = view.cowork
    close(true)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sem área de transferência')
      await navigator.clipboard.writeText(text)
      toast('ok', 'Pedido copiado para o Cowork', 'Cole no Cowork com ⌘V.')
    } catch {
      toast('warn', 'Não deu para copiar', 'O navegador bloqueou a área de transferência. Selecione o texto abaixo e copie com ⌘C.', { selectable: text })
    }
  }

  const copyReading = async () => {
    const text = readingCopy ?? ''
    close(true)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sem área de transferência')
      await navigator.clipboard.writeText(text)
      toast('ok', 'Texto da leitura copiado', '')
    } catch {
      toast('bad', 'Não deu para copiar', 'O navegador bloqueou a área de transferência. Selecione o texto abaixo e copie com ⌘C.', { selectable: text })
    }
  }

  const niches = view.niches
  const drawerEl = drawer && forjaDrawer ? (
    <ForjaDrawer d={forjaDrawer} flow0={drawer} modal={modal} onClose={closeDrawer} onAsk={onAskForja} onCancel={onCancelForja}
      pre={forja ? { type: forja.type, niche: forja.ask?.scope ?? forja.niche } : null} />
  ) : null
  return (
    <div className={'obs-ch-page' + (drawerEl ? ' obs-ch-with-drawer' : '')}>
    <div className="obs-ch-content" onKeyDown={onKey} inert={drawerEl && modal ? true : undefined}>
      <div data-obs-chrome="">
        <div className="obs-ch-head">
          <div className="obs-ch-title"><h2>{view.title}</h2><p>{view.subtitle}</p></div>
          <div className="obs-ch-actions">
            {forja ? <ForjaHeaderButtons forja={forja} drawerOpen={!!drawer} modal={modal && !!forjaDrawer} onOpen={() => (forjaDrawer ? openDrawer(forja.status?.active && forja.button.mode !== 'free-niche' ? 'run' : 'choose') : goToForjaAnchor())} onStatus={goToForjaAnchor} /> : null}
            <button className="obs-ch-btn" type="button" title="Sincronizar concorrentes" aria-disabled={syncing || undefined} onClick={() => sync(false)}>
              {Icon.sync()}<span className="obs-ch-lbl-t">Sincronizar concorrentes</span>
            </button>
            <Link className="obs-ch-btn" href={view.addHref} title="Adicionar canal">
              {Icon.plus()}<span className="obs-ch-lbl-t">Adicionar canal</span>
            </Link>
            <Menu
              open={pop === 'menu'} focusAt={menuAt} btnRef={menuBtn} boxRef={menuBox}
              cowork={view.cowork} nicheEditorHref={view.nicheEditorHref} onOpenNicheEditor={onOpenNicheEditor}
              onToggle={() => { setMenuAt('first'); setPop(p => (p === 'menu' ? null : 'menu')) }}
              onOpenAt={at => { setMenuAt(at); setPop('menu') }}
              onClose={close} onCopy={copy} onCopyReading={readingCopy ? copyReading : undefined}
            />
          </div>
        </div>
        <Freshness
          fresh={view.fresh} tzLabel={view.tzLabel} open={pop === 'fresh'} btnRef={freshBtn} boxRef={freshBox}
          onToggle={() => setPop(p => (p === 'fresh' ? null : 'fresh'))} onSync={() => sync(true)} syncing={syncing}
          forjaSeg={forja ? <ForjaMachineSegment machine={forja.machine} /> : null}
        />
        <div className="obs-ch-nav">
          <Tabs tabs={view.tabs} />
          <NicheBar niches={niches} pending={pendingNiche} onPick={pickNiche} />
        </div>
      </div>
      <div className="obs-ch-screen"><ChromeSyncContext.Provider value={syncCtx}>{children}</ChromeSyncContext.Provider></div>
    </div>
    {drawerEl && modal ? <div className="obs-ch-backdrop" aria-hidden="true" onClick={closeDrawer} /> : null}
    {drawerEl}
    </div>
  )
}
