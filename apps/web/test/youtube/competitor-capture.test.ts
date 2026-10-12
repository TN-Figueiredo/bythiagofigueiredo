// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { VIDEO_FIELDS, CHANNEL_FIELDS, assertField } from '@/lib/youtube/observatorio/field-catalog'
import { canonicalJson, fieldHash, sha256Hex, rawOf, optCount, RAW_MAX_BYTES } from '@/lib/youtube/competitor-capture'

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
