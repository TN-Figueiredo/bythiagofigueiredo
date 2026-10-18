// @vitest-environment jsdom
// T9b: "Testar uma ideia no meu canal" na aba Trocas da página do canal de concorrente (modelo real; `_canal/trocas-model.ts` não ganha campo).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { canalWorld } from './canal-fixture'
import { canalActions } from './canal-mount'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { CanalScreen } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-screen'
import { nicheOptions } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { FRASE_SEM_IMAGEM, valorAbEntradas } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/canal/matt-wolfe?tab=trocas') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

const BLOB = (id: string, i: number) => `https://x.public.blob.vercel-storage.com/observatorio/thumbs/${id}/${i}.jpg`
const comBlob = (ds: Dataset, ch: string) => { for (const v of ds.videos.filter(x => x.ch === ch)) v.thumbs.forEach((t, i) => { t.blobUrl = BLOB(v.id, i) }) }
const semBlob = (ds: Dataset, ch: string) => { for (const v of ds.videos.filter(x => x.ch === ch)) v.thumbs.forEach(t => { t.blobUrl = null }) }
const EDITOR = valorAbEntradas({ podeEditar: true, abertos: null })

function montar(mut: (ds: Dataset, ch: string) => void, valor: typeof EDITOR) {
  const { obs, chId } = canalWorld(mut)
  const view = buildCanalView(obs, chId, { tab: 'trocas' })!
  const r = render(<ToastProvider><div data-obs=""><AbEntradasProvider valor={valor}>
    <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin leitura={null} actions={canalActions()} />
  </AbEntradasProvider></div></ToastProvider>)
  const linhas = [...r.container.querySelectorAll<HTMLElement>('li.ct-sw')]
  return { ...r, view, linhas }
}
const params = (a: Element) => new URL(a.getAttribute('href')!, 'https://x').searchParams

describe('aba Trocas do canal: entrada do A/B', () => {
  it('a vista tem trocas de título e de thumbnail para provar', () => {
    const m = montar(comBlob, EDITOR)
    const campos = new Set(m.view.trocas!.cards.flatMap(c => c.trocas.map(t => t.campo)))
    expect([...campos].sort()).toEqual(['Thumbnail trocada', 'Título trocado'])
  })
  it('thumb com imagem: botão com competitorThumb = a imagem "Agora", refVideoId = o vídeo do cartão, refTroca = o id da troca', () => {
    const m = montar(comBlob, EDITOR)
    let n = 0
    for (const c of m.view.trocas!.cards) for (const t of c.trocas.filter(x => x.campo === 'Thumbnail trocada' && x.agora.thumb && !x.desfaz)) {
      const li = m.container.querySelector(`li.ct-sw[data-troca="${t.id}"]`)!
      const a = li.querySelector<HTMLAnchorElement>('a.ct-ab')!
      expect(a.textContent).toBe('Testar uma ideia no meu canal')
      expect(a.hasAttribute('target')).toBe(false)
      const p = params(a)
      expect([p.get('changeType'), p.get('competitorThumb'), p.get('refVideoId'), p.get('refTroca')]).toEqual(['thumbnail', t.agora.thumb, c.videoId, t.id])
      n++
    }
    expect(n).toBeGreaterThan(0)
  })
  it('título: botão com o título "Agora" da troca', () => {
    const m = montar(comBlob, EDITOR)
    let n = 0
    for (const c of m.view.trocas!.cards) for (const t of c.trocas.filter(x => x.campo === 'Título trocado' && !x.desfaz)) {
      const p = params(m.container.querySelector(`li.ct-sw[data-troca="${t.id}"] a.ct-ab`)!)
      expect([p.get('changeType'), p.get('competitorTitle'), p.get('refVideoId')]).toEqual(['title', t.agora.texto, c.videoId])
      n++
    }
    expect(n).toBeGreaterThan(0)
  })
  it('thumb sem imagem arquivada: a frase e nenhum botão; o título segue com botão', () => {
    const m = montar(semBlob, EDITOR)
    const sem = m.view.trocas!.cards.flatMap(c => c.trocas).filter(t => t.campo === 'Thumbnail trocada' && !t.desfaz)
    expect(sem.length).toBeGreaterThan(0)
    for (const t of sem) {
      const li = m.container.querySelector(`li.ct-sw[data-troca="${t.id}"]`)!
      expect(li.querySelector('a.ct-ab')).toBeNull()
      expect(li.querySelector('.ct-ab-sem')!.textContent).toBe(FRASE_SEM_IMAGEM)
    }
    expect(m.container.querySelectorAll('li.ct-sw a.ct-ab').length).toBeGreaterThan(0)
  })
  it('troca que desfaz outra (A→B→A): nem botão nem frase; a que foi desfeita segue com botão', () => {
    const m = montar(comBlob, EDITOR)
    const todas = m.view.trocas!.cards.flatMap(c => c.trocas)
    const desfeitas = todas.filter(t => t.desfaz)
    expect(desfeitas.length).toBeGreaterThan(0)
    for (const t of desfeitas) {
      const li = m.container.querySelector(`li.ct-sw[data-troca="${t.id}"]`)!
      expect(li.querySelector('.ct-ab, .ct-ab-sem')).toBeNull()
    }
    expect(m.container.querySelectorAll('li.ct-sw a.ct-ab').length).toBe(todas.filter(t => !t.desfaz && (t.campo === 'Título trocado' || t.agora.thumb)).length)
  })
  it('reporter (provedor null): nem botão nem frase', () => {
    const m = montar(comBlob, null)
    expect(m.linhas.length).toBeGreaterThan(0)
    expect(m.container.querySelector('.ct-ab, .ct-ab-sem')).toBeNull()
  })
  it('sem provedor (canal próprio não o tem nesta aba): nada', () => {
    const { obs, chId } = canalWorld(comBlob)
    const view = buildCanalView(obs, chId, { tab: 'trocas' })!
    const { container } = render(<ToastProvider><div data-obs=""><CanalScreen view={view} niches={nicheOptions(obs)} canAdmin leitura={null} actions={canalActions()} /></div></ToastProvider>)
    expect(container.querySelector('.ct-ab, .ct-ab-sem')).toBeNull()
  })
})
