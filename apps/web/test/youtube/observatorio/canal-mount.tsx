// Montagem compartilhada dos testes da vista Capas da página do canal (Tarefa 5). Os `vi.mock` ficam em cada teste.
import { vi } from 'vitest'
import { render } from '@testing-library/react'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { CanalScreen, type CanalActions } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-screen'
import { nicheOptions } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

export function canalActions(over: Partial<CanalActions> = {}): CanalActions {
  return {
    onSyncOne: vi.fn(async (_id: string) => ({ ok: true })),
    onRemove: vi.fn(async (_id: string) => ({ ok: true })),
    onRemovalImpact: vi.fn(async (_id: string) => ({ ok: false as const })),
    onSetNiche: vi.fn(async (_id: string, _n: string | null) => ({ ok: true })),
    onPin: vi.fn(async () => ({ ok: true as const })),
    onUnpin: vi.fn(async () => ({ ok: true as const })),
    ...over,
  }
}

export function mountCanal(o: { mut?: (ds: Dataset, id: string) => void; sp?: Record<string, string | undefined>; act?: CanalActions } = {}) {
  const { obs, chId } = canalWorld(o.mut)
  const view = buildCanalView(obs, chId, o.sp ?? {})!
  const act = o.act ?? canalActions()
  const r = render(
    <ToastProvider><div data-obs="">
      <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin leitura={null} actions={act} />
    </div></ToastProvider>,
  )
  return { ...r, view, act, obs, chId, all: view.videos.videos }
}

/** Deixa só `n` vídeos antigos (fora dos acompanhados) no canal: 120 acompanhados + n. */
export function comAntigos(n: number): (ds: Dataset, id: string) => void {
  return (ds, id) => { let k = 0; ds.videos = ds.videos.filter(v => v.ch !== id || v.tracked || ++k <= n) }
}

export const cartoes = (root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>('ul.cv-grid > li.cv-card')]
export const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s ]+/g, ' ').trim()
