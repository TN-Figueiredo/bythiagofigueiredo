// @vitest-environment node
// apps/web/test/youtube/observatorio/pin-view.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { ObsVideo, SyncState } from '@/lib/youtube/observatorio/types'
import { pinViewOf } from '@/app/cms/(authed)/youtube/competitors/_chrome/pin-view'

const UNTR = 'luke-damant-l71' // outside the tracked ones of its channel in the oracle
/** The oracle with one video changed (and, optionally, its channel's sync state). */
function withVideo(id: string, patch: Partial<ObsVideo>, sync?: SyncState) {
  const ds = datasetFromOracle(loadOracle())
  const v = ds.videos.find(x => x.id === id)!
  Object.assign(v, patch)
  if (sync) ds.channels.find(c => c.id === v.ch)!.sync.state = sync
  const obs = createObservatory(ds)
  return { obs, v: obs.video(id)!, ch: obs.channel(v.ch)! }
}

describe('pinViewOf', () => {
  it('não fixado, entre os acompanhados: nenhum selo; a dica cita o limite do canal e RULES.pinLimit', () => {
    const base = createObservatory(datasetFromOracle(loadOracle()))
    const v = base.videos.find(x => x.tracked && !base.channel(x.ch)!.own)!, ch = base.channel(v.ch)!
    const p = pinViewOf(base, v, { withOut: true })!
    expect(p).toMatchObject({ videoId: v.id, channelId: ch.id, title: v.title, pinned: false, chips: [] })
    expect(p.hint).toBe('Um vídeo fixado tem gráfico de views e conferência de título, thumbnail e descrição a cada 6 h, mesmo fora dos ' + ch.video_limit + ' mais recentes de ' + ch.name + '. Limite: ' + base.RULES.pinLimit + ' por canal.')
    expect(p.pinnedHref).toBe(base.link.canais({ channel: ch.id, tab: 'videos' }) + '#fixados')
    expect(p.pinnedHref).toContain('tab=videos')
  })
  it('não fixado, fora dos acompanhados: o selo "Fora dos acompanhados" só quando a tela pede', () => {
    const { obs, v } = withVideo(UNTR, {})
    expect(pinViewOf(obs, v)!.chips).toEqual([])
    expect(pinViewOf(obs, v, { withOut: true })!.chips).toEqual([{ kind: 'fora', label: 'Fora dos acompanhados', how: null }])
  })
  it('fixado fora dos N, já conferido: "Fixado" + "conferido a cada 6 h" e o selo "fora dos N mais recentes"', () => {
    const { obs, v, ch } = withVideo(UNTR, { pinned: true, pinState: 'ativo' })
    expect(pinViewOf(obs, v)!.chips).toEqual([{ kind: 'fixado', label: 'Fixado', how: 'conferido a cada 6 h' }, { kind: 'fora-dos-n', label: 'fora dos ' + ch.video_limit + ' mais recentes', how: null }])
  })
  it('recém-fixado com canal ok: "Fixado agora" + o prazo', () => {
    const { obs, v } = withVideo(UNTR, { pinned: true, pinState: 'aguardando-primeira' })
    expect(pinViewOf(obs, v)!.chips[0]).toEqual({ kind: 'fixado-agora', label: 'Fixado agora', how: 'a primeira conferência acontece em até 6 h' })
  })
  it.each([['erro', 'sincronização do canal com erro'], ['atrasado', 'sincronização do canal atrasada'], ['backfill', 'canal ainda buscando vídeos']] as const)(
    'canal %s: o segundo segmento é o da sincronização, para o fixado e para o recém-fixado (nunca "em até 6 h")', (state, how) => {
      const a = withVideo(UNTR, { pinned: true, pinState: 'ativo' }, state)
      expect(pinViewOf(a.obs, a.v)!.chips[0]).toEqual({ kind: 'fixado', label: 'Fixado', how })
      const w = withVideo(UNTR, { pinned: true, pinState: 'aguardando-primeira' }, state)
      expect(pinViewOf(w.obs, w.v)!.chips[0]).toEqual({ kind: 'fixado-agora', label: 'Fixado agora', how })
    })
  it('fixado que o YouTube não devolveu (sem-resposta): selo neutro próprio, sem prazo e sem "conferido"; vale mesmo com o canal fora do ar', () => {
    const GONE = { kind: 'sem-resposta', label: 'Fixado', how: 'o YouTube não devolveu este vídeo' }
    for (const sync of [undefined, 'erro', 'atrasado'] as const) {
      const { obs, v, ch } = withVideo(UNTR, { pinned: true, pinState: 'sem-resposta' }, sync)
      expect(pinViewOf(obs, v)!.chips).toEqual([GONE, { kind: 'fora-dos-n', label: 'fora dos ' + ch.video_limit + ' mais recentes', how: null }])
    }
  })
  it('fixado entre os N: só o selo "Fixado"', () => {
    const base = createObservatory(datasetFromOracle(loadOracle()))
    const id = base.videos.find(x => x.tracked && !base.channel(x.ch)!.own)!.id
    const { obs, v } = withVideo(id, { pinned: true, pinState: 'ativo' })
    expect(pinViewOf(obs, v)!.chips.map(c => c.kind)).toEqual(['fixado'])
  })
  it('vídeo de canal próprio: sem controle de fixar', () => {
    const base = createObservatory(datasetFromOracle(loadOracle()))
    const own = base.videos.find(x => base.channel(x.ch)!.own)!
    expect(pinViewOf(base, own)).toBeNull()
  })
})
