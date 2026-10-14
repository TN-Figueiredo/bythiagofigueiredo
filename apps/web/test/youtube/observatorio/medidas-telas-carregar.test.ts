// A5 E5a, Tarefa 2: carregarMedidasDoSite (leitura por canal, cache só do lido por inteiro, prazo, seis ao mesmo tempo).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'

const cacheMem = vi.hoisted(() => new Map<string, unknown>())
vi.mock('next/cache', () => ({
  // imita o do Next: a chave é keyParts + argumentos; o que lança não é guardado
  unstable_cache: (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[]) => async (...a: unknown[]) => {
    const k = JSON.stringify([keyParts, a])
    if (cacheMem.has(k)) return cacheMem.get(k)
    const v = await fn(...a)
    cacheMem.set(k, v)
    return v
  },
  revalidateTag: () => undefined,
}))
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

import { carregarMedidasDoSite, type IObservatorioDeMedidas } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { aplanar } from '@/lib/youtube/observatorio/medidas-telas/insumos-planos'
import { multiplosDoCanal as daqui } from '@/lib/youtube/observatorio/medidas-telas/multiplos'
import { multiplosDoCanal as doMotor } from '@/lib/youtube/observatorio/medidas-multiplos'
import { falsoPostgrest, insumosCheios, type Linha } from './medidas-fixture'

const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const MIN = 60_000
const LAST = Date.UTC(2026, 9, 14, 10, 0, 0)

const canalRow = (id: string, site = 's1'): Linha => ({ id, site_id: site, collection_paused_at: null, missing_since: null, subscribers_hidden: false, last_ok_synced_at: new Date(LAST).toISOString() })
const videoRow = (id: string, canal: string, dias: number): Linha => ({ id, competitor_channel_id: canal, video_id: 'yt' + id, published_at: new Date(T0 - dias * 864e5).toISOString(), is_short: false, view_count: 1000 })
function tabelas(canais: string[], comMarcas = true): Record<string, Linha[]> {
  const t: Record<string, Linha[]> = {
    competitor_channels: canais.map((c) => canalRow(c)),
    competitor_videos: canais.flatMap((c) => [videoRow(c + 'v1', c, 10), videoRow(c + 'v2', c, 40)]),
    competitor_channel_snapshots: [],
    competitor_video_daily: [], competitor_video_early: [],
  }
  if (comMarcas) { t.competitor_video_marks = []; t.competitor_video_mark_misses = [] }
  return t
}
const obsDe = (canais: string[], own: string[] = [], last: number | null = LAST): IObservatorioDeMedidas => ({
  channels: [...canais.map((id) => ({ id, own: false, sync: { last } })), ...own.map((id) => ({ id, own: true, sync: { last } }))],
  videos: [],
})
const doCanal = (r: { consultas: ReadonlyArray<{ tabela: string }> }, tabela: string) => r.consultas.filter((c) => c.tabela === tabela).length


type Gancho = (tabela: string, eqs: unknown[], seguir: () => PromiseLike<unknown>) => PromiseLike<unknown>
/** Embrulha o falso: cada consulta passa pelo gancho, que vê a tabela e os valores de `eq` e decide se segue ou substitui a resposta. */
function espiar(sb: SupabaseClient, gancho: Gancho): SupabaseClient {
  return new Proxy(sb, { get(alvo, prop) {
    if (prop !== 'from') return Reflect.get(alvo, prop)
    return (tabela: string) => {
      const eqs: unknown[] = []
      const embrulhar = (x: Record<string, (...a: unknown[]) => unknown>): unknown => new Proxy(x, { get(_, k: string) {
        if (k === 'then') return (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(gancho(tabela, eqs, () => new Promise((res, rej) => { (x.then as (o: unknown, f: unknown) => unknown)(res, rej) }))).then(ok, falha)
        const v = x[k]
        if (typeof v !== 'function') return v
        return (...a: unknown[]) => { if (k === 'eq') eqs.push(a[1]); const r = v.apply(x, a); return r === x ? embrulhar(x) : r }
      } })
      return embrulhar(alvo.from(tabela) as unknown as Record<string, (...a: unknown[]) => unknown>)
    }
  } })
}

beforeEach(() => { cacheMem.clear(); sentry.captureMessage.mockClear() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('E5a T2: dado ausente', () => {
  it('site sem canal: mapa vazio e zero consultas de canal', async () => {
    const f = falsoPostgrest(tabelas([]))
    const r = await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe([]), canais: [], agoraMs: T0 })
    expect(r.porCanal.size).toBe(0)
    expect(f.consultas.filter((c) => c.tabela !== 'competitor_channels' || c.filtros.some((x) => x.coluna === 'id')).length).toBe(0)
  })
  it('tabela de marcas ausente: o canal vem com a parte não lida e as outras medidas medidas', async () => {
    const f = falsoPostgrest(tabelas(['a'], false))
    const r = await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 })
    const m = r.porCanal.get('a')
    expect(m && 'naoCarregou' in m).toBe(false)
    expect(r.falhas).toContainEqual({ canal: 'a', medida: 'marcas', classe: 'schema_ausente' })
  })
  it('canal sem vídeo: medidas não medidas com motivo, nunca não carregou', async () => {
    const t = tabelas(['a']); t.competitor_videos = []
    const r = await carregarMedidasDoSite(falsoPostgrest(t).sb, { siteId: 's1', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 })
    const m = r.porCanal.get('a')
    expect(m !== undefined && !('naoCarregou' in m)).toBe(true)
    expect(r.falhas).toEqual([])
  })
  it('extras não lidos: Parte não lida, e as medidas seguem', async () => {
    const t = tabelas(['a'])
    const f = falsoPostgrest(t, { colunasAusentes: { competitor_channels: ['subscribers_hidden'] } })
    const r = await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 })
    expect(r.extras).toEqual({ lido: false, causa: 'schema_ausente' })
    expect(r.porCanal.get('a')).toBeDefined()
  })
  it('canal próprio na lista de entrada não gera consulta nem falha', async () => {
    const f = falsoPostgrest(tabelas(['a', 'meu']))
    const r = await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a'], ['meu']), canais: ['a', 'meu'], agoraMs: T0 })
    expect([...r.porCanal.keys()]).toEqual(['a'])
    expect(f.consultas.some((c) => c.filtros.some((x) => x.valor === 'meu'))).toBe(false)
    expect(r.falhas).toEqual([])
  })
})

describe('E5a T2: erro, cache e prazo', () => {
  it('erro do banco num canal não derruba os outros', async () => {
    const f = falsoPostgrest(tabelas(['a', 'b']))
    const ruim = espiar(f.sb, (_t, eqs, seguir) => (eqs.includes('b') ? Promise.resolve({ data: null, error: { code: 'XX000', message: 'x' } }) : seguir()))
    const r = await carregarMedidasDoSite(ruim, { siteId: 's1', obs: obsDe(['a', 'b']), canais: ['a', 'b'], agoraMs: T0 })
    expect(r.porCanal.get('b')).toEqual({ naoCarregou: 'erro_do_banco' })
    expect(r.porCanal.get('a') && 'naoCarregou' in r.porCanal.get('a')!).toBe(false)
  })
  it('resultado não lido não é guardado e lido é guardado', async () => {
    const f = falsoPostgrest(tabelas(['a'], false))
    const p = { siteId: 's1', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 }
    await carregarMedidasDoSite(f.sb, p)
    const n1 = doCanal(f, 'competitor_videos')
    await carregarMedidasDoSite(f.sb, p)
    expect(doCanal(f, 'competitor_videos')).toBe(n1 * 2)
    const g = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoSite(g.sb, p)
    const antes = g.consultas.filter((c) => c.tabela !== 'competitor_channels').length
    await carregarMedidasDoSite(g.sb, p)
    expect(g.consultas.filter((c) => c.tabela !== 'competitor_channels').length).toBe(antes)
  })
  it('tempo esgotado: os que faltaram são não carregou e esgotou diz quantos', async () => {
    vi.useFakeTimers()
    const f = falsoPostgrest(tabelas(['a', 'b']))
    const preso = espiar(f.sb, (_t, eqs, seguir) => (eqs.includes('b') ? new Promise(() => undefined) : seguir()))
    const prom = carregarMedidasDoSite(preso, { siteId: 's1', obs: obsDe(['a', 'b']), canais: ['a', 'b'], agoraMs: T0 })
    await vi.advanceTimersByTimeAsync(12_001)
    const r = await prom
    expect(r.porCanal.get('b')).toEqual({ naoCarregou: 'tempo_esgotado' })
    expect(r.esgotou).toBe(1)
    expect(r.porCanal.get('a') && 'naoCarregou' in r.porCanal.get('a')!).toBe(false)
  })
  it('entrada de 45 minutos com o banco saudável: lê de novo, sai medido e nenhum evento vai ao Sentry', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    const p = { siteId: 's1', obs: obsDe(['a']), canais: ['a'] }
    await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 })
    const n = doCanal(f, 'competitor_videos')
    const r = await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 + 45 * MIN })
    expect(doCanal(f, 'competitor_videos')).toBe(n + 1)
    expect(r.porCanal.get('a') && 'naoCarregou' in r.porCanal.get('a')!).toBe(false)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('entrada de 45 minutos com o banco falhando: não carregou com a causa do banco, nunca cache_vencido', async () => {
    const t = tabelas(['a'])
    const f = falsoPostgrest(t)
    const p = { siteId: 's1', obs: obsDe(['a']), canais: ['a'] }
    await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 })
    const g = falsoPostgrest(t, { erros: { competitor_channels: { code: 'XX000', message: 'x' } } })
    const r = await carregarMedidasDoSite(g.sb, { ...p, agoraMs: T0 + 45 * MIN })
    expect(r.porCanal.get('a')).toEqual({ naoCarregou: 'erro_do_banco' })
  })
  it('entrada de 16 minutos é lida de novo; de 10 minutos é usada sem consulta', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    const p = { siteId: 's1', obs: obsDe(['a']), canais: ['a'] }
    await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 })
    const n = doCanal(f, 'competitor_videos')
    await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 + 10 * MIN })
    expect(doCanal(f, 'competitor_videos')).toBe(n)
    await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 + 16 * MIN })
    expect(doCanal(f, 'competitor_videos')).toBe(n + 1)
  })
  it('extras com 45 minutos e o banco saudável: lidos de novo, e o valor novo vale', async () => {
    const t = tabelas(['a'])
    const f = falsoPostgrest(t)
    const p = { siteId: 's1', obs: obsDe(['a']), canais: ['a'] }
    await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 })
    t.competitor_channels![0]!.missing_since = '2026-10-14T00:00:00Z'
    const r = await carregarMedidasDoSite(f.sb, { ...p, agoraMs: T0 + 45 * MIN })
    expect(r.extras.lido && r.extras.dados.get('a')?.missingSince).toBe('2026-10-14T00:00:00Z')
  })
  it('canal sem sincronização boa: duas chamadas seguidas consultam o banco nas duas', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    const p = { siteId: 's1', obs: obsDe(['a'], [], null), canais: ['a'], agoraMs: T0 }
    await carregarMedidasDoSite(f.sb, p)
    await carregarMedidasDoSite(f.sb, p)
    expect(doCanal(f, 'competitor_videos')).toBe(2)
  })
  it('com o cache do Observatório desligado, nenhum canal é guardado', async () => {
    vi.stubEnv('OBS_E2E', '1')
    const f = falsoPostgrest(tabelas(['a']))
    const p = { siteId: 's1', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 }
    await carregarMedidasDoSite(f.sb, p)
    await carregarMedidasDoSite(f.sb, p)
    expect(doCanal(f, 'competitor_videos')).toBe(2)
  })
  it('sincronização nova muda a chave: a segunda chamada consulta de novo', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a'], [], LAST), canais: ['a'], agoraMs: T0 })
    await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a'], [], LAST + MIN), canais: ['a'], agoraMs: T0 })
    expect(doCanal(f, 'competitor_videos')).toBe(2)
  })
  it('duas falhas da mesma medida e causa em canais diferentes saem com a mesma impressão digital', async () => {
    const f = falsoPostgrest(tabelas(['a', 'b'], false))
    await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a', 'b']), canais: ['a', 'b'], agoraMs: T0 })
    const dedos = sentry.captureMessage.mock.calls.map((c) => JSON.stringify((c[1] as { fingerprint: string[] }).fingerprint))
    expect(dedos.filter((d) => d === JSON.stringify(['medidas-telas', 'marcas', 'schema_ausente'])).length).toBe(2)
  })
})

describe('E5a T2: fronteira e provas por mutação', () => {
  it('nunca mais de seis ao mesmo tempo', async () => {
    const ids = Array.from({ length: 14 }, (_, k) => 'c' + k)
    const f = falsoPostgrest(tabelas(ids))
    let agora = 0, pico = 0
    const lento = espiar(f.sb, (tabela, _e, seguir) => {
      if (tabela !== 'competitor_videos') return seguir()
      agora++; pico = Math.max(pico, agora)
      return new Promise((res) => setTimeout(res, 5)).then(() => { agora--; return seguir() })
    })
    const r = await carregarMedidasDoSite(lento, { siteId: 's1', obs: obsDe(ids), canais: ids, agoraMs: T0 })
    expect(r.porCanal.size).toBe(14)
    expect(pico).toBeLessThanOrEqual(6)
    expect(pico).toBeGreaterThan(1)
  })
  it('a série só é pedida para os vídeos de seriesDe; sem seriesDe, zero consultas de série', async () => {
    const f = falsoPostgrest(tabelas(['a', 'b']))
    const p = { siteId: 's1', obs: obsDe(['a', 'b']), canais: ['a', 'b'], agoraMs: T0 }
    await carregarMedidasDoSite(f.sb, p)
    expect(doCanal(f, 'competitor_video_daily')).toBe(0)
    cacheMem.clear()
    await carregarMedidasDoSite(f.sb, { ...p, seriesDe: new Map([['a', ['av1']]]) })
    const daily = f.consultas.filter((c) => c.tabela === 'competitor_video_daily')
    expect(daily.length).toBe(1)
    expect(daily[0]!.filtros).toContainEqual({ op: 'in', coluna: 'video_id', valor: ['av1'] })
  })
  it('o tamanho em JSON do maior canal da fixture fica abaixo de 1 MB', () => {
    expect(JSON.stringify(aplanar(insumosCheios())).length).toBeLessThan(1_000_000)
  })
  it('multiplos.ts só reexporta; nem ele nem carregar-do-site.ts derivam múltiplo', () => {
    expect(daqui).toBe(doMotor)
    const base = 'src/lib/youtube/observatorio/medidas-telas/'
    for (const a of ['multiplos.ts', 'carregar-do-site.ts']) {
      const txt = readFileSync(base + a, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(txt).not.toMatch(/\.mult\b|multiplier/)
    }
  })
  it('MUTAÇÃO: um id de canal de outro site devolve canal_de_outro_site e nenhuma medida', async () => {
    const t = tabelas(['a']); t.competitor_channels!.push(canalRow('x', 's2')); t.competitor_videos!.push(videoRow('xv', 'x', 5))
    const f = falsoPostgrest(t)
    const r = await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a']), canais: ['x'], agoraMs: T0 })
    expect(r.porCanal.get('x')).toEqual({ naoCarregou: 'canal_de_outro_site' })
    expect(doCanal(f, 'competitor_videos')).toBe(0)
  })
  it('MUTAÇÃO: a chave do cache separa dois sites com o mesmo id de canal', async () => {
    const t = tabelas(['a'])
    const f = falsoPostgrest(t)
    await carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 })
    const n = doCanal(f, 'competitor_videos')
    const r2 = await carregarMedidasDoSite(f.sb, { siteId: 's2', obs: obsDe(['a']), canais: ['a'], agoraMs: T0 })
    expect(doCanal(f, 'competitor_videos')).toBe(n)
    expect(r2.porCanal.get('a')).toEqual({ naoCarregou: 'canal_de_outro_site' })
  })
})
