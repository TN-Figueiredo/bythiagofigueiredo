// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))
import { readNiches, nicheDefs, type NicheRow } from '@/lib/youtube/observatorio/niches-db'
import { ObservatoryLoadError, loadDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { BUILTIN_NICHES } from '@/lib/youtube/observatorio/niche'

type Res = { data: unknown; error: { code?: string; message: string } | null }
function fake(res: Res) {
  const calls: string[] = []
  const q = { eq: (c: string, v: string) => { calls.push('eq:' + c + '=' + v); return q }, order: (c: string) => { calls.push('order:' + c); return q }, then: (ok: (r: Res) => unknown) => Promise.resolve(res).then(ok) }
  const sb = { from: (t: string) => { calls.push('from:' + t); return { select: (c: string) => { calls.push('select:' + c); return q } } } } as unknown as SupabaseClient
  return { sb, calls }
}
const viagem: NicheRow = { slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 }
const ia: NicheRow = { slug: 'ia', label: 'IA', color_dark: '#6EA8FE', color_light: '#1D4ED8', sort_order: 20 }
const jogos: NicheRow = { slug: 'jogos', label: 'Jogos', color_dark: '#D29AE8', color_light: '#7B2A91', sort_order: 100 }

describe('readNiches', () => {
  it('leitura boa → as linhas do site, filtradas por site_id', async () => {
    const { sb, calls } = fake({ data: [viagem, ia, jogos], error: null })
    expect(await readNiches(sb, 's1')).toEqual([viagem, ia, jogos])
    expect(calls).toContain('from:youtube_niches')
    expect(calls).toContain('eq:site_id=s1')
  })
  it.each(['42P01', 'PGRST205'])('tabela ausente (%s) → null (valem os de fábrica), sem lançar', async code => {
    const { sb } = fake({ data: null, error: { code, message: 'relation "public.youtube_niches" does not exist' } })
    expect(await readNiches(sb, 's1')).toBeNull()
  })
  it('outro erro é lançado como ObservatoryLoadError de youtube_niches (nunca vira "só os de fábrica" em silêncio)', async () => {
    const { sb } = fake({ data: null, error: { code: '57014', message: 'timeout' } })
    const e = await readNiches(sb, 's1').catch(x => x)
    expect(e).toBeInstanceOf(ObservatoryLoadError)
    expect(e.table).toBe('youtube_niches')
    expect(e.code).toBe('57014')
  })
  it('erro sem código também é lançado', async () => {
    const { sb } = fake({ data: null, error: { message: 'fetch failed' } })
    await expect(readNiches(sb, 's1')).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('tabela presente e vazia → lista vazia (nicheDefs decide)', async () => {
    const { sb } = fake({ data: [], error: null })
    expect(await readNiches(sb, 's1')).toEqual([])
  })
})

describe('nicheDefs', () => {
  it('null e vazio → os dois de fábrica', () => {
    expect(nicheDefs(null)).toEqual(BUILTIN_NICHES)
    expect(nicheDefs(undefined)).toEqual(BUILTIN_NICHES)
    expect(nicheDefs([])).toEqual(BUILTIN_NICHES)
  })
  it('linhas → defs; builtin só em viagem e ia', () => {
    const d = nicheDefs([jogos, ia, viagem])
    expect(d.map(x => [x.id, x.builtin])).toEqual([['jogos', false], ['ia', true], ['viagem', true]])
    expect(d[0]).toEqual({ id: 'jogos', label: 'Jogos', color: { dark: '#D29AE8', light: '#7B2A91' }, order: 100, builtin: false })
  })
  it('linha com slug mal formado ou repetido fica de fora (nunca vira aba quebrada)', () => {
    const d = nicheDefs([viagem, ia, { ...jogos, slug: 'Não Vale' }, jogos, { ...jogos, label: 'Outro' }])
    expect(d.map(x => x.id)).toEqual(['viagem', 'ia', 'jogos'])
    expect(d[2]!.label).toBe('Jogos')
  })
})

/* The whole loader (loadRows → rowsToDataset) against a client where every table answers; only youtube_niches varies. */
function db(niches: Res, channels: unknown[] = []) {
  const tables: string[] = []
  const sb = { from(table: string) {
    tables.push(table)
    const res: Res = table === 'youtube_niches' ? niches : table === 'competitor_channels' ? { data: channels, error: null } : { data: [], error: null }
    const builder: object = new Proxy({}, { get(_t, prop) {
      if (prop === 'then') return (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko)
      if (prop === 'maybeSingle') return async () => ({ data: null, error: null })
      return () => builder
    } })
    return builder
  } } as unknown as SupabaseClient
  return { sb, tables }
}
const NOW = Date.parse('2026-10-24T18:02:00Z')
const competitor = (niche: string) => ({ id: 'c1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 10, niche, video_limit: 50, youtube_video_count: 0,
  sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: new Date(NOW - 36e5).toISOString(), last_synced_at: null, full_sync_completed_at: null, added_at: new Date(NOW - 864e5).toISOString() })

describe('loadDataset — youtube_niches', () => {
  it.each(['42P01', 'PGRST205'])('tabela ausente (%s): a tela não quebra — valem Viagem e IA, com as cores de hoje', async code => {
    const { sb, tables } = db({ data: null, error: { code, message: 'relation "public.youtube_niches" does not exist' } }, [competitor('viagem')])
    const ds = await loadDataset({ siteId: 's1', now: NOW, supabase: sb })
    expect(tables).toContain('youtube_niches')
    expect(ds.niches).toEqual(BUILTIN_NICHES)
    const obs = createObservatory(ds)
    expect(obs.integrity.ok).toBe(true)
    expect(obs.niches.map(n => [n.id, n.label, n.color.dark])).toEqual([['viagem', 'Viagem', '#5BBF8A'], ['ia', 'IA', '#6EA8FE']])
    expect(obs.tabCounts('viagem').canais).toBe(1)
  })
  it('tabela ausente e um canal num nicho que só existiria nela: o canal continua na tela, sem nicho', async () => {
    const { sb } = db({ data: null, error: { code: '42P01', message: 'x' } }, [competitor('jogos')])
    const obs = createObservatory(await loadDataset({ siteId: 's1', now: NOW, supabase: sb }))
    expect(obs.channel('c1')!.niche).toBeNull()
    expect(obs.tabCounts('todos').canais).toBe(1)
  })
  it('tabela presente: o nicho criado pelo dono vira aba e o canal dele aparece nela', async () => {
    const { sb } = db({ data: [viagem, ia, jogos], error: null }, [competitor('jogos')])
    const obs = createObservatory(await loadDataset({ siteId: 's1', now: NOW, supabase: sb }))
    expect(obs.niches.map(n => n.id)).toEqual(['viagem', 'ia', 'jogos'])
    expect(obs.channel('c1')!.niche).toBe('jogos')
    expect(obs.tabCounts('jogos').canais).toBe(1)
  })
  it('outro erro em youtube_niches derruba a carga (nunca "só os de fábrica" em silêncio)', async () => {
    const { sb } = db({ data: null, error: { code: '57014', message: 'timeout' } })
    const e = await loadDataset({ siteId: 's1', now: NOW, supabase: sb }).catch(x => x)
    expect(e).toBeInstanceOf(ObservatoryLoadError)
    expect(e.table).toBe('youtube_niches')
  })
})
