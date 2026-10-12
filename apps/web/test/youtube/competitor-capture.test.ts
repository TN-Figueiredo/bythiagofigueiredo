// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { VIDEO_FIELDS, CHANNEL_FIELDS, assertField } from '@/lib/youtube/observatorio/field-catalog'
import { canonicalJson, fieldHash, sha256Hex, rawOf, optCount, RAW_MAX_BYTES, videoObservedOf, channelObservedOf } from '@/lib/youtube/competitor-capture'
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
