// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { inscritosDoCanal, passoDoYouTube, REGRAS_INSCRITOS } from '@/lib/youtube/observatorio/inscritos-28d'
import { DAY, H, spDayStart } from '@/lib/youtube/observatorio/time'
import type { ObsChannel, ChannelSnapshot } from '@/lib/youtube/observatorio/types'

const AGORA = Date.UTC(2026, 5, 15, 15, 0) // fixture sintética; todas as datas saem daqui
const dia = (ms: number) => spDayStart(ms) + 12 * H
const dmy = (t: number) => { const d = new Date(t - 3 * H); const p = (n: number) => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() }
const snap = (agoraMs: number, atras: number, subs: number): ChannelSnapshot => { const t = dia(agoraMs) - atras * DAY; return { t, date: dmy(t), subs, views: 0 } }

function canal(over: Partial<ObsChannel> = {}): ObsChannel {
  return {
    id: 'c1', name: 'C1', fullName: 'Canal 1', niche: null, own: false, lang: 'pt', subs: 1000, video_limit: 50, url: '', handle: '@c1',
    gender: 'n', color: '#000', ini: 'C', undated: [], activity: { state: 'ativo' }, lastIdx: null, snapshots: [],
    sync: { state: 'ok', last: AGORA, next: null, added: null, errorSince: null, msg: null, backfill: null },
    ...over,
  }
}
/** hoje (atrás 0 por padrão) e antes (28 dias atrás). */
const par = (antes: number, hoje: number, now = AGORA, atrasHoje = 0, atrasAntes = 28) =>
  canal({ subs: hoje, snapshots: [snap(now, atrasAntes, antes), snap(now, atrasHoje, hoje)] })
const calc = (c: ObsChannel, now = AGORA) => inscritosDoCanal(c, { agoraMs: now })

describe('passoDoYouTube', () => {
  it('0 abaixo de 1.000 e 10^(⌊log10 n⌋−2) a partir dele', () => {
    const casos: Array<[number, number]> = [[999, 0], [1000, 10], [9999, 10], [10000, 100], [99999, 100], [100000, 1000], [1000000, 10000]]
    for (const [n, p] of casos) expect(passoDoYouTube(n)).toBe(p)
  })
  it('paridade com a unidade de roundingOf (channels.ts): mesma década, mesmo passo', () => {
    for (let n = 1000; n < 2_000_000; n = Math.round(n * 1.37) + 1) expect(passoDoYouTube(n)).toBe(Math.pow(10, Math.floor(Math.log10(n)) - 2))
  })
})

describe('inscritosDoCanal: dado ausente', () => {
  it('sem retratos: ainda_nao_coletado, hoje nulo', () => {
    expect(calc(canal({ snapshots: [] }))).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado', hoje: null })
  })
  it('subs nulo com retratos antigos: oculto, nunca ganho', () => {
    const r = calc(canal({ subs: null, snapshots: [snap(AGORA, 28, 100), snap(AGORA, 0, 200)] }))
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'oculto' })
  })
  it('sem retrato de 28 a 31 dias antes: buraco com a data, nunca ganho', () => {
    const c = canal({ subs: 500, snapshots: [snap(AGORA, 40, 400), snap(AGORA, 27, 450), snap(AGORA, 0, 500)] })
    const r = calc(c)
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'buraco' })
    expect((r as { data?: string }).data).toMatch(/^\d{2}\/\d{2}$/)
    expect((r as { data?: string }).data).toBe(dmy(dia(AGORA) - 28 * DAY).slice(0, 5))
  })
  it('canal próprio: canal_proprio mesmo com retratos à mão', () => {
    expect(calc({ ...par(100, 200), own: true })).toMatchObject({ tipo: 'nm', motivo: 'canal_proprio' })
  })
})

describe('inscritosDoCanal: tempo', () => {
  it('primeiro retrato há 11 dias: novo, 11 dias e faltam 17', () => {
    const c = canal({ snapshots: [snap(AGORA, 11, 900), snap(AGORA, 0, 950)] })
    expect(calc(c)).toMatchObject({ tipo: 'nm', motivo: 'novo', diasDeHistorico: 11, faltam: 17 })
  })
  it('há 28 dias: medido', () => { expect(calc(par(500, 600))).toMatchObject({ tipo: 'ok', ganho: 100 }) })
  it('retrato mais novo 3 dias antes do relógio: retrato_velho com a data; 2 dias: medido', () => {
    const velho = calc(par(500, 600, AGORA, 3, 31))
    expect(velho).toMatchObject({ tipo: 'nm', motivo: 'retrato_velho' })
    expect((velho as { data?: string }).data).toBe(dmy(dia(AGORA) - 3 * DAY).slice(0, 5))
    expect(calc(par(500, 600, AGORA, 2, 30)).tipo).toBe('ok')
  })
  it('todos os canais com retrato de 4 dias atrás: todos retrato_velho', () => {
    const rs = [par(500, 600, AGORA, 4, 32), par(700, 900, AGORA, 4, 32)].map(c => calc(c))
    // 32 dias de distância fica fora de 28 a 31, mas o retrato velho vem antes do buraco
    for (const r of rs) expect(r).toMatchObject({ tipo: 'nm', motivo: 'retrato_velho' })
  })
  it('sem o de 28 dias, com o de 30: medido, de = dia − 30', () => {
    const r = calc(par(500, 600, AGORA, 0, 30))
    expect(r).toMatchObject({ tipo: 'ok' })
    expect((r as { de: string }).de).toBe(dmy(dia(AGORA) - 30 * DAY))
    expect((r as { ate: string }).ate).toBe(dmy(dia(AGORA)))
  })
  it('virada do mês e do ano: medido', () => {
    for (const now of [Date.UTC(2026, 5, 2, 15), Date.UTC(2027, 0, 3, 15)]) {
      const r = calc(par(500, 600, now, 0, 29), now)
      expect(r.tipo).toBe('ok')
      expect((r as { de: string }).de).toBe(dmy(dia(now) - 29 * DAY))
    }
  })
})

describe('inscritosDoCanal: arredondamento', () => {
  it('pares do mockup', () => {
    expect(calc(par(1_390_000, 1_420_000))).toMatchObject({ tipo: 'ok', ganho: 30000, classe: 'up' })
    expect(calc(par(602_000, 603_000))).toMatchObject({ tipo: 'nm', motivo: 'arred', passo: 1000 })
    expect(calc(par(9_900, 9_800))).toMatchObject({ tipo: 'ok', ganho: -100, classe: 'dn' })
    expect(calc(par(640, 640))).toMatchObject({ tipo: 'ok', ganho: 0, classe: 'eq' })
    expect(calc(par(143_000, 143_000))).toMatchObject({ tipo: 'nm', motivo: 'arred' })
    expect(calc(par(820, 980))).toMatchObject({ tipo: 'ok', ganho: 160 })
  })
  it('passo do maior: antes 900, hoje 1.200 passo 10, medido', () => {
    expect(calc(par(900, 1200))).toMatchObject({ tipo: 'ok', ganho: 300 })
  })
  it('antes 0: pct nulo', () => {
    expect(calc(par(0, 50))).toMatchObject({ tipo: 'ok', ganho: 50, pct: null })
  })
  it('pct = ganho / antes × 100', () => {
    expect((calc(par(1000, 1100)) as { pct: number }).pct).toBeCloseTo(10)
  })
  it('regra do passo: |ganho| < 2 × passo é arred; ≥ é medido (varre uma década)', () => {
    for (const antes of [5_000, 48_000, 250_000, 3_000_000]) {
      const p = passoDoYouTube(antes)
      expect(calc(par(antes, antes + 2 * p - 1)).tipo).toBe('nm')
      expect(calc(par(antes, antes + 2 * p)).tipo).toBe('ok')
    }
  })
})

describe('REGRAS_INSCRITOS', () => {
  it('constantes do plano', () => {
    expect(REGRAS_INSCRITOS).toEqual({ janelaDias: 28, folgaDias: 3, exatoAbaixoDe: 1000, multiploDoPasso: 2, retratoVelhoDias: 2 })
  })
})
