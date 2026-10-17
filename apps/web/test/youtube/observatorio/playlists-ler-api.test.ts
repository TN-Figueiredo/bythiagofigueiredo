// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lerPaginaDePlaylists, lerPaginaDeItens, lerSecoes, hashDaPlaylist, erroDaApi, ehForma } from '@/lib/youtube/observatorio/playlists/ler-api'

const fx = (n: string): Record<string, unknown> => JSON.parse(readFileSync(fileURLToPath(new URL(`../../fixtures/youtube/${n}`, import.meta.url)), 'utf8'))
interface Mut { etag?: string; snippet: Record<string, unknown>; status: Record<string, unknown>; contentDetails: Record<string, unknown>; localizations: { en: Record<string, unknown> } }
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

describe('X3 lerPaginaDePlaylists', () => {
  it('forma boa: itens, próxima página, total; filtra UU e UULF e conta as excluídas', () => {
    const r = lerPaginaDePlaylists(fx('x3-playlists.json'))
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens.map(p => p.playlist_id)).toEqual(['PLsint0000000000000000000000000001', 'PLsint0000000000000000000000000002'])
    expect(r.excluidas).toBe(2)
    expect(r.proxima).toBe('CAUQAA')
    expect(r.total).toBe(4)
    expect(r.itens[0]).toMatchObject({ title: 'Viagem à Ásia', item_count: 12, privacy: 'public', published_at: '2024-05-01T12:00:00Z' })
  })
  it('LL e FL também são filtrados', () => {
    const j = clone(fx('x3-playlists.json')) as { items: Array<{ id: string }> }
    j.items = [{ id: 'LLabc12345' }, { id: 'FLabc12345' }, { id: 'PLok1234567' }]
    const r = lerPaginaDePlaylists(j)
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens.map(p => p.playlist_id)).toEqual(['PLok1234567'])
    expect(r.excluidas).toBe(2)
  })
  it('itemCount ausente vira null (nunca 0); totalResults ausente vira total null; sem nextPageToken, proxima null', () => {
    const j = clone(fx('x3-playlists.json')) as Record<string, unknown>
    delete j.pageInfo
    delete j.nextPageToken
    const r = lerPaginaDePlaylists(j)
    if (ehForma(r)) throw new Error('forma')
    expect(r.total).toBeNull()
    expect(r.proxima).toBeNull()
    expect(r.itens[1]!.item_count).toBeNull()
  })
  it('sem items (array) ou fora da forma: porque forma', () => {
    expect(lerPaginaDePlaylists({})).toEqual({ porque: 'forma' })
    expect(lerPaginaDePlaylists({ items: 'x' })).toEqual({ porque: 'forma' })
    expect(lerPaginaDePlaylists(null)).toEqual({ porque: 'forma' })
    expect(lerPaginaDePlaylists({ items: [] })).toMatchObject({ itens: [], total: null })
  })
  it('o raw da versão traz o item inteiro sem etag', () => {
    const r = lerPaginaDePlaylists(fx('x3-playlists.json'))
    if (ehForma(r)) throw new Error('forma')
    const raw = r.itens[0]!.raw as Record<string, unknown>
    expect('etag' in raw).toBe(false)
    expect(raw).toHaveProperty('snippet.thumbnails')
    expect(raw).toHaveProperty('contentDetails.itemCount', 12)
  })
})

describe('X3 hashDaPlaylist', () => {
  const base = () => (fx('x3-playlists.json').items as unknown[])[0] as Record<string, unknown>
  const alterado = (f: (x: Mut) => void) => { const x = clone(base()) as unknown as Mut; f(x); return hashDaPlaylist(x) }
  it('igual com etag, itemCount, thumbnails e publishedAt diferentes', () => {
    const h = hashDaPlaylist(base())
    expect(alterado(x => { x.etag = 'outro' })).toBe(h)
    expect(alterado(x => { x.contentDetails.itemCount = 999 })).toBe(h)
    expect(alterado(x => { x.snippet.thumbnails = { default: { url: 'https://outro.test/b.jpg' } } })).toBe(h)
    expect(alterado(x => { x.snippet.publishedAt = '2020-01-01T00:00:00Z' })).toBe(h)
  })
  it('diferente com título, descrição, privacidade ou localizations diferentes', () => {
    const h = hashDaPlaylist(base())
    expect(alterado(x => { x.snippet.title = 'Novo' })).not.toBe(h)
    expect(alterado(x => { x.snippet.description = 'Novo' })).not.toBe(h)
    expect(alterado(x => { x.status.privacyStatus = 'unlisted' })).not.toBe(h)
    expect(alterado(x => { x.localizations.en.title = 'Outro' })).not.toBe(h)
  })
  it('estável com chaves em outra ordem', () => {
    const b = base() as unknown as Mut
    const invertido = { localizations: b.localizations, status: b.status, snippet: { title: b.snippet.title, description: b.snippet.description, channelId: b.snippet.channelId, channelTitle: b.snippet.channelTitle, localized: b.snippet.localized } }
    expect(hashDaPlaylist(invertido)).toBe(hashDaPlaylist(base()))
  })
})

describe('X3 lerPaginaDeItens', () => {
  it('lê videoId de 11 caracteres; descarta sem videoId válido e conta; lidos é o total antes do descarte', () => {
    const r = lerPaginaDeItens(fx('x3-itens.json'))
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens.map(i => i.item_id)).toEqual(['item-aaa', 'item-bbb'])
    expect(r.descartados).toBe(2)
    expect(r.lidos).toBe(4)
    expect(r.total).toBe(5)
    expect(r.itens[0]).toMatchObject({ youtube_video_id: 'abcdefghijk', position: 0, added_at: '2025-01-02T10:00:00Z', video_published_at: '2024-12-30T08:00:00Z', video_owner_channel_id: 'UCdono', privacy: 'public', note: 'parte 1' })
  })
  it('vídeo apagado entra com dono null; position ausente vira null; note ausente vira null', () => {
    const r = lerPaginaDeItens(fx('x3-itens.json'))
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens[1]).toMatchObject({ video_owner_channel_id: null, privacy: 'private', note: null, position: 1 })
    const j = clone(fx('x3-itens.json')) as { items: Array<{ snippet: Record<string, unknown> }> }
    delete j.items[0]!.snippet.position
    const r2 = lerPaginaDeItens(j)
    if (ehForma(r2)) throw new Error('forma')
    expect(r2.itens[0]!.position).toBeNull()
  })
  it('totalResults ausente é null (nunca 0); sem items é forma; nunca guarda título nem descrição', () => {
    const j = clone(fx('x3-itens.json')) as Record<string, unknown>
    delete j.pageInfo
    const r = lerPaginaDeItens(j)
    if (ehForma(r)) throw new Error('forma')
    expect(r.total).toBeNull()
    expect(lerPaginaDeItens({})).toEqual({ porque: 'forma' })
    expect(Object.keys(r.itens[0]!)).not.toContain('title')
    expect(Object.keys(r.itens[0]!)).not.toContain('description')
  })
  it('a nota do criador é sanitizada (NUL sai)', () => {
    const j = clone(fx('x3-itens.json')) as { items: Array<{ contentDetails: Record<string, unknown> }> }
    j.items[0]!.contentDetails.note = 'a\u0000b'
    const r = lerPaginaDeItens(j)
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens[0]!.note).toBe('ab')
  })
})

describe('X3 lerSecoes', () => {
  it('ordena por snippet.position e tira etag', () => {
    const r = lerSecoes(fx('x3-secoes.json'))
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens.map(s => (s as { id: string }).id)).toEqual(['sec-a', 'sec-b'])
    expect(JSON.stringify(r.itens)).not.toContain('"etag"')
    expect(r.sha).toMatch(/^[0-9a-f]{64}$/)
  })
  it('o hash não depende do etag nem da ordem de chegada', () => {
    const j = clone(fx('x3-secoes.json')) as { items: Array<Record<string, unknown>> }
    const h = (lerSecoes(j) as { sha: string }).sha
    j.items.reverse()
    j.items.forEach(x => { x.etag = 'z' })
    expect((lerSecoes(j) as { sha: string }).sha).toBe(h)
  })
  it('sem items é forma; items vazio é lista vazia (não forma)', () => {
    expect(lerSecoes({})).toEqual({ porque: 'forma' })
    const r = lerSecoes({ items: [] })
    if (ehForma(r)) throw new Error('forma')
    expect(r.itens).toEqual([])
  })
})

describe('X3 erroDaApi', () => {
  const corpo = (reason: string) => ({ error: { errors: [{ reason }] } })
  it('403 quotaExceeded é cota; 404 playlistNotFound é playlist sumiu; o resto é api', () => {
    expect(erroDaApi(403, corpo('quotaExceeded'))).toBe('cota')
    expect(erroDaApi(404, corpo('playlistNotFound'))).toBe('playlist_sumiu')
    expect(erroDaApi(403, corpo('forbidden'))).toBe('api')
    expect(erroDaApi(404, corpo('channelNotFound'))).toBe('api')
    expect(erroDaApi(500, null)).toBe('api')
    expect(erroDaApi(0, undefined)).toBe('api')
  })
})
