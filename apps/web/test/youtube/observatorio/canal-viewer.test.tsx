// @vitest-environment jsdom
// Fase A2, tarefa 6, na página do canal: os gatilhos 5 e 6 do visualizador de thumbnail (spec 6.3), no lugar do window.open da A1.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mountCanal, cartoes, comAntigos } from './canal-mount'
import { viewerSoAtual } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/thumb-viewer-versions'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const URL0 = '/cms/youtube/competitors/canal/matt-wolfe'
beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', URL0) })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); document.querySelectorAll('.obs-tv-host').forEach(e => e.remove()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const BLOB = (id: string, i: number) => `https://x.public.blob.vercel-storage.com/${id}/${i}.jpg`
const dialog = () => screen.getByRole('dialog')
const posicao = () => dialog().querySelector('.obs-tv-pos')?.textContent ?? null
const fechar = () => { fireEvent.keyDown(document.body, { key: 'Escape' }) }
const cardOf = (id: string) => cartoes().find(c => c.dataset.id === id)!
const trocaCards = () => [...document.querySelectorAll<HTMLElement>('ul.ct-list > li.ct-card')]

/** O vídeo mais novo da lista (o primeiro cartão) ganha quatro períodos de thumbnail, A, B, A, C; o período B não tem cópia. */
const primeiro = mountCanal().all[0]!.id
cleanup()
const quatro = (ds: Dataset) => {
  const v = ds.videos.find(x => x.id === primeiro)!
  const base = v.thumbs[v.thumbs.length - 1]!
  const t0 = v.pub, DAY = 864e5
  v.thumbs = (['A', 'B', 'A', 'C'] as const).map((key, i) => ({
    ...base, id: `${v.id}/thumb/q${i}`, key, first_seen: i === 0 ? t0 : t0 + i * DAY, last_seen: i === 3 ? ds.now : t0 + (i + 1) * DAY, current: i === 3,
    prec: i === 0 ? ('publicacao' as never) : 'min', window: null, blobUrl: i === 1 ? null : BLOB(v.id, i),
  }))
}

describe('o modelo entrega o visualizador a cada vídeo', () => {
  it('ChannelVideoView.viewer: uma versão por período, a atual é a última, abre na atual; o que já está na tela vai em preview', () => {
    const { all } = mountCanal({ mut: quatro })
    const v = all.find(x => x.id === primeiro)!
    expect(v.viewer!.versions.map(x => x.label)).toEqual(['Capa A', 'Capa B', 'Capa A', 'Capa C'])
    expect(v.viewer!.start).toBe(3)
    expect(v.viewer!.title).toBe(v.title)
    expect(v.viewer!.versions[3]!.current).toBe(true)
    expect(v.viewer!.versions[3]!.youtubeId).toBe(v.ytId)
    expect(v.viewer!.versions[3]!.preview).toBe(v.thumbSrc)
    expect(v.viewer!.versions[1]!.archived).toBeNull()
    expect(v.viewer!.versions[3]!.caption).toMatch(/^Capa C \(no ar\): .+; no ar por .+$/)
  })
  it('vídeo antigo, na forma enxuta, sem versões: só a thumbnail atual', () => {
    const { all } = mountCanal({ mut: ds => { ds.videos.find(x => x.id === primeiro)!.thumbs = [] } })
    const v = all.find(x => x.id === primeiro)!
    expect(v.viewer!.versions).toHaveLength(1)
    expect(v.viewer!.start).toBe(0)
    expect(v.viewer!.versions[0]!.current).toBe(true)
    expect(v.viewer!.versions[0]!.archived).toBeNull()
    expect(v.viewer!.versions[0]!.youtubeId).toBe(v.ytId)
    expect(v.viewer!.versions[0]!.preview).toBe(v.thumbSrc)
  })
  it('vídeo antigo (grupo "antigo"): o pacote não leva versões (viewer nulo); a tela abre só a atual, com o que já mostra como preview', () => {
    const { all } = mountCanal({ mut: comAntigos(5) })
    const antigo = all.find(x => x.grupo === 'antigo')!
    expect(antigo, 'o canal de teste tem vídeos antigos').toBeTruthy()
    expect(antigo.viewer).toBeNull()
    const vw = viewerSoAtual(antigo)!
    expect(vw.versions).toHaveLength(1)
    expect(vw.start).toBe(0)
    expect(vw.title).toBe(antigo.title)
    expect(vw.versions[0]).toMatchObject({ current: true, youtubeId: antigo.ytId, preview: antigo.thumbSrc })
    // a imagem do YouTube não vira "cópia guardada"; a do Blob vira
    expect(vw.versions[0]!.archived).toBeNull()
    expect(viewerSoAtual({ title: 't', ytId: 'abc', thumbSrc: BLOB('x', 1) })!.versions[0]!.archived).toBe(BLOB('x', 1))
    expect(viewerSoAtual({ title: 't', ytId: '', thumbSrc: null })).toBeNull()
  })
  it('sem thumbnail nenhuma (sem id do YouTube e sem cópia): viewer nulo, e a lupa não aparece', () => {
    const { all } = mountCanal({ mut: ds => { const v = ds.videos.find(x => x.id === primeiro)!; v.thumbs = []; v.ytId = '' } })
    const v = all.find(x => x.id === primeiro)!
    expect(v.thumbSrc).toBeNull()
    expect(v.viewer).toBeNull()
    expect(within(cardOf(primeiro)).queryByRole('button', { name: /^Ampliar a thumbnail/ })).toBeNull()
  })
})

describe('gatilho 6: a grade e a Lista do canal', () => {
  it('a lupa do cartão abre o visualizador na thumbnail atual, com as outras versões do vídeo', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { all } = mountCanal({ mut: quatro })
    const v = all.find(x => x.id === primeiro)!
    const lupa = within(cardOf(primeiro)).getByRole('button', { name: 'Ampliar a thumbnail: ' + v.title })
    lupa.focus()
    fireEvent.click(lupa)
    expect(posicao()).toBe('Capa C · 4 de 4')
    expect(dialog().querySelector('h2')!.textContent).toBe('Thumbnail: ' + v.title)
    expect(open).not.toHaveBeenCalled()
    fechar()
    expect(document.activeElement).toBe(lupa)
  })
  it('o item "Ampliar thumbnail" do menu "Ações do vídeo" abre o mesmo visualizador e Esc devolve o foco ao botão ⋯', async () => {
    mountCanal({ mut: quatro })
    const user = userEvent.setup()
    const btn = within(cardOf(primeiro)).getByRole('button', { name: /^Ações do vídeo: / })
    await user.click(btn)
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Ampliar thumbnail' }))
    expect(posicao()).toBe('Capa C · 4 de 4')
    fechar()
    expect(document.activeElement).toBe(btn)
  })
  it('na Lista: o mesmo item do menu abre o visualizador', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    mountCanal({ mut: quatro, sp: { ver: 'lista' } })
    const user = userEvent.setup()
    const linha = [...document.querySelectorAll<HTMLElement>('tr.cv-row')].find(r => r.dataset.id === primeiro)!
    await user.click(within(linha).getByRole('button', { name: /^Ações do vídeo: / }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Ampliar thumbnail' }))
    expect(posicao()).toBe('Capa C · 4 de 4')
    expect(open).not.toHaveBeenCalled()
  })
  it('vídeo antigo (forma enxuta, sem versões): abre só com a thumbnail atual, sem Anterior nem Próxima', () => {
    mountCanal({ mut: ds => { ds.videos.find(x => x.id === primeiro)!.thumbs = [] } })
    fireEvent.click(within(cardOf(primeiro)).getByRole('button', { name: /^Ampliar a thumbnail/ }))
    expect(posicao()).toBeNull()
    expect(within(dialog()).queryByRole('button', { name: /Anterior/ })).toBeNull()
    expect(within(dialog()).getByRole('button', { name: /Comparar lado a lado/ }).getAttribute('aria-disabled')).toBe('true')
  })
  it('a imagem que já está no cartão aparece no diálogo enquanto a maior carrega (preview)', () => {
    const { all } = mountCanal({ mut: ds => { ds.videos.find(x => x.id === primeiro)!.thumbs = [] } })
    fireEvent.click(within(cardOf(primeiro)).getByRole('button', { name: /^Ampliar a thumbnail/ }))
    const img = dialog().querySelector('.obs-tv-main img')!
    expect(img.getAttribute('src')).toBe(all.find(x => x.id === primeiro)!.thumbSrc)
  })
})

describe('gatilho 5: a aba Trocas', () => {
  it('a lupa do cartão abre o visualizador na thumbnail atual do vídeo, com as versões dele', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { view } = mountCanal({ sp: { tab: 'trocas' } })
    const c0 = view.trocas!.cards[0]!
    expect(c0.viewer).not.toBeNull()
    const lupa = within(trocaCards()[0]!).getByRole('button', { name: 'Ampliar a thumbnail: ' + c0.title })
    lupa.focus()
    fireEvent.click(lupa)
    expect(dialog().querySelector('h2')!.textContent).toBe('Thumbnail: ' + c0.title)
    expect(c0.viewer!.versions.some(v => v.current)).toBe(true)
    expect(open).not.toHaveBeenCalled()
    fechar()
    expect(document.activeElement).toBe(lupa)
  })
  it('com as versões do vídeo: abre na atual e oferece as outras', () => {
    const alvo = mountCanal({ sp: { tab: 'trocas' } }).view.trocas!.cards[0]!.videoId
    cleanup()
    const mut = (ds: Dataset) => { const v = ds.videos.find(x => x.id === alvo)!; v.thumbs = v.thumbs.map((t, i) => ({ ...t, blobUrl: BLOB(alvo, i) })) }
    const { view } = mountCanal({ sp: { tab: 'trocas' }, mut })
    const c0 = view.trocas!.cards.find(c => c.videoId === alvo)!
    const n = c0.viewer!.versions.length
    expect(c0.viewer!.start).toBe(n - 1)
    fireEvent.click(within(trocaCards()[0]!).getByRole('button', { name: /^Ampliar a thumbnail: / }))
    if (n > 1) expect(posicao()).toMatch(new RegExp(` · ${n} de ${n}$`))
  })
})

describe('nenhum window.open de thumbnail sobra', () => {
  it('a fonte da página do canal não chama window.open', () => {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_canal')
    for (const f of ['canal-screen.tsx', 'trocas.tsx', 'grade.tsx', 'tabela.tsx', 'video-card.tsx', 'video-menu.tsx']) {
      expect(fs.readFileSync(path.join(dir, f), 'utf8').includes('window.open'), f).toBe(false)
    }
  })
})

describe('o gatilho some com o diálogo aberto: o foco vai para o título da aba', () => {
  it('a aba mudou pelo Voltar do navegador: Esc devolve o foco ao título da aba que está na tela', () => {
    mountCanal({ mut: quatro })
    const lupa = within(cardOf(primeiro)).getByRole('button', { name: /^Ampliar a thumbnail/ })
    lupa.focus()
    fireEvent.click(lupa)
    act(() => {
      window.history.replaceState(null, '', URL0 + '?tab=trocas')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(lupa.isConnected).toBe(false)
    fechar()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(document.getElementById('ct-h2'))
    expect(document.activeElement).not.toBe(document.body)
  })
})
