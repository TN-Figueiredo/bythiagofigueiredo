// @vitest-environment node
/** O que a página /cms/youtube lê para o cadastro: slug/nicho/idioma de cada canal e os nichos com as contagens de uso. */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
import { loadChannelRegistry } from '@/lib/youtube/channel-registry-db'

type Res = { data: unknown; error: { code?: string; message: string } | null }
const VIAGEM = { slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 }
const IA = { slug: 'ia', label: 'IA', color_dark: '#6EA8FE', color_light: '#1D4ED8', sort_order: 20 }
const JOGOS = { slug: 'jogos', label: 'Jogos', color_dark: '#D29AE8', color_light: '#7B2A91', sort_order: 30 }

/** Cliente falso: a resposta de cada tabela sai de `answer(table, cols)`; registra os filtros. */
function client(answer: (table: string, cols: string) => Res) {
  const calls: Array<{ table: string; cols: string; filters: Array<[string, unknown]> }> = []
  const sb = {
    from: (table: string) => ({
      select: (cols: string) => {
        const call = { table, cols, filters: [] as Array<[string, unknown]> }
        calls.push(call)
        const q = {
          eq: (c: string, v: unknown) => { call.filters.push([c, v]); return q },
          order: () => q,
          then: (ok: (r: Res) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer(table, cols)).then(ok, bad),
        }
        return q
      },
    }),
  }
  return { sb: sb as unknown as SupabaseClient, calls }
}
const full = (over: Partial<Record<string, Res>> = {}) => (table: string): Res => over[table] ?? ({
  youtube_channels: { data: [
    { id: 'c1', locale: 'pt', slug: 'tnfigueiredo', niche: 'viagem' },
    { id: 'c2', locale: 'en', slug: 'thiago-figueiredo', niche: 'viagem' },
    { id: 'c3', locale: 'pt', slug: 'joga', niche: null },
  ], error: null },
  youtube_niches: { data: [VIAGEM, IA, JOGOS], error: null },
  competitor_channels: { data: [{ niche: 'viagem' }, { niche: 'viagem' }, { niche: 'ia' }, { niche: null }], error: null },
} as Record<string, Res>)[table]!

describe('loadChannelRegistry', () => {
  it('identidade de cada canal e os nichos na ordem das abas, com quantos canais próprios e quantos concorrentes usam cada um', async () => {
    const { sb, calls } = client(full())
    const r = await loadChannelRegistry(sb, 's1')
    expect(r.identity.get('c1')).toEqual({ locale: 'pt', slug: 'tnfigueiredo', niche: 'viagem' })
    expect(r.identity.get('c3')).toEqual({ locale: 'pt', slug: 'joga', niche: null })
    expect(r.nichesAvailable).toBe(true)
    expect(r.niches).toEqual([
      { slug: 'viagem', label: 'Viagem', dark: '#5BBF8A', light: '#11692F', builtin: true, channels: 2, competitors: 2 },
      { slug: 'ia', label: 'IA', dark: '#6EA8FE', light: '#1D4ED8', builtin: true, channels: 0, competitors: 1 },
      { slug: 'jogos', label: 'Jogos', dark: '#D29AE8', light: '#7B2A91', builtin: false, channels: 0, competitors: 0 },
    ])
    // tudo filtrado pelo site
    for (const c of calls) expect(c.filters).toContainEqual(['site_id', 's1'])
  })

  it('o dado não existe — site sem canais e sem concorrentes: os nichos aparecem com zero', async () => {
    const { sb } = client(full({ youtube_channels: { data: [], error: null }, competitor_channels: { data: [], error: null }, youtube_niches: { data: [VIAGEM, IA], error: null } }))
    const r = await loadChannelRegistry(sb, 's1')
    expect(r.identity.size).toBe(0)
    expect(r.niches.map(n => [n.slug, n.channels, n.competitors])).toEqual([['viagem', 0, 0], ['ia', 0, 0]])
  })

  it.each(['42P01', 'PGRST205'])('o dado não existe — tabela de nichos ausente (%s): valem os de fábrica e não dá para criar', async (code) => {
    const { sb } = client(full({ youtube_niches: { data: null, error: { code, message: 'no table' } } }))
    const r = await loadChannelRegistry(sb, 's1')
    expect(r.nichesAvailable).toBe(false)
    expect(r.niches.map(n => [n.slug, n.builtin, n.channels])).toEqual([['viagem', true, 2], ['ia', true, 0]])
  })

  it.each(['42703', 'PGRST204'])('o dado não existe — coluna slug ausente (%s): relê sem ela e os canais vêm sem slug', async (code) => {
    const { sb, calls } = client((table, cols) => table === 'youtube_channels'
      ? cols.includes('slug') ? { data: null, error: { code, message: 'column youtube_channels.slug does not exist' } }
        : { data: [{ id: 'c1', locale: 'pt', niche: 'viagem' }], error: null }
      : full()(table))
    const r = await loadChannelRegistry(sb, 's1')
    expect(r.identity.get('c1')).toEqual({ locale: 'pt', slug: null, niche: 'viagem' })
    expect(calls.filter(c => c.table === 'youtube_channels').map(c => c.cols)).toEqual(['id, locale, slug, niche', 'id, locale, niche'])
  })

  it('a leitura de concorrentes falha: a contagem fica desconhecida (null), nunca zero inventado, e a página não quebra', async () => {
    const { sb } = client(full({ competitor_channels: { data: null, error: { code: '57014', message: 'timeout' } } }))
    const r = await loadChannelRegistry(sb, 's1')
    expect(r.niches.map(n => n.competitors)).toEqual([null, null, null])
    expect(r.niches[0]!.channels).toBe(2)
  })

  it('erro de verdade na leitura dos nichos ou dos canais não vira "tabela ausente": degrada sem lançar e sem permitir criar', async () => {
    const a = await loadChannelRegistry(client(full({ youtube_niches: { data: null, error: { code: '57014', message: 'timeout' } } })).sb, 's1')
    expect(a.nichesAvailable).toBe(false)
    expect(a.niches.map(n => n.slug)).toEqual(['viagem', 'ia'])
    const b = await loadChannelRegistry(client(full({ youtube_channels: { data: null, error: { code: '57014', message: 'timeout' } } })).sb, 's1')
    expect(b.identity.size).toBe(0)
  })
})
