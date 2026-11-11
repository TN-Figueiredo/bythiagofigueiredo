// @vitest-environment jsdom
// A2/R2 T13: a tela Canal (vista Lista) não mostra zero falso em curtidas/comentários ocultos. Tudo pela fiação de CanalScreen.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { CanalScreen, type CanalActions } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-screen'
import { reacoesDaPromessa } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/reacoes-do-canal'
import { Tabela } from '@/app/cms/(authed)/youtube/competitors/_canal/tabela'
import { nicheOptions } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams('ver=lista'),
}))

type Sinais = { likesHidden: boolean | null; commentsDisabled: boolean | null }
type Reacoes = Promise<Record<string, Sinais> | null> | null | undefined

const act0: CanalActions = {
  onSyncOne: vi.fn(async () => ({ ok: true })), onPedir: vi.fn(async () => ({ ok: true as const, jaPedido: false })),
  onDesfazer: vi.fn(async () => ({ ok: true as const, naoPedido: false, despausado: true })),
  onApagar: vi.fn(async () => ({ ok: true as const, videos: 3 })), onRemovalImpact: vi.fn(async () => ({ ok: false as const })),
  onSetNiche: vi.fn(async () => ({ ok: true })), onPin: vi.fn(async () => ({ ok: true as const })), onUnpin: vi.fn(async () => ({ ok: true as const })),
}

/** Três vídeos do canal: A (0/0), B (12/12) e C (7/7); o resto sai. */
function mundo() {
  return canalWorld((ds: Dataset, ch) => {
    const meus = ds.videos.filter(v => v.ch === ch).slice(0, 3)
    meus.forEach((v, i) => { v.likes = [0, 12, 7][i]!; v.comments = [0, 12, 7][i]! })
    const ids = new Set(meus.map(v => v.id))
    ds.videos = ds.videos.filter(v => v.ch !== ch || ids.has(v.id))
  })
}

async function montar(reacoes: (ids: { a: string; b: string; c: string }) => Reacoes) {
  const { obs, chId } = mundo()
  window.history.replaceState(null, '', window.location.pathname + '?ver=lista')
  const view = buildCanalView(obs, chId, { ver: 'lista' })!
  const byLikes = (n: number) => view.videos.videos.find(v => v.likes === n)!
  const ids = { a: byLikes(0).id, b: byLikes(12).id, c: byLikes(7).id }
  // a promessa nasce FORA do render, fixa por caso
  const p = reacoes(ids)
  let r!: ReturnType<typeof render>
  // montar DENTRO de um act assíncrono: o `use` de promessa não rastreada suspende uma vez e o React só reabre a fronteira com o act aberto
  await act(async () => { r = render(
    <ToastProvider><div data-obs="">
      <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin leitura={null} actions={act0} reacoes={p} />
    </div></ToastProvider>,
  ) })
  return { ...r, ids, view }
}
const cel = (root: ParentNode, id: string, rotulo: 'Curtidas' | 'Comentários') =>
  (root.querySelector(`tr[data-id="${id}"] td[data-label="${rotulo}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim()
const assentar = async () => { await act(async () => { await new Promise(r => setTimeout(r, 20)) }) }

afterEach(cleanup)

describe('T13: curtidas e comentários na Lista do canal', () => {
  it('sinalizador false com 0 mostra "0"; true mostra "não medido"; ausente com 0 mostra "não medido"; 7 e 12 sempre números', async () => {
    const { container, ids } = await montar(i => Promise.resolve({
      [i.a]: { likesHidden: false, commentsDisabled: false },
      [i.b]: { likesHidden: true, commentsDisabled: true },
    }))
    await assentar()
    expect(cel(container, ids.a, 'Curtidas')).toBe('0')
    expect(cel(container, ids.a, 'Comentários')).toBe('0')
    expect(cel(container, ids.b, 'Curtidas')).toBe('não medido')
    expect(cel(container, ids.b, 'Comentários')).toBe('não medido')
    expect(cel(container, ids.c, 'Curtidas')).toBe('7')
    expect(cel(container, ids.c, 'Comentários')).toBe('7')
  })
  it('metade por metade: curtidas ocultas e comentários ligados com 0', async () => {
    const { container, ids } = await montar(i => Promise.resolve({ [i.a]: { likesHidden: true, commentsDisabled: false } }))
    await assentar()
    expect(cel(container, ids.a, 'Curtidas')).toBe('não medido')
    expect(cel(container, ids.a, 'Comentários')).toBe('0')
  })
  it('reacoes nulo: 0 vira "não medido", positivo segue número', async () => {
    const { container, ids } = await montar(() => null)
    await assentar()
    expect(cel(container, ids.a, 'Curtidas')).toBe('não medido')
    expect(cel(container, ids.a, 'Comentários')).toBe('não medido')
    expect(cel(container, ids.b, 'Curtidas')).toBe('12')
    expect(cel(container, ids.c, 'Comentários')).toBe('7')
  })
  it('(a) pendente: 0 não mostra "0" nem "não medido", diz "lendo"; positivo mostra o texto', async () => {
    const { container, ids } = await montar(() => new Promise<never>(() => {}))
    await assentar()
    const t = cel(container, ids.a, 'Curtidas')
    expect(t).toContain('lendo')
    expect(t).not.toContain('não medido')
    expect(t.replace('lendo', '').trim()).not.toBe('0')
    expect(cel(container, ids.b, 'Curtidas')).toBe('12')
  })
  it('(b) promessa rejeitada: "não medido" para 0, sem erro de tela', async () => {
    const rej = Promise.reject(new Error('x'))
    const { container, ids } = await montar(i => reacoesDaPromessa(rej, [{ id: i.a, likes: 0, comments: 0 }]))
    await assentar()
    expect(cel(container, ids.a, 'Curtidas')).toBe('não medido')
    expect(cel(container, ids.c, 'Curtidas')).toBe('7')
  })
  it('(c) canal próprio, sem reacoes: o que mostra hoje (likesText, mesmo com 0)', () => {
    const { obs, chId } = mundo()
    const view = buildCanalView(obs, chId, { ver: 'lista' })!
    const a = view.videos.videos.find(v => v.likes === 0)!
    const { container } = render(<Tabela lista={{ secoes: [{ divisor: null, itens: [a] }] } as never} state={view.state} nome="x" hrefDe={() => '#'} onSort={() => {}} onAmpliar={() => {}} onTrocas={() => {}} proprio />)
    expect(cel(container, a.id, 'Curtidas')).toBe('0')
  })
  it('(d) o id do vídeo, não o ytId, casa a exceção', async () => {
    const { container, ids, view } = await montar(i => Promise.resolve({ [i.a]: { likesHidden: false, commentsDisabled: null } }))
    await assentar()
    const a = view.videos.videos.find(v => v.id === ids.a)!
    expect(a.ytId).not.toBe(a.id)
    expect(cel(container, ids.a, 'Curtidas')).toBe('0')
    expect(cel(container, ids.a, 'Comentários')).toBe('não medido')
  })
})
