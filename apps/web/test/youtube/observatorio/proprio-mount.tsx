// Montagem compartilhada dos testes de TELA da página do canal próprio (A4 Tarefa 8). Os `vi.mock` ficam em cada teste.
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { proprioWorld } from './proprio-fixture'
import { buildProprioView, type ProprioView } from '@/app/cms/(authed)/youtube/competitors/_proprio/view-model'
import { posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { ProprioScreen } from '@/app/cms/(authed)/youtube/competitors/_proprio/proprio-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

export type Mundo = ReturnType<typeof proprioWorld>

export const CHAVES_DO_ESTADO = ['tab', 'fmt', 'sort', 'dir', 'q', 'ver', 'n', 'video', 'nums']

/** Espelha na URL do teste o que o servidor leu (como o Next faz): a tela segue a URL quando ela diverge do estado inicial. */
export function urlDoTeste(sp: Record<string, string | undefined>): void {
  const uq = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (v !== undefined) uq.set(k, v)
  window.history.replaceState(null, '', '/cms/youtube/competitors/canal/x' + (uq.toString() ? '?' + uq.toString() : ''))
}

export function viewDe(w: Mundo, sp: Record<string, string | undefined> = {}, o: { semConcorrente?: boolean; negativa?: 'sem_direito' | 'nao_foi_possivel_conferir' | null } = {}): ProprioView {
  const { posicao, concorrenteAcima } = posicaoDoSite(w.obs, w.canalId)
  const v = buildProprioView(w.obs, w.canalId, sp, w.dados, { hoje: w.hoje, dm: w.dm, posicao, concorrenteAcima: o.semConcorrente ? null : concorrenteAcima, muitosProprios: w.obs.ownChannels().length > 1, negativa: o.negativa })
  if (!v) throw new Error('o canal devia ter página')
  return v
}

export function mountProprio(o: { world?: Mundo; sp?: Record<string, string | undefined>; comoEsta?: ReactNode; periodos?: ReactNode; origem?: ReactNode; semConcorrente?: boolean; negativa?: 'sem_direito' | 'nao_foi_possivel_conferir' | null } = {}) {
  const w = o.world ?? proprioWorld()
  const sp = o.sp ?? {}
  urlDoTeste(sp)
  const view = viewDe(w, sp, { semConcorrente: o.semConcorrente, negativa: o.negativa })
  const wrap = (v: ProprioView) => <ToastProvider><div data-obs=""><ProprioScreen view={v} comoEsta={o.comoEsta} periodos={o.periodos} origem={o.origem} /></div></ToastProvider>
  const r = render(wrap(view))
  return {
    ...r, view, w,
    /** O que o servidor faz quando só a query muda: outra view, a mesma árvore (o Next 16 não remonta). */
    rerenderCom: (nova: Record<string, string | undefined>) => { urlDoTeste(nova); const v = viewDe(w, nova, { semConcorrente: o.semConcorrente, negativa: o.negativa }); r.rerender(wrap(v)); return v },
    all: view.videos.videos,
  }
}

export const cartoes = (root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>('ul.cv-grid > li.cv-card')]
export const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s ]+/g, ' ').trim()
