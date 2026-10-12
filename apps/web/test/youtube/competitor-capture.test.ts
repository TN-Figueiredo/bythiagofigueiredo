// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { VIDEO_FIELDS, CHANNEL_FIELDS, assertField } from '@/lib/youtube/observatorio/field-catalog'
import { canonicalJson, fieldHash, sha256Hex, rawOf, optCount, RAW_MAX_BYTES, videoObservedOf, channelObservedOf, sanitizeForDb, precisionOf, planFields, planRaw, captureItems, markMissing, markChannelMissing, rowsAs, type Json, type CaptureItem, type StoredField, type StoredRaw, type MissedRow } from '@/lib/youtube/competitor-capture'
import { parseIsoDuration } from '@/lib/youtube/competitor-sync'

describe('catálogo de campos', () => {
  it('é o do spec (4.1), na ordem', () => {
    expect([...VIDEO_FIELDS]).toEqual(['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'views_hidden', 'availability']) // (emenda do portão: D-m8)
    expect([...CHANNEL_FIELDS]).toEqual(['name', 'custom_url', 'description', 'country', 'avatar_url', 'subscribers_hidden', 'availability'])
  })
  it('campo fora do catálogo lança; título, miniatura e descrição do vídeo NÃO estão nele (D3)', () => {
    expect(() => assertField('video', 'tags')).not.toThrow()
    for (const f of ['title', 'thumb', 'desc', 'description', 'name']) expect(() => assertField('video', f)).toThrow(/fora do catálogo/)
    expect(() => assertField('canal', 'tags')).toThrow(/fora do catálogo/)
  })
})
describe('JSON canônico e hash', () => {
  it('a ordem das chaves não muda o texto nem o hash (item 3); a ordem de uma lista muda', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: null } })).toBe('{"a":{"c":null,"d":[1,2]},"b":1}')
    expect(fieldHash({ b: 1, a: 2 })).toBe(fieldHash({ a: 2, b: 1 }))
    expect(fieldHash(['a', 'b'])).not.toBe(fieldHash(['b', 'a']))
  })
  it('fieldHash tem 16 caracteres e é o começo do sha256 do texto canônico', () => {
    expect(fieldHash('sumiu')).toBe(sha256Hex('"sumiu"').slice(0, 16))
    expect(fieldHash(null)).toHaveLength(16)
  })
})
describe('rawOf', () => {
  const item = { kind: 'youtube#video', etag: 'e1', id: 'vid', snippet: { title: 'T', tags: ['a'] }, statistics: { viewCount: '5' }, liveStreamingDetails: { actualStartTime: '2026-01-01T00:00:00Z', concurrentViewers: '10' } }
  it('tira statistics, etag e concurrentViewers; o resto fica como veio', () => {
    expect(rawOf(item).raw).toEqual({ kind: 'youtube#video', id: 'vid', snippet: { title: 'T', tags: ['a'] }, liveStreamingDetails: { actualStartTime: '2026-01-01T00:00:00Z' } })
  })
  it('(M-1) não altera o item de ENTRADA: statistics e concurrentViewers continuam nele', () => {
    const before = structuredClone(item)
    rawOf(item)
    expect(item).toEqual(before)
    expect(item.liveStreamingDetails.concurrentViewers).toBe('10')
    expect(item.statistics).toEqual({ viewCount: '5' })
  })
  it('item 4: mudar só statistics, etag ou concurrentViewers não muda o hash; mudar uma tag muda', () => {
    const same = { ...item, etag: 'e2', statistics: { viewCount: '999' }, liveStreamingDetails: { ...item.liveStreamingDetails, concurrentViewers: '77' } }
    expect(rawOf(same).sha).toBe(rawOf(item).sha)
    expect(rawOf({ ...item, snippet: { title: 'T', tags: ['b'] } }).sha).not.toBe(rawOf(item).sha)
  })
  it('item 3: a ordem das chaves trocada não muda o hash', () => {
    expect(rawOf({ snippet: { tags: ['a'], title: 'T' }, id: 'vid', kind: 'youtube#video' }).sha).toBe(rawOf({ kind: 'youtube#video', id: 'vid', snippet: { title: 'T', tags: ['a'] } }).sha)
  })
  it('bytes é o tamanho do texto canônico, e o teto é 100 kB', () => {
    expect(rawOf({ id: 'é' }).bytes).toBe(Buffer.byteLength('{"id":"é"}'))
    expect(RAW_MAX_BYTES).toBe(100_000)
  })
  it('o que não é objeto vira objeto vazio (nunca lança)', () => {
    expect(rawOf(null).raw).toEqual({})
    expect(rawOf('x').raw).toEqual({})
  })
})
describe('(M-2) undefined no JSON canônico', () => {
  it('chave com undefined é pulada (como o JSON.stringify); undefined em lista é null', () => {
    expect(canonicalJson({ b: 1, a: undefined } as never)).toBe('{"b":1}')
    expect(canonicalJson([1, undefined, 3] as never)).toBe('[1,null,3]')
    expect(canonicalJson(undefined as never)).toBe('null')
  })
  it('rawOf com undefined na entrada não lança e dá o mesmo hash de quando a chave não existe', () => {
    expect(() => rawOf({ id: 'x', a: undefined })).not.toThrow()
    expect(rawOf({ id: 'x', a: undefined, snippet: { t: undefined, tags: ['a', undefined] } }).raw).toEqual({ id: 'x', snippet: { tags: ['a', null] } })
    expect(rawOf({ id: 'x', a: undefined }).sha).toBe(rawOf({ id: 'x' }).sha)
  })
  it('o hash de uma entrada SEM undefined não mudou (fixado)', () => {
    const sample = { kind: 'youtube#video', etag: 'e1', id: 'vid', snippet: { title: 'Título é', tags: ['a', 'b'], publishedAt: '2026-01-01T00:00:00Z' }, contentDetails: { duration: 'PT1M30S' }, liveStreamingDetails: { actualStartTime: '2026-01-01T00:00:00Z', concurrentViewers: '3' } }
    expect(rawOf(sample).sha).toBe('7cbdf3929c5cb64feead316f1ed53e6923912d815eb7a754605714bb6dec764c')
    expect(fieldHash(['a', 'b'])).toBe('0473ef2dc0d324ab')
  })
})
describe('(M-4) sanitizeForDb: o que o jsonb e o text do Postgres rejeitam', () => {
  it('tira NUL do texto e troca substituto solitário por U+FFFD; par válido (emoji) fica', () => {
    expect(sanitizeForDb('a\u0000b')).toEqual({ value: 'ab', changed: true })
    expect(sanitizeForDb('x\ud83dy')).toEqual({ value: 'x\ufffdy', changed: true })
    expect(sanitizeForDb('x\ude00y')).toEqual({ value: 'x\ufffdy', changed: true })
    expect(sanitizeForDb('fim\ud83d')).toEqual({ value: 'fim\ufffd', changed: true })
    expect(sanitizeForDb('ok 😀 ok')).toEqual({ value: 'ok 😀 ok', changed: false })
    expect(sanitizeForDb('\ud83d\ud83d\ude00')).toEqual({ value: '\ufffd😀', changed: true }) // alto solto + par válido
  })
  it('percorre listas e objetos (valores e chaves); números, nulos e booleanos passam', () => {
    expect(sanitizeForDb({ a: ['t\u0000', 1, null, true], 'k\u0000': { d: '\ud83d' } })).toEqual({ value: { a: ['t', 1, null, true], k: { d: '\ufffd' } }, changed: true })
    expect(sanitizeForDb({ a: [1, 'x'], b: null })).toEqual({ value: { a: [1, 'x'], b: null }, changed: false })
  })
  it('rawOf: NUL no título e substituto solitário na descrição são limpos ANTES do hash, e sanitized diz', () => {
    const dirty = rawOf({ id: 'v', snippet: { title: 'a\u0000b', description: 'corte\ud83d' } })
    expect(dirty.raw).toEqual({ id: 'v', snippet: { title: 'ab', description: 'corte\ufffd' } })
    expect(dirty.sanitized).toBe(true)
    expect(dirty.sha).toBe(rawOf({ id: 'v', snippet: { title: 'ab', description: 'corte\ufffd' } }).sha)
    expect(JSON.stringify(dirty.raw)).not.toMatch(/\\u0000|\\ud83d"/i)
  })
  it('rawOf: emoji intacto; item limpo tem sanitized false e o MESMO hash de antes', () => {
    const clean = rawOf({ id: 'v', snippet: { title: 'oi 😀', description: 'd' } })
    expect(clean.sanitized).toBe(false)
    expect(clean.raw).toEqual({ id: 'v', snippet: { title: 'oi 😀', description: 'd' } })
  })
  it('extração: tags, categoria e descrição/nome do canal saem sem NUL nem substituto solitário', () => {
    const v = videoObservedOf({ id: 'v', snippet: { tags: ['a\u0000', 'b\ud83d'], categoryId: '2\u00002', thumbnails: { high: { url: 'u\u0000' } } } }, '2026-06-10T15:00:00.000Z', () => null)
    expect(v.fields.find(f => f.field === 'tags')?.value).toEqual(['a', 'b\ufffd'])
    expect(v.patch.tags).toEqual(['a', 'b\ufffd'])
    expect(v.patch.category_id).toBe('22')
    expect(v.patch.thumbnail_url).toBe('u')
    const c = channelObservedOf({ id: 'UC', snippet: { title: 'N\u0000', description: 'd\ud83d', customUrl: '@c\u0000' }, statistics: {} })
    expect(c.fields.find(f => f.field === 'name')?.value).toBe('N')
    expect(c.fields.find(f => f.field === 'description')?.value).toBe('d\ufffd')
    expect(c.patch.description).toBe('d\ufffd')
    expect(c.patch.custom_url).toBe('@c')
  })
})
describe('optCount', () => {
  it('ausente, vazio e lixo viram nulo; zero de verdade fica zero', () => {
    expect([optCount(undefined), optCount(null), optCount(''), optCount('abc'), optCount('0'), optCount('12')]).toEqual([null, null, null, null, 0, 12])
  })
})

describe('videoObservedOf', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const full = { id: 'vid', snippet: { title: 'T', tags: ['b', 'a'], categoryId: '19', defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt', liveBroadcastContent: 'none' }, statistics: { viewCount: '10', likeCount: '2', commentCount: '0' }, contentDetails: { duration: 'PT1M30S' } }
  const valueOf = (o: ReturnType<typeof videoObservedOf>, f: string) => o.fields.find(x => x.field === f)?.value
  it('resposta completa: os 9 campos do catálogo, nenhum fora dele, tags na ordem da API', () => {
    const o = videoObservedOf(full, NOW, parseIsoDuration)
    expect(o.fields.map(f => f.field).sort()).toEqual([...VIDEO_FIELDS].sort())
    expect(valueOf(o, 'tags')).toEqual(['b', 'a'])
    expect(valueOf(o, 'duration_seconds')).toBe(90)
    expect(valueOf(o, 'availability')).toBe('no_ar')
    expect(o.partsMissing).toEqual([])
    expect(o.hasViews).toBe(true)
  })
  it('item 6: sem commentCount → comment_count nulo e comments_disabled true; zero de verdade continua zero', () => {
    const o = videoObservedOf({ ...full, statistics: { viewCount: '10', likeCount: '2' } }, NOW, parseIsoDuration)
    expect(o.patch).toMatchObject({ comment_count: null, comments_disabled: true, like_count: 2, likes_hidden: false, view_count: 10, views_hidden: false })
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch).toMatchObject({ comment_count: 0, comments_disabled: false })
  })
  it('item 225: sem viewCount → view_count nulo, views_hidden true, hasViews false', () => {
    const o = videoObservedOf({ ...full, statistics: { likeCount: '2' } }, NOW, parseIsoDuration)
    expect(o.patch).toMatchObject({ view_count: null, views_hidden: true })
    expect(o.hasViews).toBe(false)
  })
  it('item 8: com liveStreamingDetails → was_live true e os horários; sem → was_live false (não nulo)', () => {
    const live = videoObservedOf({ ...full, liveStreamingDetails: { scheduledStartTime: '2026-06-01T10:00:00Z', actualStartTime: '2026-06-01T10:01:00Z', actualEndTime: '2026-06-01T11:00:00Z', concurrentViewers: '9' } }, NOW, parseIsoDuration)
    expect(live.patch).toMatchObject({ was_live: true, live_scheduled_start_at: '2026-06-01T10:00:00Z', live_actual_start_at: '2026-06-01T10:01:00Z', live_actual_end_at: '2026-06-01T11:00:00Z' })
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch).toMatchObject({ was_live: false, live_scheduled_start_at: null, live_actual_start_at: null, live_actual_end_at: null })
  })
  it('vídeo sem tags: o valor é nulo (a API não devolveu), nunca lista vazia inventada', () => {
    const { tags: _t, ...sn } = full.snippet
    expect(valueOf(videoObservedOf({ ...full, snippet: sn }, NOW, parseIsoDuration), 'tags')).toBeNull()
  })
  it('Review Focus 1: parte inteira ausente não vira "mudou para nulo": os campos dela não saem, e partsMissing diz qual', () => {
    const noSnippet = videoObservedOf({ id: 'vid', statistics: full.statistics, contentDetails: full.contentDetails }, NOW, parseIsoDuration)
    expect(noSnippet.partsMissing).toEqual(['snippet'])
    expect(noSnippet.fields.map(f => f.field).sort()).toEqual(['availability', 'comments_disabled', 'duration_seconds', 'likes_hidden', 'views_hidden'])
    expect('default_language' in noSnippet.patch).toBe(false)
    const noStats = videoObservedOf({ id: 'vid', snippet: full.snippet, contentDetails: full.contentDetails }, NOW, parseIsoDuration)
    expect(noStats.partsMissing).toEqual(['statistics'])
    expect('view_count' in noStats.patch).toBe(false)   // a contagem gravada não é tocada
    expect('views_hidden' in noStats.patch).toBe(false)
    expect(noStats.hasViews).toBe(false)
    expect(videoObservedOf({ id: 'vid', snippet: full.snippet, statistics: full.statistics }, NOW, parseIsoDuration).partsMissing).toEqual(['contentDetails'])
  })
  it('toda leitura zera a sequência de faltas e limpa a decisão "manter" (o vídeo veio)', () => {
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch).toMatchObject({ last_checked_at: NOW, miss_streak: 0, miss_first_at: null, missing_since: null, removal_decision: null, removal_decided_at: null, removal_decided_by: null })
    expect('last_seen_at' in videoObservedOf(full, NOW, parseIsoDuration).patch).toBe(false)
  })
  it('(emenda S-M2) a linha do vídeo leva tags, categoria, miniatura e duração só quando a parte veio', () => {
    const withThumbs = { ...full, snippet: { ...full.snippet, categoryId: '22', thumbnails: { high: { url: 'https://yt/high.jpg' }, maxres: { url: 'https://yt/maxres.jpg' } } } }
    expect(videoObservedOf(withThumbs, NOW, parseIsoDuration).patch).toMatchObject({ tags: ['b', 'a'], category_id: '22', duration_seconds: 90, thumbnail_url: 'https://yt/maxres.jpg' })
    const onlyHigh = { ...full, snippet: { ...full.snippet, thumbnails: { high: { url: 'https://yt/high.jpg' } } } }
    expect(videoObservedOf(onlyHigh, NOW, parseIsoDuration).patch.thumbnail_url).toBe('https://yt/high.jpg')
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch.thumbnail_url).toBeNull()
    const noSnippet = videoObservedOf({ id: 'vid', statistics: full.statistics, contentDetails: full.contentDetails }, NOW, parseIsoDuration).patch
    expect('tags' in noSnippet).toBe(false)
    expect('category_id' in noSnippet).toBe(false)
    expect('thumbnail_url' in noSnippet).toBe(false)
    const noDetails = videoObservedOf({ id: 'vid', snippet: full.snippet, statistics: full.statistics }, NOW, parseIsoDuration).patch
    expect('duration_seconds' in noDetails).toBe(false)
    const { tags: _t, ...sn } = full.snippet
    expect(videoObservedOf({ ...full, snippet: sn }, NOW, parseIsoDuration).patch.tags).toEqual([])
  })
  it('(emenda D-m8) views_hidden entra no histórico', () => {
    const empty = videoObservedOf({ ...full, statistics: {} }, NOW, parseIsoDuration)
    expect(empty.fields).toContainEqual({ field: 'views_hidden', value: true })
    const noStats = videoObservedOf({ id: 'vid', snippet: full.snippet, contentDetails: full.contentDetails }, NOW, parseIsoDuration)
    expect(noStats.fields.map(f => f.field)).not.toContain('views_hidden')
  })
})
describe('channelObservedOf', () => {
  const item = { id: 'UC', snippet: { title: 'Canal', customUrl: '@canal', description: 'd', publishedAt: '2015-01-01T00:00:00Z', country: 'BR', thumbnails: { default: { url: 'https://yt3/x' } } }, statistics: { subscriberCount: '10', hiddenSubscriberCount: false } }
  it('os 7 campos do catálogo e as colunas do canal', () => {
    const o = channelObservedOf(item)
    expect(o.fields.map(f => f.field).sort()).toEqual([...CHANNEL_FIELDS].sort())
    expect(o.patch).toMatchObject({ custom_url: '@canal', description: 'd', published_at: '2015-01-01T00:00:00Z', country: 'BR', subscribers_hidden: false, miss_streak: 0, missing_since: null })
  })
  it('inscritos ocultos: hiddenSubscriberCount true OU contagem ausente', () => {
    expect(channelObservedOf({ ...item, statistics: { hiddenSubscriberCount: true, subscriberCount: '0' } }).patch.subscribers_hidden).toBe(true)
    expect(channelObservedOf({ ...item, statistics: {} }).patch.subscribers_hidden).toBe(true)
  })
  it('país e handle ausentes ficam nulos', () => {
    const o = channelObservedOf({ id: 'UC', snippet: { title: 'Canal' }, statistics: { subscriberCount: '1' } })
    expect(o.patch).toMatchObject({ custom_url: null, country: null, published_at: null })
  })
})
describe('precisionOf (4.1, v2.3)', () => {
  const t = (h: number) => new Date(Date.UTC(2026, 5, 10, 15) + h * 3_600_000).toISOString()
  it('sem janela é buraco; até 8 h é 6h; até 36 h é 1d', () => {
    expect(precisionOf(null, t(0), null)).toBe('gap')
    expect(precisionOf(t(-8), t(0), null)).toBe('6h')
    expect(precisionOf(t(-8.1), t(0), null)).toBe('1d')
    expect(precisionOf(t(-36), t(0), null)).toBe('1d')
  })
  it('até 8 dias só é 7d se o vídeo esteve em faixa semanal a janela inteira; senão é buraco', () => {
    expect(precisionOf(t(-7 * 24), t(0), '2026-06-01')).toBe('7d')
    expect(precisionOf(t(-7 * 24), t(0), '2026-06-05')).toBe('gap') // entrou na semanal DEPOIS do começo da janela
    expect(precisionOf(t(-3 * 24), t(0), null)).toBe('gap')         // vídeo diário com 3 dias sem leitura: buraco, não semana
    expect(precisionOf(t(-9 * 24), t(0), '2026-06-01')).toBe('gap')
  })
})
describe('planFields', () => {
  const NOW = '2026-06-10T15:00:00.000Z', PREV = '2026-06-10T09:00:00.000Z'
  const it1 = (fields: Array<{ field: string; value: Json }>, over: Partial<CaptureItem> = {}): CaptureItem => ({ videoId: 'v1', fields, raw: null, prevSeenAt: PREV, weeklySince: null, ...over })
  it('primeira leitura: abre "first" sem janela e não fecha nada', () => {
    expect(planFields('video', [], [it1([{ field: 'tags', value: ['a'] }], { prevSeenAt: null })], NOW)).toEqual({ close: [], open: [{ video_id: 'v1', field: 'tags', value: ['a'], value_hash: fieldHash(['a']), first_seen_at: NOW, window_start: null, precision: 'first' }] })
  })
  it('item 223: valor igual → plano vazio (zero escritas)', () => {
    expect(planFields('video', [{ id: 7, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a']) }], [it1([{ field: 'tags', value: ['a'] }])], NOW)).toEqual({ close: [], open: [] })
  })
  it('item 4: valor diferente → fecha a corrente com a última leitura boa e abre a nova com a janela', () => {
    const p = planFields('video', [{ id: 7, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a']) }], [it1([{ field: 'tags', value: ['b'] }])], NOW)
    expect(p.close).toEqual([{ id: 7, last_seen_at: PREV }])
    expect(p.open[0]).toMatchObject({ field: 'tags', window_start: PREV, precision: '6h', first_seen_at: NOW })
  })
  it('a mesma lista em outra ordem é mudança', () => {
    expect(planFields('video', [{ id: 7, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a', 'b']) }], [it1([{ field: 'tags', value: ['b', 'a'] }])], NOW).open).toHaveLength(1)
  })
  it('campo fora do catálogo lança, e nada é planejado', () => {
    expect(() => planFields('video', [], [it1([{ field: 'title', value: 'x' }])], NOW)).toThrow(/fora do catálogo/)
  })
  it('campo do canal usa a chave de video_id nulo', () => {
    const p = planFields('canal', [{ id: 3, video_id: null, field: 'country', value_hash: fieldHash('BR') }], [it1([{ field: 'country', value: 'PT' }], { videoId: null })], NOW)
    expect(p.close).toEqual([{ id: 3, last_seen_at: PREV }])
  })
  it('"sumiu": a versão nova nasce no instante da 1ª falta, não agora', () => {
    const p = planFields('video', [{ id: 9, video_id: 'v1', field: 'availability', value_hash: fieldHash('no_ar') }], [it1([{ field: 'availability', value: 'sumiu' }], { firstSeenAt: '2026-06-10T03:00:00.000Z', prevSeenAt: '2026-06-09T21:00:00.000Z' })], NOW)
    expect(p.open[0]).toMatchObject({ first_seen_at: '2026-06-10T03:00:00.000Z', window_start: '2026-06-09T21:00:00.000Z', precision: '6h' })
  })
})
describe('planRaw', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const item = (sha: string, bytes = 10): CaptureItem => ({ videoId: 'v1', fields: [], raw: { sha, raw: { id: sha }, bytes }, prevSeenAt: '2026-06-10T09:00:00.000Z', weeklySince: null })
  it('igual: nada; diferente: fecha e abre; primeira: abre', () => {
    expect(planRaw([{ id: 1, video_id: 'v1', raw_sha256: 'a' }], [item('a')], NOW)).toEqual({ close: [], open: [], tooBig: 0 })
    expect(planRaw([{ id: 1, video_id: 'v1', raw_sha256: 'a' }], [item('b')], NOW)).toEqual({ close: [{ id: 1, last_seen_at: '2026-06-10T09:00:00.000Z' }], open: [{ video_id: 'v1', raw_sha256: 'b', first_seen_at: NOW, raw: { id: 'b' } }], tooBig: 0 })
    expect(planRaw([], [item('a')], NOW).open).toHaveLength(1)
  })
  it('acima de 100 kB não é guardado e é contado (nunca em silêncio)', () => {
    expect(planRaw([], [item('a', RAW_MAX_BYTES + 1)], NOW)).toEqual({ close: [], open: [], tooBig: 1 })
  })
  it('item sem raw (só campos) é ignorado', () => {
    expect(planRaw([], [{ ...item('a'), raw: null }], NOW)).toEqual({ close: [], open: [], tooBig: 0 })
  })
})

type DbCall = { kind: 'select' | 'rpc'; name: string; args?: unknown }
function captureDb(state: { fields?: StoredField[]; raws?: StoredRaw[]; fail?: string; missed?: unknown; channelMissed?: unknown; long?: boolean }) {
  const calls: DbCall[] = []
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    const result = () => {
      if (state.fail === table) return { data: null, error: { message: 'boom' } }
      const rows = table === 'competitor_field_versions' ? state.fields ?? [] : state.raws ?? []
      return { data: state.long ? Array.from({ length: 1000 }, () => rows[0] ?? { id: 1, video_id: 'v1', field: 'tags', value_hash: 'x' }) : rows, error: null }
    }
    for (const m of ['select', 'eq', 'in', 'is']) chain[m] = () => chain
    chain.then = (ok: (v: unknown) => unknown) => { calls.push({ kind: 'select', name: table }); return Promise.resolve(result()).then(ok) }
    return chain
  }
  const rpc = (name: string, args: unknown) => {
    calls.push({ kind: 'rpc', name, args })
    if (state.fail === name) return Promise.resolve({ data: null, error: { message: 'boom' } })
    if (name === 'competitor_mark_missing') return Promise.resolve({ data: 'missed' in state ? state.missed : [], error: null })
    if (name === 'competitor_channel_mark_missing') return Promise.resolve({ data: 'channelMissed' in state ? state.channelMissed : null, error: null })
    return Promise.resolve({ data: { closed: 0, opened: 0 }, error: null })
  }
  return { sb: { from, rpc } as never, calls }
}
describe('captureItems', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const base = { siteId: 's', channelId: 'c', scope: 'video' as const, nowIso: NOW }
  const item: CaptureItem = { videoId: 'v1', fields: [{ field: 'tags', value: ['a'] }], raw: { sha: 'r1', raw: { id: 'x' }, bytes: 10 }, prevSeenAt: null, weeklySince: null }
  it('item 223: nada mudou → duas leituras e ZERO gravações', async () => {
    const db = captureDb({ fields: [{ id: 1, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a']) }], raws: [{ id: 2, video_id: 'v1', raw_sha256: 'r1' }] })
    expect(await captureItems(db.sb, { ...base, items: [item] })).toEqual({ fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0, sanitized: 0 })
    expect(db.calls.filter(c => c.kind === 'rpc')).toEqual([])
    expect(db.calls.filter(c => c.kind === 'select')).toHaveLength(2)
  })
  it('primeira leitura → uma gravação de campos e uma de raw, com o site e o canal', async () => {
    const db = captureDb({})
    const st = await captureItems(db.sb, { ...base, items: [item] })
    expect(st).toMatchObject({ fieldsOpened: 1, rawOpened: 1 })
    expect(db.calls.filter(c => c.kind === 'rpc').map(c => c.name)).toEqual(['apply_competitor_field_plan', 'apply_competitor_raw_plan'])
    expect(db.calls.find(c => c.name === 'apply_competitor_field_plan')!.args).toMatchObject({ p_site_id: 's', p_channel_id: 'c', p_close: [] })
  })
  it('lista vazia não lê nem grava', async () => {
    const db = captureDb({})
    await captureItems(db.sb, { ...base, items: [] })
    expect(db.calls).toEqual([])
  })
  it('mais de 50 itens numa chamada lança (quem chama divide)', async () => {
    await expect(captureItems(captureDb({}).sb, { ...base, items: Array.from({ length: 51 }, (_, i) => ({ ...item, videoId: 'v' + i })) })).rejects.toThrow(/50/)
  })
  it('erro de leitura lança com o nome da tabela; erro de gravação lança; nunca "sem mudança"', async () => {
    await expect(captureItems(captureDb({ fail: 'competitor_field_versions' }).sb, { ...base, items: [item] })).rejects.toThrow(/captura.*competitor_field_versions/)
    await expect(captureItems(captureDb({ fail: 'apply_competitor_raw_plan' }).sb, { ...base, items: [item] })).rejects.toThrow(/captura.*apply_competitor_raw_plan/)
  })
  it('leitura que bate no teto de 1.000 linhas lança (corte silencioso é proibido)', async () => {
    await expect(captureItems(captureDb({ long: true }).sb, { ...base, items: [item] })).rejects.toThrow(/1000/)
  })
  it('raw grande: vários lotes de gravação, cada um com no máximo 1 MB', async () => {
    const big = (i: number): CaptureItem => ({ ...item, videoId: 'v' + i, fields: [], raw: { sha: 'r' + i, raw: { id: 'x' }, bytes: 90_000 } })
    const db = captureDb({})
    await captureItems(db.sb, { ...base, items: Array.from({ length: 30 }, (_, i) => big(i)) })
    const sizes = db.calls.filter(c => c.name === 'apply_competitor_raw_plan').map(c => (c.args as { p_open: unknown[] }).p_open.length)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(30)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(11) // 11 × 90 kB = 990 kB
  })
})
describe('markMissing', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  it('uma falta só: soma e não abre versão', async () => {
    const db = captureDb({ missed: [{ id: 'v1', miss_streak: 1, miss_first_at: NOW, missing_since: null, last_seen_at: '2026-06-10T09:00:00.000Z' }] })
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 1, newlyMissing: 0 })
    expect(db.calls.map(c => c.name)).toEqual(['competitor_mark_missing'])
  })
  it('segunda falta: abre availability = "sumiu" no instante da 1ª falta; a marca não apaga nada', async () => {
    const db = captureDb({ fields: [{ id: 5, video_id: 'v1', field: 'availability', value_hash: fieldHash('no_ar') }], missed: [{ id: 'v1', miss_streak: 2, miss_first_at: '2026-06-10T09:00:00.000Z', missing_since: '2026-06-10', last_seen_at: '2026-06-10T03:00:00.000Z' }] })
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 1, newlyMissing: 1 })
    const plan = db.calls.find(c => c.name === 'apply_competitor_field_plan')!.args as { p_close: unknown[]; p_open: Array<Record<string, unknown>> }
    expect(plan.p_close).toEqual([{ id: 5, last_seen_at: '2026-06-10T03:00:00.000Z' }])
    expect(plan.p_open[0]).toMatchObject({ field: 'availability', value: 'sumiu', first_seen_at: '2026-06-10T09:00:00.000Z', window_start: '2026-06-10T03:00:00.000Z', precision: '6h' })
  })
  it('já ausente e já com a versão "sumiu": nada a gravar (conserto sozinho quando a versão faltou)', async () => {
    const db = captureDb({ fields: [{ id: 5, video_id: 'v1', field: 'availability', value_hash: fieldHash('sumiu') }], missed: [{ id: 'v1', miss_streak: 5, miss_first_at: '2026-06-09T09:00:00.000Z', missing_since: '2026-06-09', last_seen_at: null }] })
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 1, newlyMissing: 0 })
    expect(db.calls.some(c => c.name === 'apply_competitor_field_plan')).toBe(false)
  })
  it('lista vazia não chama o banco; erro da função lança', async () => {
    const db = captureDb({})
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: [], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 0, newlyMissing: 0 })
    expect(db.calls).toEqual([])
    await expect(markMissing(captureDb({ fail: 'competitor_mark_missing' }).sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).rejects.toThrow(/ausência/)
  })
})

describe('rowsAs (S-I3): leitura do banco com forma conferida', () => {
  const isNum = (x: unknown): x is { n: number } => typeof x === 'object' && x !== null && typeof (x as { n?: unknown }).n === 'number'
  it('lista com todas as linhas na forma devolve as mesmas linhas; lista vazia é lista vazia', () => {
    expect(rowsAs([{ n: 1 }, { n: 2 }], isNum, 'x')).toEqual([{ n: 1 }, { n: 2 }])
    expect(rowsAs([], isNum, 'x')).toEqual([])
  })
  it('uma linha fora da forma lança; resposta que não é lista lança', () => {
    expect(() => rowsAs([{ n: 1 }, { n: 'a' }], isNum, 'x')).toThrow(/fora da forma esperada/)
    expect(() => rowsAs({ n: 1 }, isNum, 'x')).toThrow(/não é uma lista/)
    expect(() => rowsAs('ok', isNum, 'x')).toThrow(/não é uma lista/)
  })
  it('resposta nula LANÇA: onde o banco responde lista, nulo não é "nenhuma linha"', () => {
    expect(() => rowsAs(null, isNum, 'leitura')).toThrow(/leitura.*nula/)
    expect(() => rowsAs(undefined, isNum, 'leitura')).toThrow(/leitura.*nula/)
  })
})
describe('captureItems: forma das linhas lidas e contagem de texto limpo', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const base = { siteId: 's', channelId: 'c', scope: 'video' as const, nowIso: NOW }
  const item: CaptureItem = { videoId: 'v1', fields: [{ field: 'tags', value: ['a'] }], raw: { sha: 'r1', raw: { id: 'x' }, bytes: 10 }, prevSeenAt: null, weeklySince: null }
  it('linha lida com id que não é número: a captura lança em vez de planejar sobre lixo', async () => {
    await expect(captureItems(captureDb({ fields: [{ id: 'x' } as never] }).sb, { ...base, items: [item] })).rejects.toThrow(/fora da forma esperada/)
    await expect(captureItems(captureDb({ raws: [{ id: 1, video_id: 'v1' } as never] }).sb, { ...base, items: [item] })).rejects.toThrow(/fora da forma esperada/)
  })
  it('escopo do canal: lê com video_id nulo e grava a versão do canal', async () => {
    const db = captureDb({})
    const st = await captureItems(db.sb, { ...base, scope: 'canal', items: [{ videoId: null, fields: [{ field: 'country', value: 'BR' }], raw: null, prevSeenAt: null, weeklySince: null }] })
    expect(st).toMatchObject({ fieldsOpened: 1, rawOpened: 0 })
  })
  it('(M-4) sanitized conta os itens cujo texto foi limpo, tenham ou não gravação', async () => {
    const dirty = (id: string, sanitized: boolean): CaptureItem => ({ ...item, videoId: id, raw: { sha: 'r' + id, raw: { id }, bytes: 10, sanitized } })
    const db = captureDb({})
    const st = await captureItems(db.sb, { ...base, items: [dirty('a', true), dirty('b', false), dirty('c', true)] })
    expect(st.sanitized).toBe(2)
    expect((await captureItems(captureDb({}).sb, { ...base, items: [item] })).sanitized).toBe(0)
  })
})
describe('markMissing / markChannelMissing: forma da resposta', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const args = { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null }
  it('resposta nula ou linha sem os campos de ausência lança (nunca "ninguém sumiu")', async () => {
    await expect(markMissing(captureDb({ missed: null }).sb, args)).rejects.toThrow(/ausência.*nula/)
    await expect(markMissing(captureDb({ missed: [{ id: 'v1', miss_streak: 2 }] }).sb, args)).rejects.toThrow(/ausência.*fora da forma esperada/)
    await expect(markMissing(captureDb({ missed: [{ id: 'v1', miss_streak: 2, miss_first_at: null, missing_since: 5, last_seen_at: null }] }).sb, args)).rejects.toThrow(/fora da forma esperada/)
  })
  it('canal: nulo é "sem canal" (a função documenta); forma estranha lança; com missing_since abre "sumiu" do canal', async () => {
    const a = { siteId: 's', channelId: 'c', nowIso: NOW }
    expect(await markChannelMissing(captureDb({ channelMissed: null }).sb, a)).toEqual({ missingSince: null })
    await expect(markChannelMissing(captureDb({ channelMissed: 'oops' }).sb, a)).rejects.toThrow(/ausência do canal.*fora da forma esperada/)
    await expect(markChannelMissing(captureDb({ channelMissed: { id: 'c', miss_streak: 1 } }).sb, a)).rejects.toThrow(/fora da forma esperada/)
    await expect(markChannelMissing(captureDb({ fail: 'competitor_channel_mark_missing' }).sb, a)).rejects.toThrow(/ausência do canal/)
    const one = captureDb({ channelMissed: { id: 'c', miss_streak: 2, miss_first_at: '2026-06-10T09:00:00.000Z', missing_since: '2026-06-10', last_seen_at: '2026-06-10T03:00:00.000Z' } })
    expect(await markChannelMissing(one.sb, a)).toEqual({ missingSince: '2026-06-10' })
    expect(one.calls.find(c => c.name === 'apply_competitor_field_plan')!.args).toMatchObject({ p_open: [{ video_id: null, field: 'availability', value: 'sumiu' }] })
  })
})
