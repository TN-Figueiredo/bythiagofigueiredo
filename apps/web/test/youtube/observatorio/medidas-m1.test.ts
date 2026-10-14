// @vitest-environment node
// A5 · E4, Tarefa 2: M1 (a conta, a decisão, o vídeo e o canal).
import { describe, expect, it } from 'vitest'
import {
  baseDaIdade, viewsNaIdade, decidirMarca, marcaPerdida, perdaAvisa, m1DoVideo, m1DoCanal,
  type Leitura, type PendenteDeMarca, type VideoComM1,
} from '@/lib/youtube/observatorio/medidas/m1'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { DAY, H, spDateOf } from '@/lib/youtube/observatorio/time'

const MIN = 6e4
const BASE = Date.UTC(2026, 8, 1, 13, 0) // 01/09/2026 10:00 em São Paulo (dia passado, fixo)
const alvoDe = (idade: number) => BASE + idade * DAY
const L = (t: number, views: number, likes: number | null = null, comments: number | null = null): Leitura => ({ t, views, likes, comments })
const O36 = { maxGapHoras: 36 }

function pend(over: Partial<PendenteDeMarca> = {}): PendenteDeMarca {
  const idadeDias = over.idadeDias ?? 7
  return {
    videoId: 'v1', siteId: 's1', idadeDias, baseAt: BASE, baseAtIso: '2026-09-01T13:00:00.000000+00:00', seriesTier: 'diaria', motivoAnterior: null,
    alvoAt: alvoDe(idadeDias), discoveredAt: BASE, missingSince: null, viewsHidden: null, likesHidden: null, commentsDisabled: null,
    primeiraLeituraAt: null, ultimaLeituraAt: null, cruzouPausa: false, leituras: [], ...over,
  }
}

describe('M1: viewsNaIdade', () => {
  const alvo = alvoDe(7)
  it('interpola entre as duas vizinhas', () => {
    const r = viewsNaIdade([L(alvo - 6 * H - 50 * MIN, 700), L(alvo + 17 * H + 10 * MIN, 800)], BASE, 7, O36)
    expect(r).toMatchObject({ medido: { views: 728, gapHoras: 24 } })
  })
  it('leitura exatamente no instante alvo', () => {
    const r = viewsNaIdade([L(alvo, 512)], BASE, 7, O36)
    expect(r).toMatchObject({ medido: { views: 512, gapHoras: 0, antes: alvo, depois: alvo } })
  })
  it('exatamente 36 horas mede; 36 horas e 1 ms não', () => {
    expect('medido' in viewsNaIdade([L(alvo - 10 * H, 1), L(alvo + 26 * H, 2)], BASE, 7, O36)).toBe(true)
    expect(viewsNaIdade([L(alvo - 10 * H, 1), L(alvo + 26 * H + 1, 2)], BASE, 7, O36)).toEqual({ falta: 'distantes' })
  })
  it('idade 1: exatamente 8 horas mede; 8 horas e 1 ms não', () => {
    const a1 = alvoDe(1)
    expect('medido' in viewsNaIdade([L(a1 - 3 * H, 1), L(a1 + 5 * H, 2)], BASE, 1, { maxGapHoras: 8 })).toBe(true)
    expect(viewsNaIdade([L(a1 - 3 * H, 1), L(a1 + 5 * H + 1, 2)], BASE, 1, { maxGapHoras: 8 })).toEqual({ falta: 'distantes' })
  })
  it('lista vazia', () => { expect(viewsNaIdade([], BASE, 7, O36)).toEqual({ falta: 'sem_vizinha_antes' }) })
  it('só leituras depois do alvo / só antes', () => {
    expect(viewsNaIdade([L(alvo + H, 5)], BASE, 7, O36)).toEqual({ falta: 'sem_vizinha_antes' })
    expect(viewsNaIdade([L(alvo - H, 5)], BASE, 7, O36)).toEqual({ falta: 'sem_vizinha_depois' })
  })
  it('não existe ponto de zero na publicação', () => {
    expect('falta' in viewsNaIdade([L(alvo + H, 900)], BASE, 7, O36)).toBe(true)
  })
  it('leitura com views NaN, nulo ou texto é ignorada, nunca vale 0', () => {
    const ruins = [L(alvo - H, NaN), { t: alvo - 2 * H, views: null, likes: null, comments: null }, { t: alvo - 3 * H, views: '9', likes: null, comments: null }] as never as Leitura[]
    const r = viewsNaIdade([...ruins, L(alvo - 4 * H, 400), L(alvo + 2 * H, 600)], BASE, 7, O36)
    expect(r).toMatchObject({ medido: { views: 533, antes: alvo - 4 * H } })
    expect(viewsNaIdade([...ruins, L(alvo + 2 * H, 600)], BASE, 7, O36)).toEqual({ falta: 'sem_vizinha_antes' })
  })
  it('fora de ordem e repetida no mesmo instante', () => {
    const ord = [L(alvo - 5 * H, 100), L(alvo + 5 * H, 200)]
    const bag = [L(alvo + 5 * H, 200), L(alvo - 5 * H, 90), L(alvo - 5 * H, 100)]
    expect(viewsNaIdade(bag, BASE, 7, O36)).toEqual(viewsNaIdade(ord, BASE, 7, O36))
  })
  it('views que caem entre as leituras', () => {
    expect(viewsNaIdade([L(alvo - 5 * H, 800), L(alvo + 5 * H, 700)], BASE, 7, O36)).toMatchObject({ medido: { views: 750 } })
  })
  it('curtidas: as duas medidas interpola; uma nula dá nulo', () => {
    expect(viewsNaIdade([L(alvo - 5 * H, 10, 10, 1), L(alvo + 5 * H, 20, 20, 3)], BASE, 7, O36)).toMatchObject({ medido: { likes: 15, comments: 2 } })
    expect(viewsNaIdade([L(alvo - 5 * H, 10, null, 1), L(alvo + 5 * H, 20, 20, null)], BASE, 7, O36)).toMatchObject({ medido: { likes: null, comments: null } })
  })
  it('curtidas e comentários interpolados são inteiros', () => {
    const r = viewsNaIdade([L(alvo - 6 * H - 50 * MIN, 700, 70, 3), L(alvo + 17 * H + 10 * MIN, 800, 80, 4)], BASE, 7, O36)
    expect('medido' in r && r.medido.likes).toBe(73)
    expect('medido' in r && r.medido.comments).toBe(3)
    expect('medido' in r && Number.isInteger(r.medido.likes) && Number.isInteger(r.medido.comments)).toBe(true)
  })
})

describe('M1: baseDaIdade', () => {
  it('estreia posterior à publicação vale; sem publishedAt é nulo', () => {
    expect(baseDaIdade({ publishedAt: '2026-09-01T10:00:00Z', liveActualStartAt: '2026-09-03T10:00:00Z' })).toBe(Date.parse('2026-09-03T10:00:00Z'))
    expect(baseDaIdade({ publishedAt: '2026-09-03T10:00:00Z', liveActualStartAt: '2026-09-01T10:00:00Z' })).toBe(Date.parse('2026-09-03T10:00:00Z'))
    expect(baseDaIdade({ publishedAt: '2026-09-01T10:00:00Z', liveActualStartAt: null })).toBe(Date.parse('2026-09-01T10:00:00Z'))
    expect(baseDaIdade({ publishedAt: null, liveActualStartAt: '2026-09-03T10:00:00Z' })).toBeNull()
  })
})

describe('M1: decidirMarca', () => {
  const alvo = alvoDe(7)
  it('marca assim que a vizinha de depois existe, mesmo antes do limite', () => {
    const p = pend({ leituras: [L(alvo - 5 * H, 100), L(alvo + H, 120)], primeiraLeituraAt: alvo - 5 * H, ultimaLeituraAt: alvo + H })
    const r = decidirMarca(p, alvo + 2 * H)
    expect(r.tipo).toBe('marca')
    if (r.tipo === 'marca') {
      expect(r.linha).toMatchObject({ video_id: 'v1', age_days: 7, views: 117, read_before_at: new Date(alvo - 5 * H).toISOString(), read_after_at: new Date(alvo + H).toISOString() })
    }
  })
  it('sem a vizinha de depois e alvo há 35 horas: aguardar', () => {
    const p = pend({ leituras: [L(alvo - H, 100)], primeiraLeituraAt: alvo - H, ultimaLeituraAt: alvo - H })
    expect(decidirMarca(p, alvo + 35 * H)).toEqual({ tipo: 'aguardar' })
  })
  it('sem a vizinha de depois: 36 h 59 min aguarda; 37 h exatas decidem o motivo', () => {
    const p = pend({ leituras: [L(alvo - H, 100)], primeiraLeituraAt: alvo - H, ultimaLeituraAt: alvo - H })
    expect(decidirMarca(p, alvo + 36 * H + 59 * MIN)).toEqual({ tipo: 'aguardar' })
    expect(decidirMarca(p, alvo + 37 * H)).toEqual({ tipo: 'falta', reason: 'leitura_parou_antes', sinceAt: alvo - H })
  })
  it('idade 1: 8 horas e 59 minutos aguarda; 9 horas decide', () => {
    const a1 = alvoDe(1)
    const p = pend({ idadeDias: 1, leituras: [L(a1 - 2 * H, 10)], primeiraLeituraAt: a1 - 2 * H, ultimaLeituraAt: a1 - 2 * H })
    expect(decidirMarca(p, a1 + 8 * H + 59 * MIN)).toEqual({ tipo: 'aguardar' })
    expect(decidirMarca(p, a1 + 9 * H)).toMatchObject({ tipo: 'falta', reason: 'leitura_parou_antes' })
  })
  it('com a vizinha de depois além do limite e antes do prazo: aguardar; no prazo: leituras_distantes', () => {
    const p = pend({ leituras: [L(alvo - 30 * H, 100), L(alvo + 10 * H, 200)], primeiraLeituraAt: alvo - 30 * H, ultimaLeituraAt: alvo + 10 * H })
    expect(decidirMarca(p, alvo + 36 * H + 59 * MIN)).toEqual({ tipo: 'aguardar' })
    expect(decidirMarca(p, alvo + 37 * H)).toEqual({ tipo: 'falta', reason: 'leituras_distantes', sinceAt: null })
  })
  it('a marca e o motivo levam a base como veio do banco', () => {
    const iso = '2026-09-01T13:00:00.123456+00:00'
    const p = pend({ baseAtIso: iso, leituras: [L(alvo - H, 1), L(alvo + H, 3)], primeiraLeituraAt: alvo - H, ultimaLeituraAt: alvo + H })
    const r = decidirMarca(p, alvo + 2 * H)
    expect(r.tipo === 'marca' && r.linha.base_at).toBe(iso)
  })
  it('a ordem dos seis motivos', () => {
    const agora = alvo + 40 * H
    expect(decidirMarca(pend({ viewsHidden: true }), agora)).toMatchObject({ tipo: 'falta', reason: 'views_ocultas', sinceAt: null })
    expect(decidirMarca(pend({ viewsHidden: false }), agora)).toMatchObject({ reason: 'sem_leitura', sinceAt: null })
    const tarde = { primeiraLeituraAt: alvo + 2 * H, ultimaLeituraAt: alvo + 2 * H, leituras: [L(alvo + 2 * H, 5)] }
    expect(decidirMarca(pend({ ...tarde, discoveredAt: BASE + 24 * H + 1 }), agora)).toMatchObject({ reason: 'descoberto_tarde', sinceAt: alvo + 2 * H })
    expect(decidirMarca(pend({ ...tarde, discoveredAt: BASE + 24 * H }), agora)).toMatchObject({ reason: 'leitura_comecou_depois', sinceAt: alvo + 2 * H })
    expect(decidirMarca(pend({ ...tarde, discoveredAt: null }), agora)).toMatchObject({ reason: 'leitura_comecou_depois' })
    expect(decidirMarca(pend({ primeiraLeituraAt: alvo - 50 * H, ultimaLeituraAt: alvo - 40 * H, leituras: [L(alvo - 40 * H, 5)] }), agora)).toMatchObject({ reason: 'leitura_parou_antes', sinceAt: alvo - 40 * H })
    expect(decidirMarca(pend({ primeiraLeituraAt: alvo - 50 * H, ultimaLeituraAt: alvo + 50 * H, leituras: [L(alvo - 50 * H, 5), L(alvo + 50 * H, 9)] }), alvo + 60 * H)).toMatchObject({ reason: 'leituras_distantes', sinceAt: null })
  })
  it('likes_hidden verdadeiro só com o sinalizador e até 72 horas do alvo', () => {
    const base = { leituras: [L(alvo - H, 10), L(alvo + H, 20)], primeiraLeituraAt: alvo - H, ultimaLeituraAt: alvo + H }
    const lh = (p: Partial<PendenteDeMarca>, agora: number) => { const r = decidirMarca(pend({ ...base, ...p }), agora); return r.tipo === 'marca' ? r.linha.likes_hidden : 'x' }
    expect(lh({ likesHidden: true }, alvo + 71 * H)).toBe(true)
    expect(lh({ likesHidden: true }, alvo + 73 * H)).toBeNull()
    expect(lh({ likesHidden: null }, alvo + 71 * H)).toBeNull()
  })
  it('likes_hidden é false quando as curtidas foram medidas', () => {
    const p = pend({ leituras: [L(alvo - H, 10, 5, 1), L(alvo + H, 20, 7, 3)], primeiraLeituraAt: alvo - H, ultimaLeituraAt: alvo + H })
    const r = decidirMarca(p, alvo + 3 * H)
    expect(r.tipo === 'marca' && [r.linha.likes_hidden, r.linha.comments_disabled]).toEqual([false, false])
  })
})

describe('M1: marca perdida e aviso', () => {
  const alvo = alvoDe(7)
  const comSerie = { primeiraLeituraAt: alvo - 30 * H }
  it('marca perdida: série que existia antes do alvo, vídeo no ar, motivo distantes ou parou_antes', () => {
    expect(marcaPerdida(pend(comSerie), 'leituras_distantes')).toBe(true)
    expect(marcaPerdida(pend(comSerie), 'leitura_parou_antes')).toBe(true)
    expect(marcaPerdida(pend({ primeiraLeituraAt: alvo + H }), 'leituras_distantes')).toBe(false)
    expect(marcaPerdida(pend({ ...comSerie, missingSince: alvo }), 'leituras_distantes')).toBe(false)
    expect(marcaPerdida(pend(comSerie), 'leitura_comecou_depois')).toBe(false)
    expect(marcaPerdida(pend({ primeiraLeituraAt: null }), 'leituras_distantes')).toBe(false)
  })
  it('motivo anterior igual não conta de novo', () => {
    const c = (m: PendenteDeMarca['motivoAnterior'], r: 'leituras_distantes' | 'leitura_parou_antes' = 'leituras_distantes') => marcaPerdida(pend({ ...comSerie, motivoAnterior: m }), r)
    expect(c('leituras_distantes')).toBe(false)
    expect(c('leitura_parou_antes')).toBe(false)
    expect(c('leitura_comecou_depois')).toBe(true)
    expect(c(null)).toBe(true)
  })
  it('buraco que cruzou pausa não é marca perdida', () => {
    expect(marcaPerdida(pend({ ...comSerie, cruzouPausa: true }), 'leituras_distantes')).toBe(false)
  })
  it('buraco fora de pausa continua perdida', () => {
    expect(marcaPerdida(pend({ ...comSerie, cruzouPausa: false }), 'leituras_distantes')).toBe(true)
  })
  it('a perda avisa nas idades 7 e 30 e não na 1', () => {
    expect([1, 7, 30].map(i => perdaAvisa(pend({ idadeDias: i as 1 | 7 | 30 })))).toEqual([false, true, true])
    expect(perdaAvisa(pend({ idadeDias: 30, seriesTier: 'semanal' }))).toBe(true)
  })
  it('idade 1 só com série diária é marca perdida e não avisa', () => {
    const a1 = alvoDe(1)
    const d1 = a1 - 20 * H, d2 = a1 + 4 * H
    const p = pend({ idadeDias: 1, leituras: [L(d1, 10), L(d2, 40)], primeiraLeituraAt: d1, ultimaLeituraAt: d2 })
    const r = decidirMarca(p, a1 + 9 * H)
    expect(r).toMatchObject({ tipo: 'falta', reason: 'leituras_distantes' })
    expect(marcaPerdida(p, 'leituras_distantes')).toBe(true)
    expect(perdaAvisa(p)).toBe(false)
  })
})

describe('M1: m1DoVideo', () => {
  const AGORA = Date.UTC(2026, 9, 10, 15, 0)
  const base40 = AGORA - 40 * DAY
  const marca = (views: number, ageBaseAt = base40) => ({ views, likes: null, comments: null, readBeforeAt: alvoDe(0), readAfterAt: alvoDe(0) + 10 * H, ageBaseAt })
  it('a marca gravada vence a série', () => {
    const alvo = base40 + 7 * DAY
    const r = m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: marca(500), falta: null, leituras: [L(alvo - H, 520), L(alvo + H, 520)] })
    expect(r).toMatchObject({ estado: 'medido', valor: { views: 500, fonte: 'marca' } })
  })
  it('idade não fechada diz a data', () => {
    const base = AGORA - 6 * DAY
    const r = m1DoVideo({ idadeDias: 7, baseMs: base, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: null })
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'fecha_em', fechaEm: '2026-10-11' })
  })
  it('fechada, sem marca, sem motivo, sem série', () => {
    expect(m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: null })).toMatchObject({ motivo: 'aguardando_calculo' })
  })
  it('fechada, com a série e sem a vizinha de depois: aguardando_calculo, nunca um dos seis motivos', () => {
    const alvo = base40 + 7 * DAY
    expect(m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: null, leituras: [L(alvo - H, 5)] })).toMatchObject({ motivo: 'aguardando_calculo' })
  })
  it('fechada, com a série completa: conta na hora (fonte serie)', () => {
    const alvo = base40 + 7 * DAY
    expect(m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: null, leituras: [L(alvo - H, 100), L(alvo + H, 200)] }))
      .toMatchObject({ estado: 'medido', valor: { views: 150, fonte: 'serie' } })
  })
  it('o motivo gravado vale e leva a data de desde', () => {
    const r = m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: { reason: 'leitura_comecou_depois', sinceAt: base40 + 8 * DAY, ageBaseAt: base40 } })
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_comecou_depois', desde: spDateOf(base40 + 8 * DAY) })
  })
  it('sem publicação', () => {
    expect(m1DoVideo({ idadeDias: 7, baseMs: null, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: null })).toMatchObject({ motivo: 'sem_publicacao' })
  })
  it('vídeo agendado ou no ar: fecha_em sem data', () => {
    const r = m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: true, agoraMs: AGORA, marca: marca(500), falta: null })
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'fecha_em' })
    expect(r.estado === 'nao_medido' && r.fechaEm).toBeUndefined()
  })
  it('marca com a base antiga não vale', () => {
    const r = m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: marca(500, base40 - 2 * DAY), falta: null })
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'aguardando_calculo' })
  })
  it('motivo com a base antiga também não vale', () => {
    const r = m1DoVideo({ idadeDias: 7, baseMs: base40, agendadoOuNoAr: false, agoraMs: AGORA, marca: null, falta: { reason: 'sem_leitura', sinceAt: null, ageBaseAt: base40 - DAY } })
    expect(r).toMatchObject({ motivo: 'aguardando_calculo' })
  })
})

describe('M1: m1DoCanal', () => {
  const AGORA = Date.UTC(2026, 9, 10, 15, 0)
  const v = (views: number | null, over: Partial<VideoComM1> = {}): VideoComM1 => ({
    formato: 'long', publicadoEm: AGORA - 10 * DAY, wasLive: false, missingSince: null,
    m1: views === null ? naoMedido('aguardando_calculo') : medido({ views, gapHoras: 1, fonte: 'marca' }, 1, { de: null, ate: null, dias: 7 }), ...over,
  })
  const o = { formato: 'long' as const, idadeDias: 7 as const, agoraMs: AGORA }
  it('3 medidos mede, 2 não', () => {
    expect(m1DoCanal([v(100), v(300), v(200)], o)).toMatchObject({ estado: 'medido', valor: 200, n: 3 })
    expect(m1DoCanal([v(100), v(300), v(null)], o)).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 2, minimo: 3 })
  })
  it('ao vivo fica fora e é contado', () => {
    const r = m1DoCanal([v(100), v(200), v(300), v(9999, { wasLive: true })], o)
    expect(r).toMatchObject({ estado: 'medido', n: 3, valor: 200 })
    expect(r.notas).toContainEqual({ tipo: 'ao_vivo_fora', n: 1 })
  })
  it('canal misto: longos e Shorts nunca na mesma mediana', () => {
    const vs = [v(1000), v(1000), v(1000), v(100000, { formato: 'short' }), v(100000, { formato: 'short' }), v(100000, { formato: 'short' })]
    expect(m1DoCanal(vs, o)).toMatchObject({ valor: 1000 })
    expect(m1DoCanal(vs, { ...o, formato: 'short' })).toMatchObject({ valor: 100000 })
  })
  it('formato não confirmado fica fora e é contado', () => {
    const r = m1DoCanal([v(1), v(2), v(3), v(900, { formato: null })], o)
    expect(r).toMatchObject({ n: 3, valor: 2 })
    expect(r.notas).toContainEqual({ tipo: 'formato_nao_confirmado_fora', n: 1 })
  })
  it('vídeo fora do ar continua e é contado', () => {
    const r = m1DoCanal([v(1), v(2), v(3, { missingSince: AGORA - DAY })], o)
    expect(r).toMatchObject({ estado: 'medido', n: 3 })
    expect(r.notas).toContainEqual({ tipo: 'fora_do_ar_dentro', n: 1 })
  })
  it('was_live nulo fica dentro e é contado', () => {
    const r = m1DoCanal([v(1), v(2), v(3, { wasLive: null })], o)
    expect(r).toMatchObject({ n: 3 })
    expect(r.notas).toContainEqual({ tipo: 'ao_vivo_nao_se_sabe', n: 1 })
  })
  it('só entram os publicados nos últimos 90 dias', () => {
    const r = m1DoCanal([v(1), v(2), v(3), v(900, { publicadoEm: AGORA - 91 * DAY })], o)
    expect(r).toMatchObject({ n: 3, valor: 2 })
  })
  it('canal sem vídeo', () => {
    expect(m1DoCanal([], o)).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 0, minimo: 3 })
  })
})
