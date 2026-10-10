'use client'
/**
 * A página do canal do concorrente (spec 5). Nesta tarefa: o cabeçalho, a faixa de aviso de sincronização e o diálogo de
 * remoção. As abas e a grade de vídeos entram nas tarefas seguintes. Server actions chegam por props (`actions`); nenhum
 * `Link` chega de um Server Component.
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Niche } from '@/lib/youtube/observatorio/niche'
import { link } from '@/lib/youtube/observatorio/links'
import type { syncCompetitorNow, removeCompetitorChannel, getCompetitorRemovalImpactAction } from '../actions'
import type { setChannelNiche } from '../niche-actions'
import { Icon } from '../_chrome/icons'
import type { PinAction } from '../_chrome/pin-kit'
import { useToast } from '../_chrome/toasts'
import { RemoveDialog } from '../_canais/remove-dialog'
import { NicheOptionsContext, NichePendingContext, type NichePending } from '../_canais/niche-editor'
import type { NicheOption } from '../_canais/view-model'
import { CanalHeader } from './canal-header'
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

export function CanalScreen({ view, niches, canAdmin, actions }: { view: CanalView; niches: NicheOption[]; canAdmin: boolean; leitura: ReactNode | null; actions: CanalActions }) {
  const router = useRouter(), toast = useToast()
  const h = view.header
  const [nums, setNums] = useState(view.state.nums)
  const [syncing, setSyncing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)

  /** "Todos os números" põe nums=1 na URL SEM navegar (replaceState): o servidor não relê, e o resto da URL (from, back…) fica. */
  const toggleNums = () => {
    const next = !nums
    setNums(next)
    try {
      const q = new URLSearchParams(window.location.search)
      if (next) q.set('nums', '1'); else q.delete('nums')
      const s = q.toString()
      window.history.replaceState(null, '', window.location.pathname + (s ? '?' + s : ''))
    } catch { /* a URL é conforto; o estado na tela já mudou */ }
  }

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
          {confirm ? <RemoveDialog id={h.id} name={h.name} onImpact={actions.onRemovalImpact} onCancel={closeConfirm} onConfirm={() => { void doRemove() }} trap={trapTab} /> : null}
        </div>
      </NichePendingContext.Provider>
    </NicheOptionsContext.Provider>
  )
}
