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
import type { ForjaAsk } from './forja-view-model'
import { ForjaHeaderButtons, ForjaMachineSegment, goToForjaAnchor } from './forja-status'
import { ForjaHeaderContext } from './forja-context'

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
  /** The forja header's direct ask (server action askForjaReading; R58). */
  onAskForja?: ForjaAsk
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

/** Minutes between refreshes while a forja request is in progress (the forja polls every 10 min). */
const FORJA_REFRESH_MS = 60_000

function ChromeInner({ view, children, onSetNiche, onSyncNow, dropNicheParam, onOpenNicheEditor, onAskForja, readingCopy }: ObservatoryChromeProps) {
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
  // R58: the header button follows each screen's mockup (insights.html:819, canais.html:874, outliers.html:997 ask
  // directly; mudancas.html I5 opens the screen's inline confirm). The moldura's selector drawer is not ported (R59).
  const [confirmSeq, setConfirmSeq] = useState(0)
  const headerCtx = useMemo(() => ({ seq: confirmSeq }), [confirmSeq])
  const [asking, setAsking] = useState(false)
  const askFromHeader = useCallback(async () => {
    if (!forja || !forja.ask || !onAskForja || asking) return
    const NLB: Record<string, string> = { viagem: 'Viagem', ia: 'IA' }
    const fmt = forja.type === 'padroes-titulo-shorts' ? 'short' : forja.type === 'padroes-titulo' || forja.type === 'temas' ? (forja.fmt ?? 'long') : undefined
    const fail = 'A fila da forja não respondeu. Tente de novo em alguns minutos.'
    setAsking(true)
    try {
      if (forja.screen === 'canais') {
        // canais.html onForja: only the free niches, one request each, in click order
        const res = await Promise.all(forja.ask.niches.map(n => onAskForja(forja.type, n, undefined, fmt).catch(() => ({ ok: false, reason: fail, results: [] }))))
        const ok = forja.ask.niches.filter((_, i) => res[i]!.ok)
        if (!ok.length) toast('warn', 'Nada enviado: a forja recusou o pedido.', '')
        else toast('forja', ok.length > 1 ? 'Pedido enviado à forja: ' + ok.length + ' pedidos, um por nicho (' + (['viagem', 'ia'] as const).filter(x => ok.includes(x)).map(x => NLB[x]).join(' e ') + ')' : 'Pedido enviado à forja', '')
      } else {
        const r = await onAskForja(forja.type, forja.ask.scope, undefined, fmt).catch(() => ({ ok: false, reason: fail, results: [] }))
        const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
        if (!r.ok) toast(forja.screen === 'insights' ? 'warn' : '', 'Pedido não enviado', cap(r.reason ?? '').replace(/[.\s]+$/, '') + '.')
        else if (forja.screen === 'insights') {
          // insights.html askForja: "Um pedido por nicho: Viagem e IA" or "Leitura dos longos de IA", then any niche skipped
          const created = r.results.filter(x => x.ok).map(x => x.niche), skipped = r.results.filter(x => !x.ok)
          const what = created.length > 1 ? 'Um pedido por nicho: Viagem e IA' : 'Leitura dos ' + (fmt === 'short' ? 'Shorts' : 'longos') + ' de ' + NLB[created[0]!]
          toast('forja', 'Pedido enviado à forja', (what + (skipped.length ? '; ' + skipped.map(x => (x.reason ?? '').replace(/[.\s]+$/, '')).join('; ') : '')).replace(/[.\s]+$/, '') + '.')
        } else toast('forja', 'Pedido enviado à forja', '')
      }
      router.refresh()
    } finally { setAsking(false) }
  }, [forja, onAskForja, asking, toast, router])
  const onForjaHeader = () => {
    if (!forja) return
    if (forja.headerAction === 'ask') { void askFromHeader(); return }
    if (forja.headerAction === 'confirm') { setConfirmSeq(n => n + 1); return }
    goToForjaAnchor()
  }
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
  return (
    <div className="obs-ch-content" onKeyDown={onKey}>
      <div data-obs-chrome="">
        <div className="obs-ch-head">
          <div className="obs-ch-title"><h2>{view.title}</h2><p>{view.subtitle}</p></div>
          <div className="obs-ch-actions">
            {forja ? <ForjaHeaderButtons forja={forja} onOpen={onForjaHeader} onStatus={goToForjaAnchor} /> : null}
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
        <div className="obs-ch-nav" data-obs-tabs="">
          <Tabs tabs={view.tabs} />
          <NicheBar niches={niches} pending={pendingNiche} onPick={pickNiche} />
        </div>
      </div>
      <div className="obs-ch-screen"><ChromeSyncContext.Provider value={syncCtx}><ForjaHeaderContext.Provider value={headerCtx}>{children}</ForjaHeaderContext.Provider></ChromeSyncContext.Provider></div>
    </div>
  )
}
