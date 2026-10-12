// @vitest-environment node
// A4 Tarefa 9 (revisão da T8, M3): UM critério só de "o canal próprio tem vídeos" (e, portanto, página). O do spec 16.8 e da rota: vídeo guardado
// conta, com ou sem data (vídeo sem data fica fora de `obs.videos`, em `canal.undated`). Antes, a rota, o redirecionamento e a comparação
// contavam o sem data e a lista de Canais e o menu "Meu canal" não: o canal só com vídeos sem data tinha página mas o menu dizia "ainda sem página".
import { describe, it, expect, vi } from 'vitest'
import { a3World } from './a3-fixture'
import type { Dataset, UndatedVideo } from '@/lib/youtube/observatorio/types'
import { canalTemVideos, ownChannelHref } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-channels'
import { ownMenuOf } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { competitorChannelRedirect } from '@/app/cms/(authed)/youtube/competitors/_canais/legacy'
import { buildCompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { link } from '@/lib/youtube/observatorio/links'

vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))

const SEM_DATA: UndatedVideo = { id: 'u1', ytId: 'yt-u1', title: 'Sem data', url: 'https://youtu.be/yt-u1', isShort: false, dur: 600, views: 10, likes: 1, comments: 0, pinned: false, checkedAt: null }
/** O primeiro canal próprio perde os vídeos com data e ganha um sem data (`soSemData`), ou fica sem nenhum (`nenhum`). */
const mundo = (como: 'normal' | 'soSemData' | 'nenhum') => a3World((ds: Dataset) => {
  if (como === 'normal') return
  const id = ds.channels.filter(c => c.own)[0]!.id
  ds.videos = ds.videos.filter(v => v.ch !== id)
  ds.channels.find(c => c.id === id)!.undated = como === 'soSemData' ? [SEM_DATA] : []
})
const idDe = (w: ReturnType<typeof mundo>) => w.owns[0]!

describe('canalTemVideos: o critério único', () => {
  it('com vídeos datados, só com vídeos sem data: sim; sem nenhum: não; id desconhecido: não', () => {
    expect(canalTemVideos(mundo('normal').obs, idDe(mundo('normal')))).toBe(true)
    const s = mundo('soSemData')
    expect(canalTemVideos(s.obs, idDe(s))).toBe(true)
    const n = mundo('nenhum')
    expect(canalTemVideos(n.obs, idDe(n))).toBe(false)
    expect(canalTemVideos(n.obs, 'nao-existe')).toBe(false)
  })
})

describe('os cinco pontos concordam (canal próprio só com vídeo sem data TEM página)', () => {
  const w = mundo('soSemData')
  const id = idDe(w)

  it('menu "Meu canal": o item tem href para a página, não "ainda sem página"', () => {
    const item = ownMenuOf(w.obs).itens.find(i => i.id === id)!
    expect(item.href).toBe(ownChannelHref(id))
    expect(item.nota).not.toMatch(/ainda sem página/)
  })

  it('lista de Canais: a linha do bloco "Seu canal" é cheia (com "Abrir meu canal") e a linha da tabela é link para a página', () => {
    const v = buildCanaisView(w.obs, { niche: 'todos', limit: 75, fmt: 'longos' })
    const linha = v.own.block!.linhas.find(l => l.id === id)!
    expect(linha.tipo).toBe('cheia')
    const row = [...v.list.ranked, ...v.list.unranked].find(r => r.id === id)!
    expect(row.href).toBe(link.canal(id))
  })

  it('redirecionamento de ?channel=: vai para a página', () => {
    expect(() => competitorChannelRedirect(w.obs, id)).toThrow('REDIRECT ' + link.canal(id))
  })

  it('comparação: o canal tem href e não é "sem vídeos"', () => {
    const c = buildCompararPack(w.obs, () => {}).canais.find(x => x.id === id)!
    expect(c.semVideos).toBe(false)
    expect(c.href).toBe(ownChannelHref(id))
  })

  it('canal próprio SEM nenhum vídeo: nenhum dos pontos dá página (menu, lista, redirecionamento, comparação)', () => {
    const n = mundo('nenhum'), nid = idDe(n)
    expect(ownMenuOf(n.obs).itens.find(i => i.id === nid)!.href).toBeNull()
    const v = buildCanaisView(n.obs, { niche: 'todos', limit: 75, fmt: 'longos' })
    expect(v.own.block!.linhas.find(l => l.id === nid)!.tipo).toBe('fina')
    expect([...v.list.ranked, ...v.list.unranked].find(r => r.id === nid)!.href).toBeNull()
    expect(() => competitorChannelRedirect(n.obs, nid)).not.toThrow()
    const c = buildCompararPack(n.obs, () => {}).canais.find(x => x.id === nid)!
    expect(c.semVideos).toBe(true)
    expect(c.href).toBeNull()
  })
})
