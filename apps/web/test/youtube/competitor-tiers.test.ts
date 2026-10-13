// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { classifyTiers, weeklyDue, weekSlotOf, shouldPromote, earlyEligible, dayNumber, addDays, type TierVideo } from '@/lib/youtube/competitor-tiers'
import { RULES } from '@/lib/youtube/observatorio/rules'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 5, 10, 15) // 10/06/2026 12:00 de São Paulo
const TODAY = '2026-06-10'
const vid = (i: number, ageDays: number, over: Partial<TierVideo> = {}): TierVideo => ({ id: 'v' + String(i).padStart(4, '0'), publishedAt: NOW - ageDays * DAY, pinned: false, dailyUntil: null, tier: null, ...over })

describe('classifyTiers (4.3)', () => {
  it('os N mais recentes são diária (regra de hoje), o resto é semanal', () => {
    const p = classifyTiers([vid(1, 100), vid(2, 200), vid(3, 300)], { videoLimit: 2, nowMs: NOW, today: TODAY })
    expect(p.daily).toEqual(['v0001', 'v0002'])
    expect(p.weekly).toEqual(['v0003'])
    expect(p.cut).toBe(0)
  })
  it('item 14: canal com 80 vídeos em 30 dias e limite 50 → os 80 em diária', () => {
    const p = classifyTiers(Array.from({ length: 80 }, (_, i) => vid(i, i * 0.37)), { videoLimit: 50, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(80)
    expect(p.weekly).toHaveLength(0)
  })
  it('fixado e promovido (daily_until >= hoje) são diária; promoção vencida ontem volta a semanal', () => {
    const p = classifyTiers([vid(1, 1), vid(2, 400, { pinned: true }), vid(3, 400, { dailyUntil: TODAY }), vid(4, 400, { dailyUntil: '2026-06-09' })], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(p.daily.sort()).toEqual(['v0001', 'v0002', 'v0003'])
    expect(p.weekly).toEqual(['v0004'])
  })
  it('item 18: mais de 200 na regra diária → 200 em diária, os mais antigos da regra de idade para a semanal, e o corte é contado', () => {
    const p = classifyTiers(Array.from({ length: 260 }, (_, i) => vid(i, i * 0.1)), { videoLimit: 50, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(RULES.videoLimitMax)
    expect(p.cut).toBe(60)
    expect(p.weekly).toHaveLength(60)
    expect(p.weekly).toContain('v0259')      // o mais antigo foi cortado
    expect(p.daily).toContain('v0000')       // os 50 mais recentes nunca são cortados
  })
  it('o teto não conta os fixados e nunca corta um dos N mais recentes', () => {
    const many = Array.from({ length: 205 }, (_, i) => vid(i, i * 0.1))
    const p = classifyTiers([...many, vid(900, 500, { pinned: true })], { videoLimit: 200, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(201) // 200 + o fixado
    expect(p.cut).toBe(5)
  })
  it('só o que mudou vai para changes; sem faixa ainda (null) conta como mudança', () => {
    const p = classifyTiers([vid(1, 1, { tier: 'diaria' }), vid(2, 400, { tier: 'diaria' }), vid(3, 500, { tier: null }), vid(4, 600, { tier: 'semanal' })], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(p.changes).toEqual([{ video_id: 'v0002', tier: 'semanal' }, { video_id: 'v0003', tier: 'semanal' }])
  })
  it('vídeo sem data de publicação: fica depois dos datados; entra nos N só se sobrar vaga', () => {
    expect(classifyTiers([vid(1, 1), vid(2, 2), { ...vid(3, 0), publishedAt: null }], { videoLimit: 2, nowMs: NOW, today: TODAY }).weekly).toEqual(['v0003'])
    expect(classifyTiers([vid(1, 400), { ...vid(3, 0), publishedAt: null }], { videoLimit: 2, nowMs: NOW, today: TODAY }).daily).toEqual(['v0001', 'v0003'])
  })
  it('videoLimit é limitado ao teto: 300 vídeos recentes com limite 300 → 200 em diária, o resto contado em cut', () => {
    const p = classifyTiers(Array.from({ length: 300 }, (_, i) => vid(i, i * 0.05)), { videoLimit: 300, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(RULES.videoLimitMax)
    expect(p.cut).toBe(300 - RULES.videoLimitMax)
    expect(p.weekly).toHaveLength(300 - RULES.videoLimitMax)
  })
  it('videoLimit inválido: negativo e NaN valem 0; 2.5 vale 2', () => {
    const vs = [vid(1, 100), vid(2, 200), vid(3, 300)]
    for (const bad of [-1, NaN]) {
      const p = classifyTiers(vs, { videoLimit: bad, nowMs: NOW, today: TODAY })
      expect(p.daily).toEqual([])
      expect(p.weekly).toEqual(['v0001', 'v0002', 'v0003'])
    }
    const q = classifyTiers(vs, { videoLimit: 2.5, nowMs: NOW, today: TODAY })
    expect(q.daily).toEqual(['v0001', 'v0002'])
    expect(q.weekly).toEqual(['v0003'])
  })
  it('a folga é RULES.series.dailyGraceDays (2) e a fronteira é dailyAgeDays mais a folga', () => {
    expect(RULES.series.dailyGraceDays).toBe(2)
    expect(RULES.series.dailyAgeDays).toBe(30)
  })
  it('idade: com exatamente 32 dias é diária; com 32 dias e 1 ms é semanal', () => {
    const F = RULES.series.dailyAgeDays + RULES.series.dailyGraceDays
    const exact = classifyTiers([vid(1, 1), vid(2, F - 1), vid(3, F), vid(4, F + 1)], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(exact.daily).toEqual(['v0001', 'v0002', 'v0003'])
    expect(exact.weekly).toEqual(['v0004'])
    // 1 ms a mais que a fronteira: semanal
    const justOver = classifyTiers([vid(1, 1), vid(2, F, { publishedAt: NOW - F * DAY - 1 })], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(justOver.weekly).toEqual(['v0002'])
    // idade bem maior que a fronteira e menor que 299 não é diária por idade
    expect(classifyTiers([vid(1, 1), vid(2, 90)], { videoLimit: 1, nowMs: NOW, today: TODAY }).weekly).toEqual(['v0002'])
  })
  it('com 30 dias e 1 ms o vídeo fora dos N continua diário (a leitura do dia seguinte ao 30º)', () => {
    const A = RULES.series.dailyAgeDays
    const p = classifyTiers([vid(1, 1), vid(2, A, { publishedAt: NOW - A * DAY - 1 })], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(p.daily).toEqual(['v0001', 'v0002'])
    expect(p.weekly).toEqual([])
  })
  it('corte de promovidos: com o teto estourado só por promovidos, saem os que vencem antes; os N recentes ficam', () => {
    const promoted = Array.from({ length: 210 }, (_, i) => vid(100 + i, 400 + i, { dailyUntil: addDays(TODAY, 1 + i) }))
    const p = classifyTiers([vid(1, 1), ...promoted], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(RULES.videoLimitMax)
    expect(p.cut).toBe(11)
    expect(p.daily).toContain('v0001')
    expect(p.weekly).toContain('v0100') // o que vence primeiro (amanhã) é cortado
    expect(p.weekly).not.toContain('v0309')
  })
  it('lista vazia: nada', () => {
    expect(classifyTiers([], { videoLimit: 50, nowMs: NOW, today: TODAY })).toEqual({ daily: [], weekly: [], changes: [], cut: 0 })
  })
})
describe('dia fixo e devido (OP-15)', () => {
  it('o dia fixo é estável e espalha: 700 ids caem nos 7 dias, nenhum dia com menos de 60', () => {
    const count = [0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 700; i++) count[weekSlotOf('video' + i)]!++
    expect(weekSlotOf('abc')).toBe(weekSlotOf('abc'))
    expect(Math.min(...count)).toBeGreaterThan(60)
  })
  const slotDay = (ytId: string) => { let d = TODAY; while (dayNumber(d) % 7 !== weekSlotOf(ytId)) d = addDays(d, 1); return d }
  it('devido no dia fixo; com ponto hoje nunca é devido', () => {
    const d = slotDay('vidA')
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: d }, d)).toBe(true)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: d, tierSince: addDays(d, -30) }, d)).toBe(false)
  })
  it('D0: fora do dia fixo, recém-classificado e sem ponto, NÃO é devido (a carga se espalha por 7 dias)', () => {
    const d = addDays(slotDay('vidA'), 1)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: d }, d)).toBe(false)
  })
  it('lido ontem: não é devido hoje (fora do dia fixo)', () => {
    const d = addDays(slotDay('vidA'), 2)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: addDays(d, -1), tierSince: addDays(d, -30) }, d)).toBe(false)
  })
  it('perdeu o dia fixo: é devido de novo quando o último ponto faz 7 dias, mesmo fora do dia fixo', () => {
    const d = addDays(slotDay('vidA'), 1)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: addDays(d, -6), tierSince: addDays(d, -30) }, d)).toBe(false)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: addDays(d, -7), tierSince: addDays(d, -30) }, d)).toBe(true)
  })
  it('lastPoint como timestamp vale pelo dia: ponto de hoje (com hora) não é devido no dia fixo', () => {
    const d = slotDay('vidA')
    expect(weeklyDue({ ytId: 'vidA', lastPoint: d + 'T10:00:00Z', tierSince: addDays(d, -30) }, d)).toBe(false)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: d + 'T23:59:59.999Z', tierSince: null }, d)).toBe(false)
  })
  it('nunca teve ponto e está na faixa há 7 dias ou mais: devido', () => {
    const d = addDays(slotDay('vidA'), 3)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: addDays(d, -7) }, d)).toBe(true)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: null }, d)).toBe(false)
  })
})
describe('promoção por ganho (item 17) e primeiras horas (item 16)', () => {
  it('1.000 views E 5% do total numa semana promove; faltando um dos dois, não', () => {
    expect(shouldPromote({ date: '2026-06-03', views: 9000 }, { views: 10_000 }, TODAY)).toBe(true)   // +1.000 e 10%
    expect(shouldPromote({ date: '2026-06-03', views: 99_000 }, { views: 100_000 }, TODAY)).toBe(false) // +1.000 mas 1%
    expect(shouldPromote({ date: '2026-06-03', views: 100 }, { views: 600 }, TODAY)).toBe(false)        // 83% mas +500
  })
  it('5% exato promove; um abaixo não; um acima promove (usa minViews e minShare)', () => {
    const { minViews, minShare } = RULES.promotion
    const cur = minViews / minShare // ganho = minViews = 5% exato do total
    expect(shouldPromote({ date: '2026-06-03', views: cur - minViews }, { views: cur }, TODAY)).toBe(true)
    expect(shouldPromote({ date: '2026-06-03', views: cur - minViews + 1 }, { views: cur + 1 }, TODAY)).toBe(false) // ganho 1.000 em 20.001: 4,9995%
    expect(shouldPromote({ date: '2026-06-03', views: cur - minViews - 1 }, { views: cur }, TODAY)).toBe(true)      // ganho 1.001
    expect(shouldPromote({ date: '2026-06-03', views: cur - minViews + 1 }, { views: cur }, TODAY)).toBe(false)     // ganho 999
  })
  it('ponto do mesmo dia (days < 1) e do futuro não promovem', () => {
    expect(shouldPromote({ date: TODAY, views: 0 }, { views: 10_000 }, TODAY)).toBe(false)
    expect(shouldPromote({ date: addDays(TODAY, -1), views: 0 }, { views: 10_000 }, TODAY)).toBe(true)
  })
  it('limite de dias do buraco: exatamente weeklyMaxGapDays promove, um a mais não', () => {
    const g = RULES.series.weeklyMaxGapDays
    expect(shouldPromote({ date: addDays(TODAY, -g), views: 1000 }, { views: 10_000 }, TODAY)).toBe(true)
    expect(shouldPromote({ date: addDays(TODAY, -g - 1), views: 1000 }, { views: 10_000 }, TODAY)).toBe(false)
  })
  it('views ausente ou nulo (não medido) no anterior ou no atual NÃO promove', () => {
    const prev = (views: number | null | undefined) => ({ date: '2026-06-03', views } as unknown as { date: string; views: number })
    expect(shouldPromote(prev(null), { views: 10_000 }, TODAY)).toBe(false)
    expect(shouldPromote(prev(undefined), { views: 10_000 }, TODAY)).toBe(false)
    expect(shouldPromote({ date: '2026-06-03', views: 9000 }, { views: null } as unknown as { views: number }, TODAY)).toBe(false)
    expect(shouldPromote({ date: '2026-06-03', views: 9000 }, {} as unknown as { views: number }, TODAY)).toBe(false)
  })
  it('sem ponto anterior, ou com o anterior a mais de 8 dias (buraco), não promove', () => {
    expect(shouldPromote(null, { views: 10_000 }, TODAY)).toBe(false)
    expect(shouldPromote({ date: '2026-06-01', views: 1 }, { views: 10_000 }, TODAY)).toBe(false)
  })
  it('primeiras horas, limites: só a idade decide (descoberta 1 h depois)', () => {
    const iso = (ms: number) => new Date(ms).toISOString(), H = 3_600_000
    const E = RULES.series.earlyHours, D = RULES.series.earlyDiscoverHours
    const at = (ageMs: number, lagMs = H) => earlyEligible({ discoveredAt: iso(NOW - ageMs + lagMs), publishedAt: iso(NOW - ageMs) }, NOW)
    expect(at(E * H)).toBe(false)         // 72 h exatas
    expect(at(E * H - 1)).toBe(true)      // 72 h menos 1 ms
    expect(at(E * H + 1)).toBe(false)
    expect(at(30 * H, D * H)).toBe(true)  // descoberto exatamente 24 h depois
    expect(at(30 * H, D * H + 1)).toBe(false)
  })
  it('primeiras horas: descoberto até 24 h depois de publicado, enquanto a idade for menor que 72 h', () => {
    const iso = (ms: number) => new Date(ms).toISOString(), H = 3_600_000
    expect(earlyEligible({ discoveredAt: iso(NOW - 10 * H), publishedAt: iso(NOW - 20 * H) }, NOW)).toBe(true)
    expect(earlyEligible({ discoveredAt: iso(NOW - 10 * H), publishedAt: iso(NOW - 72 * H) }, NOW)).toBe(false) // 72 h completas
    expect(earlyEligible({ discoveredAt: iso(NOW - 10 * H), publishedAt: iso(NOW - 40 * H) }, NOW)).toBe(false) // descoberto 30 h depois
    expect(earlyEligible({ discoveredAt: null, publishedAt: iso(NOW - 2 * H) }, NOW)).toBe(false)               // linha anterior à MG1: nunca por palpite
    expect(earlyEligible({ discoveredAt: iso(NOW), publishedAt: null }, NOW)).toBe(false)
    expect(earlyEligible({ discoveredAt: iso(NOW), publishedAt: iso(NOW + H) }, NOW)).toBe(false)               // estreia agendada
  })
})
