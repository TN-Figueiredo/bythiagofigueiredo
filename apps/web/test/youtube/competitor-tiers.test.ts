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
  it('sem ponto anterior, ou com o anterior a mais de 8 dias (buraco), não promove', () => {
    expect(shouldPromote(null, { views: 10_000 }, TODAY)).toBe(false)
    expect(shouldPromote({ date: '2026-06-01', views: 1 }, { views: 10_000 }, TODAY)).toBe(false)
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
