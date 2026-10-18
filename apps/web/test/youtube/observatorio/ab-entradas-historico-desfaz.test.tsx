// @vitest-environment jsdom
// Yannis I1: com 7 trocas ou mais o Histórico lista uma linha por troca; a linha que DESFAZ outra (A→B→A) não leva entrada do A/B.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { loadFase4, VID } from './fase4-world'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { valorAbEntradas } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams('from=mudancas'),
}))
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const { ds } = loadFase4(), obs = createObservatory(ds)
const BLOB = 'https://x.public.blob.vercel-storage.com/observatorio/thumbs/'

describe('Histórico em modo lista: troca que desfaz outra', () => {
  it('a linha que desfaz não tem botão nem frase; a que não desfaz tem botão com a imagem dela', () => {
    const view = buildHistoricoView(obs, VID.many, { range: 'tudo' })
    expect(view.compare.mode).toBe('list')
    const thumbs = view.comparisons.filter(c => c.field === 'thumb')
    const desfeitas = thumbs.filter(c => c.depoisDesfaz)
    const normais = thumbs.filter(c => !c.depoisDesfaz)
    expect(desfeitas.length).toBeGreaterThan(0)
    expect(normais.length).toBeGreaterThan(0)
    // o fixture não tem Blob: dá uma imagem arquivada às que não desfazem, para o botão existir
    const comImagem = { ...view, comparisons: view.comparisons.map(c => (c.field === 'thumb' ? { ...c, depoisThumb: BLOB + 'x/' + c.changeId.replace(/\W/g, '') + '.jpg' } : c)) }
    const r = render(<ToastProvider><AbEntradasProvider valor={valorAbEntradas({ podeEditar: true, abertos: null })}><HistoricoScreen view={comImagem} /></AbEntradasProvider></ToastProvider>)
    const escolhe = (k: string) => fireEvent.click(r.container.querySelector<HTMLElement>(`li[data-k="${k}"]`)!)
    escolhe(desfeitas[0]!.changeId)
    expect(r.container.querySelector('.hv-ab a')).toBeNull()
    expect(r.container.querySelector('.hv-ab-sem')).toBeNull()
    escolhe(normais[0]!.changeId)
    expect(r.container.querySelector('.hv-ab a')).not.toBeNull()
  })
})
