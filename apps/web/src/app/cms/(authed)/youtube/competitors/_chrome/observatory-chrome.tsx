'use client'
/**
 * The Observatório chrome (port of chrome.js mount/headHtml/navHtml): title, subtitle, actions (no filled button),
 * freshness line, tabs with counts, niche bar, menu ⋯ and toasts. Each page wraps its screen with it; the screen
 * starts 16 px below the tabs (D8). Server actions arrive as props (never imported here).
 */
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { ChromeView, SyncNowResult } from './view-model'
import { Freshness } from './freshness'
import { Tabs } from './tabs'
import { NicheBar } from './niche-bar'
import { Menu } from './menu'
import { ToastProvider, useToast } from './toasts'
import { Icon } from './icons'

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

function ChromeInner({ view, children, onSetNiche, onSyncNow, dropNicheParam, onOpenNicheEditor }: ObservatoryChromeProps) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const toast = useToast()
  const [pop, setPop] = useState<Pop>(null)
  const [menuAt, setMenuAt] = useState<'first' | 'last'>('first')
  const [pendingNiche, setPendingNiche] = useState<NicheScope | null>(null)
  const [syncing, setSyncing] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null), freshBtn = useRef<HTMLButtonElement>(null)
  const menuBox = useRef<HTMLDivElement>(null), freshBox = useRef<HTMLDivElement>(null)

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
    if (onSetNiche) await onSetNiche(n)
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

  const niches = view.niches
  return (
    <div className="obs-ch-content" onKeyDown={onKey}>
      <div data-obs-chrome="">
        <div className="obs-ch-head">
          <div className="obs-ch-title"><h2>{view.title}</h2><p>{view.subtitle}</p></div>
          <div className="obs-ch-actions">
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
              onClose={close} onCopy={copy}
            />
          </div>
        </div>
        <Freshness
          fresh={view.fresh} tzLabel={view.tzLabel} open={pop === 'fresh'} btnRef={freshBtn} boxRef={freshBox}
          onToggle={() => setPop(p => (p === 'fresh' ? null : 'fresh'))} onSync={() => sync(true)} syncing={syncing}
        />
        <div className="obs-ch-nav">
          <Tabs tabs={view.tabs} />
          <NicheBar niches={niches} pending={pendingNiche} onPick={pickNiche} />
        </div>
      </div>
      <div className="obs-ch-screen">{children}</div>
    </div>
  )
}
