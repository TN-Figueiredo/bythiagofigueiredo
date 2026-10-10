// @vitest-environment node
// apps/web/test/youtube/observatorio/channels.test.ts
import { describe, it, expect } from 'vitest'
import { deriveSyncState, backfillProgress, humanizeSyncError, syncLabel, runSyncText, channelSlots } from '@/lib/youtube/observatorio/channels'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const DS0 = datasetFromOracle(loadOracle())
const now = Date.parse('2026-10-24T18:02:00Z')
const base = { sync_status: 'idle', sync_error: null, last_ok_synced_at: '2026-10-24T15:00:00Z', sync_error_since: null, youtube_video_count: 300, video_limit: 50, tracked: 50, full_sync_completed_at: null }
describe('deriveSyncState', () => {
  it('ok', () => expect(deriveSyncState(base, now)).toBe('ok'))
  it('erro wins', () => expect(deriveSyncState({ ...base, sync_status: 'error', sync_error: 'YouTube API 404 for channel X' }, now)).toBe('erro'))
  it('atrasado after 12 h without an ok sync', () => expect(deriveSyncState({ ...base, last_ok_synced_at: '2026-10-24T05:00:00Z' }, now)).toBe('atrasado'))
  it('exactly 12 h is still ok', () => expect(deriveSyncState({ ...base, last_ok_synced_at: new Date(now - RULES.syncLateHours * 36e5).toISOString() }, now)).toBe('ok'))
  // R21: backfill only until the first OK sync. Shorts/private videos make tracked < youtube_video_count forever.
  it('after an ok sync, fewer videos than the limit is not backfill', () => expect(deriveSyncState({ ...base, tracked: 18 }, now)).toBe('ok'))
  it('a channel with fewer videos than the limit is not backfilling', () => expect(deriveSyncState({ ...base, youtube_video_count: 18, tracked: 18 }, now)).toBe('ok'))
  it('a missing full_sync_completed_at never makes a synced channel backfill', () => expect(deriveSyncState({ ...base, tracked: 18, full_sync_completed_at: null }, now)).toBe('ok'))
  it('never synced is backfill, not ok', () => expect(deriveSyncState({ ...base, last_ok_synced_at: null, tracked: 0 }, now)).toBe('backfill'))
  it('never synced is backfill even with every video fetched', () => expect(deriveSyncState({ ...base, last_ok_synced_at: null, tracked: 50, full_sync_completed_at: '2026-10-20T00:00:00Z' }, now)).toBe('backfill'))
  it('youtube_video_count null, tracked < limit, last ok set → ok', () => expect(deriveSyncState({ ...base, youtube_video_count: null, tracked: 10 }, now)).toBe('ok'))
})
describe('backfillProgress (R21)', () => {
  it('done/total = tracked / min(video_limit, youtube_video_count ?? video_limit)', () => {
    expect(backfillProgress({ ...base, tracked: 18, youtube_video_count: 30 })).toEqual({ done: 18, total: 30 })
    expect(backfillProgress({ ...base, tracked: 18, youtube_video_count: 300 })).toEqual({ done: 18, total: 50 })
    expect(backfillProgress({ ...base, tracked: 18, youtube_video_count: null })).toEqual({ done: 18, total: 50 })
  })
})
describe('humanizeSyncError', () => {
  it('404', () => expect(humanizeSyncError('YouTube API 404 for channel UCx')).toBe('não encontrado no YouTube (404)'))
  it('404 in prose', () => expect(humanizeSyncError('Canal não encontrado no YouTube (404). Mudou de handle?')).toBe('não encontrado no YouTube (404)'))
  it('quota', () => expect(humanizeSyncError('YouTube API 403 quotaExceeded')).toBe('cota diária da API do YouTube esgotada'))
  it('quotaExceeded alone', () => expect(humanizeSyncError('quotaExceeded')).toBe('cota diária da API do YouTube esgotada'))
  it('timeout', () => expect(humanizeSyncError('request timeout')).toBe('tempo de resposta do YouTube esgotado'))
  it('aborted', () => expect(humanizeSyncError('The operation was Aborted')).toBe('tempo de resposta do YouTube esgotado'))
  it('unknown text is kept, never hidden', () => expect(humanizeSyncError('weird thing')).toBe('weird thing'))
})
describe('syncLabel', () => {
  it('labels', () => {
    expect(syncLabel('backfill')).toBe('buscando vídeos'); expect(syncLabel('ok')).toBe('sincronizado')
    expect(syncLabel('atrasado')).toBe('atrasado'); expect(syncLabel('erro')).toBe('erro')
  })
})
describe('runSyncText', () => {
  const names = (id: string) => ({ a: 'Alfa', b: 'Beta' })[id] ?? id
  it('nothing synced', () => expect(runSyncText([], [], [], names)).toBe('nenhum canal sincronizado'))
  it('singular and plural', () => {
    expect(runSyncText(['a'], [], [], names)).toBe('1 canal sincronizado agora')
    expect(runSyncText(['a', 'b'], [], [], names)).toBe('2 canais sincronizados agora')
  })
  it('problems and out of round', () => {
    expect(runSyncText(['a'], [{ id: 'b', label: 'x' }], [{ id: 'b', label: 'buscando vídeos' }], names)).toBe('1 canal sincronizado agora; 1 com problema; fora da rodada: Beta (buscando vídeos)')
  })
})
describe('channels in the facade', () => {
  const P = createObservatory(DS0)
  it('channelSlots excludes the own channel and never goes negative', () => {
    expect(channelSlots({ ds: { channels: [{ own: true }, { own: false }] } } as never, 75)).toEqual({ used: 1, limit: 75, free: 74 })
    expect(channelSlots({ ds: { channels: [{ own: false }, { own: false }] } } as never, 1)).toEqual({ used: 2, limit: 1, free: 0 })
    expect(P.channelSlots()).toEqual({ used: 14, limit: 75, free: 61 })
  })
  it('SYNC carries the 6 h slots rule', () => { expect(P.SYNC.cadenceHours).toBe(6); expect(P.SYNC.slots).toEqual([0, 6, 12, 18]); expect(P.SYNC.dailyBefore).toBe('09:00') })
  it('atrasado problemLabel is computed from the last good sync, not canned', () => {
    expect(P.channel('paddy-doyle')!.sync.problemLabel).toBe('sem sincronização boa há 39 h')
    expect(P.channel('esq-unltd-daily')!.sync.problemLabel).toBe('não encontrado no YouTube (404)')
    expect(P.channel('luke-damant')!.sync.problemPhrase).toBeNull()
  })
})

describe('inscritos ocultos (subs null) e snapshot com 0 inscritos', () => {
  const DAY = 864e5
  const ds = DS0
  const own = ds.channels.find(c => !c.own)!
  const withSnaps = (subs: number | null, prevSubs: number) => {
    const d = structuredClone(ds)
    const c = d.channels.find(x => x.id === own.id)!
    c.subs = subs
    c.snapshots = [{ t: d.now - 31 * DAY, date: 'a', subs: prevSubs, views: 0 }, { t: d.now - DAY, date: 'b', subs: 5000, views: 0 }]
    return createObservatory(d).channelStats(own.id, 'long')
  }
  it('subs null: sem divisão, sem NaN/Infinity, texto "sem contagem"', () => {
    const s = withSnaps(null, 4000)
    expect(s.perMilSubs).toBeNull()
    expect(s.growth30).toMatchObject({ roundingUnit: 1, roundingError: 0, roundingText: 'sem contagem', withinRounding: null, uncertainty: 0, text: null })
    expect(JSON.stringify(s)).not.toMatch(/NaN|Infinity/)
  })
  it('snapshot anterior com 0 inscritos: pct null, abs preservado, sem Infinity', () => {
    const s = withSnaps(5000, 0)
    expect(s.growth30.pct).toBeNull()
    expect(s.growth30.abs).toBe(5000)
    expect(JSON.stringify(s.growth30)).not.toMatch(/NaN|Infinity/)
  })
  it('subs numérico continua dando "exato"/arredondamento e perMilSubs', () => {
    const s = withSnaps(5000, 4000)
    expect(s.growth30.pct).toBe(0.25)
    expect(s.growth30.roundingText).not.toBe('sem contagem')
  })
})

describe('engajamento: comentário nulo fora da base', () => {
  // um canal com os vídeos dados (todos longos, acompanhados, de 30 dias); devolve o que channelStats dá para o engajamento
  const engajamentoDe = (vs: Array<{ views: number; likes: number; comments: number | null }>) => {
    const d = structuredClone(DS0)
    const ch = d.channels.find(c => !c.own)!
    const outros = d.videos.filter(v => v.ch !== ch.id)
    const meus = d.videos.filter(v => v.ch === ch.id)
    const molde = meus.find(v => v.fmt === 'long')!
    d.videos = [...outros, ...vs.map((x, i) => ({ ...molde, id: 'eng-' + i, tracked: true, fmt: 'long' as const, ageDays: 30, views: x.views, likes: x.likes, comments: x.comments }))]
    return createObservatory(d).channelStats(ch.id, 'long').engagement
  }
  it('comentário nulo fora da base do engajamento: não vira likes / views', () => {
    const comBase = engajamentoDe([{ views: 1000, likes: 50, comments: 10 }, { views: 1000, likes: 50, comments: 10 }])
    const comNulo = engajamentoDe([{ views: 1000, likes: 50, comments: 10 }, { views: 1000, likes: 50, comments: null }])
    expect(comBase.n).toBe(2)
    expect(comNulo.n).toBe(comBase.n - 1)
    expect(comNulo.median).toBe(comBase.median)   // a mediana é a do vídeo que tem os dois números
  })
  it('todos sem contagem de comentários: nenhuma base, nunca 0 %', () => {
    const e = engajamentoDe([{ views: 1000, likes: 50, comments: null }])
    expect(e.n).toBe(0)
    expect(e.median).toBeNull()
    expect(e.label).toBe('sem vídeos com contagem')
  })
})
