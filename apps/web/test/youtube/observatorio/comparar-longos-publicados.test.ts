// @vitest-environment node
// Portão Phil 17/10 (C1, I1, I3, M1): a contagem "Longos publicados" só vale com o período anterior coberto, não inventa percentual com base 0
// e conta só longos de formato confirmado, sem lives e sem estreias agendadas.
import { describe, expect, it, vi } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { medidasDoLado, pctDaContagem, type MedidasDoCanalPack, type MedidasPlanas } from '@/app/cms/(authed)/youtube/competitors/_comparar/medidas-do-lado'
import { anteriorCoberto } from '@/lib/youtube/observatorio/medidas-telas/cobertura'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import type { Dataset } from '@/lib/youtube/observatorio/types'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const DAY = 86_400_000
const CH = 'leo-khev'
const OK = { ok: true } as const
const FORA0 = { semFormato: 0, aoVivo: 0, agendados: 0 }

describe('anteriorCoberto', () => {
  const now = Date.UTC(2026, 9, 16)
  const h = (o: Partial<Parameters<typeof anteriorCoberto>[0]> = {}) => ({ desde: now - 51 * DAY, guardados: 50, noYouTube: 900, backfill: false, ...o })
  it('o mais antigo a 51 dias e o canal tem 900 no YouTube: não coberto', () => {
    expect(anteriorCoberto(h(), now)).toEqual({ ok: false, desde: now - 51 * DAY })
  })
  it('canal pequeno com o histórico inteiro guardado: coberto', () => {
    expect(anteriorCoberto(h({ noYouTube: 50 }), now)).toEqual({ ok: true })
  })
  it('em backfill: não coberto, mesmo com o mais antigo a 200 dias', () => {
    expect(anteriorCoberto(h({ backfill: true, desde: now - 200 * DAY }), now).ok).toBe(false)
  })
  it('o mais antigo a 200 dias: coberto', () => {
    expect(anteriorCoberto(h({ desde: now - 200 * DAY }), now)).toEqual({ ok: true })
  })
  it('sem vídeo com data e sem contagem do YouTube: não coberto', () => {
    expect(anteriorCoberto(h({ desde: null, guardados: 0, noYouTube: null }), now)).toEqual({ ok: false, desde: null })
  })
  it('nem só o "alcança" nem só o "tudo guardado" bastam quando falta o outro E o backfill', () => {
    // mutante: trocar o E do backfill por OU
    expect(anteriorCoberto(h({ noYouTube: 50, backfill: true }), now).ok).toBe(false)
  })
})

describe('contagem na célula (medidasDoLado)', () => {
  const J = { de: '2026-07-01', ate: '2026-09-30', dias: 90 }
  const med = <T,>(valor: T, n = 10) => ({ estado: 'medido' as const, valor, n, janela: J, notas: [] })
  const nao = () => ({ estado: 'nao_medido' as const, motivo: 'poucos_videos', notas: [] })
  const m = {
    m3a: med({ variacao: 0.3, direcao: 'subindo', ganhoRecente: 130_000, ganhoAnterior: 100_000 }), m3b: nao(), m3c: nao(),
    m1: { 1: nao(), 7: nao(), 30: nao() }, m4: nao(), m7: nao(), m8: { estado: med('ativo'), parado: nao(), queda: nao() },
  } as unknown as MedidasPlanas
  const lado = (longos: MedidasDoCanalPack['longos']) => medidasDoLado({
    id: 'x', own: false, medidasDoLado: { fonte: { tipo: 'medidas', m, extras: null }, videosN: 20, buscando: false, ultimaBoa: null, longos },
  }, '2026-10-16').pub

  it('período anterior sem cobertura: não medido, nunca "N contra 0"', () => {
    const c = lado({ recente: 14, anterior: 0, cobertura: { ok: false, desde: '2026-08-26' }, fora: FORA0 })
    expect(c).toMatchObject({ tipo: 'nao_medido', motivo: 'leitura_comecou_depois' })
    expect(JSON.stringify(c)).toContain('26/08')
  })
  it('base zero com cobertura: subindo, sem percentual', () => {
    const c = lado({ recente: 3, anterior: 0, cobertura: OK, fora: FORA0 })
    expect(c).toMatchObject({ tipo: 'medido', simbolo: 'sobe', pct: null })
    expect(pctDaContagem({ recente: 3, anterior: 0 })).toBeNull()
  })
  it('de 3 para 0 é queda real de 100%', () => {
    const c = lado({ recente: 0, anterior: 3, cobertura: OK, fora: FORA0 })
    expect(c).toMatchObject({ tipo: 'medido', simbolo: 'desce', pct: -100 })
  })
  it('fora da conta é dito na célula', () => {
    const c = lado({ recente: 6, anterior: 5, cobertura: OK, fora: { semFormato: 2, aoVivo: 1, agendados: 1 } })
    expect(c).toMatchObject({ tipo: 'medido', fora: 'Fora da conta: 2 de formato não confirmado, 1 ao vivo, 1 agendado.' })
  })
})

describe('buildCompararPack: quais vídeos entram na contagem', () => {
  type V = Dataset['videos'][number]
  const montar = (mut: (ds: Dataset, mk: (dias: number, o?: Partial<V>) => V) => V[], cfg: { yt?: number | null; backfill?: boolean; wasLive?: string[] } = {}) => {
    const w = a3World(ds => {
      const tpl = ds.videos.find(v => v.ch === CH && v.fmt === 'long')!
      let n = 0
      const mk = (dias: number, o: Partial<V> = {}): V => ({ ...tpl, id: `syn-${n++}`, ytId: `syn${n}`, fmt: 'long', isShort: false, pub: ds.now - dias * DAY, ageDays: Math.max(0, Math.floor(dias)), ...o })
      const novos = mut(ds, mk)
      ds.videos = ds.videos.filter(v => v.ch !== CH).concat(novos)
      const ch = ds.channels.find(c => c.id === CH)!
      ch.undated = []
      ;(ch as { youtubeVideoCount?: number | null }).youtubeVideoCount = cfg.yt ?? null
      if (cfg.backfill) ch.sync.state = 'backfill'
    })
    const medidas = { porCanal: new Map(), extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0, videos: new Map((cfg.wasLive ?? []).map(id => [id, { wasLive: true, missingSince: null }])) } as unknown as MedidasDoSite
    const p = buildCompararPack(w.obs, () => undefined, undefined, {}, medidas)
    return p.canais.find(c => c.id === CH)!.medidasDoLado!.longos
  }

  it('conta só longos de formato confirmado; os de formato nulo, ao vivo e agendados ficam de fora e são contados à parte', () => {
    const l = montar((_ds, mk) => [
      mk(10), mk(20), mk(30), // recente
      mk(100), mk(120), // anterior
      mk(15, { isShort: null }), mk(40, { isShort: true, fmt: 'short' }),
      mk(50, { id: 'live-1' }),
      mk(-5), // estreia agendada
    ], { yt: 8, wasLive: ['live-1'] })
    expect(l).toMatchObject({ recente: 3, anterior: 2, cobertura: { ok: true }, fora: { semFormato: 1, aoVivo: 1, agendados: 1 } })
  })
  it('M1: 90 dias exatos é recente; 90,5 é anterior', () => {
    const l = montar((_ds, mk) => [mk(90), mk(90.5), mk(180)], { yt: 3 })
    expect(l).toMatchObject({ recente: 1, anterior: 2 })
  })
  it('C1: histórico guardado de 51 dias e canal com 900 vídeos: cobertura falha, com o dia mais antigo', () => {
    const l = montar((_ds, mk) => [mk(2), mk(9), mk(16), mk(23), mk(51)], { yt: 900 })
    expect(l.cobertura.ok).toBe(false)
    expect(l.anterior).toBe(0)
    expect((l.cobertura as { desde: string | null }).desde).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('em backfill a cobertura falha mesmo com vídeos de 200 dias', () => {
    const l = montar((_ds, mk) => [mk(2), mk(200)], { yt: 2, backfill: true })
    expect(l.cobertura.ok).toBe(false)
  })
})
