// @vitest-environment node
// A5 E4, Tarefa 10: o escritor das marcas. O `sb` falso é local e só responde a rpc(nome, args).abortSignal(…).
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { runFecharMarcas, MOTIVOS_DAS_MARCAS } from '@/lib/youtube/observatorio/medidas/fechar-marcas'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'

const H = 36e5, DAY = 24 * H
const AGORA = Date.UTC(2026, 8, 20, 15, 0, 0)
const iso = (ms: number) => new Date(ms).toISOString()
const SENTINELA = 'FRASE-SENTINELA-DO-BANCO'

interface Chamada { fn: string; args: Record<string, unknown> }
type Resp = { data: unknown; error: unknown } | (() => Promise<never>)

function fake(pending: Resp, apply: Resp) {
  const chamadas: Chamada[] = []
  const sb = {
    rpc(fn: string, args: Record<string, unknown>) {
      chamadas.push({ fn, args })
      const r = fn === 'competitor_marks_pending' ? pending : apply
      return { abortSignal: (_s: AbortSignal) => (typeof r === 'function' ? r() : Promise.resolve(r)) }
    },
  } as unknown as SupabaseClient
  return { sb, chamadas }
}

const saudeLimpa = { atrasadas: 0, em_duas_tabelas: 0, site_divergente: 0, base_divergente: 0, marcas: 0, faltas: 0 }
const applyOk = (o: Record<string, unknown> = {}, saude: Record<string, unknown> = {}) => ({
  data: { marcas: 0, marcas_recusadas: 0, faltas: 0, faltas_limpas: 0, faltas_recusadas: 0, refeitas_por_base: 0, saude: { ...saudeLimpa, ...saude }, ...o },
  error: null,
})
const pendingOk = (itens: unknown[], o: Record<string, unknown> = {}) => ({ data: { total_pendentes: itens.length, pares_em_pausa: 0, itens, ...o }, error: null })

interface Cfg {
  idade?: 1 | 7 | 30
  /** Há quantas horas o alvo passou. */
  alvoHa?: number
  /** Leituras em horas relativas ao alvo. */
  leituras?: Array<[number, number]>
  primeira?: number | null
  ultima?: number | null
  extra?: Record<string, unknown>
  id?: string
  base?: string
}
function item(c: Cfg = {}): Record<string, unknown> {
  const idade = c.idade ?? 7
  const alvo = AGORA - (c.alvoHa ?? 100) * H
  const base = alvo - idade * DAY
  const leituras = c.leituras ?? [[-1, 100], [1, 140]]
  const hs = leituras.map(([h]) => h)
  const primeira = c.primeira === undefined ? (hs.length ? Math.min(...hs) : null) : c.primeira
  const ultima = c.ultima === undefined ? (hs.length ? Math.max(...hs) : null) : c.ultima
  return {
    video_id: c.id ?? 'v1', site_id: 's1', age_days: idade, base_at: c.base ?? iso(base), target_at: iso(alvo),
    discovered_at: iso(base + H), views_hidden: false, likes_hidden: false, comments_disabled: false,
    missing_since: null, series_tier: 'diaria', gap_crossed_pause: false, prev_reason: null,
    first_reading_at: primeira === null ? null : iso(alvo + primeira * H),
    last_reading_at: ultima === null ? null : iso(alvo + ultima * H),
    readings: leituras.map(([h, v]) => ({ t: iso(alvo + h * H), views: v, likes: 10, comments: 1 })),
    ...c.extra,
  }
}
// buraco de coleta: a série existia antes do alvo e há uma lacuna grande em volta dele
const comBuraco = (c: Cfg = {}) => item({ leituras: [[-60, 10], [60, 99]], primeira: -80, ultima: 60, ...c })
const rodar = (pending: Resp, apply: Resp) => { const f = fake(pending, apply); return runFecharMarcas({ sb: f.sb, now: () => AGORA }).then((r) => ({ r, ...f })) }
const pedido = (chamadas: Chamada[], fn: string) => chamadas.find((c) => c.fn === fn)

afterEach(() => { vi.restoreAllMocks() })

describe('runFecharMarcas: falhas de ida e de forma', () => {
  it.each(['PGRST202', '42883', '42P01'])('função ausente (%s): schema_ausente, e a segunda ida não acontece', async (code) => {
    const { r, chamadas } = await rodar({ data: null, error: { code, message: SENTINELA } }, applyOk())
    expect(r).toMatchObject({ status: 'erro', motivo: 'schema_ausente', feitos: 0, ficaram: null })
    expect(chamadas.map((c) => c.fn)).toEqual(['competitor_marks_pending'])
  })
  it('prazo estourado na primeira ida: banco_nao_respondeu, nada gravado', async () => {
    const { r, chamadas } = await rodar({ data: null, error: { name: 'AbortError', message: 'AbortError: ' + SENTINELA, code: '' } }, applyOk())
    expect(r.motivo).toBe('banco_nao_respondeu')
    expect(chamadas).toHaveLength(1)
    const lancando = await rodar(() => Promise.reject(Object.assign(new Error(SENTINELA), { name: 'TimeoutError' })), applyOk())
    expect(lancando.r.motivo).toBe('banco_nao_respondeu')
  })
  it('erro com código na primeira ida: leitura_falhou; na segunda: gravacao_falhou', async () => {
    const a = await rodar({ data: null, error: { code: '42501', message: SENTINELA } }, applyOk())
    expect(a.r).toMatchObject({ status: 'erro', motivo: 'leitura_falhou' })
    expect(a.chamadas).toHaveLength(1)
    const b = await rodar(pendingOk([]), { data: null, error: { code: '23514', message: SENTINELA } })
    expect(b.r).toMatchObject({ status: 'erro', motivo: 'gravacao_falhou' })
  })
  it('resposta que não é objeto, itens que não é lista, total que não é número: resposta_invalida, nada gravado', async () => {
    for (const data of ['x', null, { total_pendentes: 1, pares_em_pausa: 0, itens: 'x' }, { total_pendentes: 'a', pares_em_pausa: 0, itens: [] }]) {
      const { r, chamadas } = await rodar({ data, error: null }, applyOk())
      expect(r.motivo).toBe('resposta_invalida')
      expect(chamadas).toHaveLength(1)
    }
  })
  it('item sem series_tier ou sem prev_reason na resposta: resposta_invalida', async () => {
    for (const k of ['series_tier', 'prev_reason']) {
      const it1 = item(); delete it1[k]
      expect((await rodar(pendingOk([it1]), applyOk())).r.motivo).toBe('resposta_invalida')
    }
  })
  it('item sem missing_since na resposta: resposta_invalida', async () => {
    const it1 = item(); delete it1.missing_since
    expect((await rodar(pendingOk([it1]), applyOk())).r.motivo).toBe('resposta_invalida')
  })
  it('item sem gap_crossed_pause, ou resposta sem pares_em_pausa: resposta_invalida', async () => {
    const it1 = item(); delete it1.gap_crossed_pause
    expect((await rodar(pendingOk([it1]), applyOk())).r.motivo).toBe('resposta_invalida')
    expect((await rodar({ data: { total_pendentes: 0, itens: [] }, error: null }, applyOk())).r.motivo).toBe('resposta_invalida')
  })
  it('a exceção do cliente não vaza texto: o retorno só tem códigos e números', async () => {
    const { r } = await rodar(() => Promise.reject(new Error(SENTINELA)), applyOk())
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
    const g = await rodar(pendingOk([]), { data: null, error: { code: '23514', message: SENTINELA } })
    expect(JSON.stringify(g.r)).not.toContain(SENTINELA)
  })
})

describe('runFecharMarcas: o que vai ao banco', () => {
  it('zero pendentes: grava listas vazias, lê a prova e é ok', async () => {
    const { r, chamadas } = await rodar(pendingOk([]), applyOk())
    expect(r).toMatchObject({ status: 'ok', feitos: 0, ficaram: 0 })
    expect(pedido(chamadas, 'competitor_marks_apply')?.args).toMatchObject({ p_marks: [], p_misses: [] })
  })
  it('par com vizinhas: vai em p_marks com as duas leituras certas', async () => {
    const it1 = item()
    const { r, chamadas } = await rodar(pendingOk([it1]), applyOk({ marcas: 1 }))
    const ap = pedido(chamadas, 'competitor_marks_apply')!.args
    const alvo = Date.parse(it1.target_at as string)
    expect(ap.p_misses).toEqual([])
    expect(ap.p_marks).toEqual([expect.objectContaining({ video_id: 'v1', age_days: 7, read_before_at: iso(alvo - H), read_after_at: iso(alvo + H) })])
    expect(r).toMatchObject({ status: 'ok', feitos: 1 })
  })
  it('par sem vizinhas e alvo antigo: vai em p_misses com o código', async () => {
    const { chamadas, r } = await rodar(pendingOk([item({ leituras: [], primeira: null, ultima: null })]), applyOk({ faltas: 1 }))
    expect(pedido(chamadas, 'competitor_marks_apply')!.args.p_misses).toEqual([expect.objectContaining({ video_id: 'v1', age_days: 7, reason: 'sem_leitura', since_at: null })])
    expect(r.numeros.faltas_sem_leitura).toBe(1)
  })
  it('par ainda dentro do limite: não vai em lista nenhuma e conta em aguardando', async () => {
    const { chamadas, r } = await rodar(pendingOk([item({ alvoHa: 10, leituras: [[-1, 5]] })]), applyOk())
    const ap = pedido(chamadas, 'competitor_marks_apply')!.args
    expect([ap.p_marks, ap.p_misses]).toEqual([[], []])
    expect(r.numeros.aguardando).toBe(1)
    expect(r.status).toBe('ok')
  })
  it('os parâmetros mandados são os de MEASURE_RULES', async () => {
    const { chamadas } = await rodar(pendingOk([]), applyOk())
    for (const c of chamadas) expect(c.args).toMatchObject({ p_rule_version: MEASURE_RULES.ruleVersion, p_gap_hours_day1: 8, p_gap_hours: 36 })
    expect(pedido(chamadas, 'competitor_marks_pending')!.args.p_limit).toBe(MEASURE_RULES.batch)
  })
  it('o p_now das duas idas é o mesmo instante', async () => {
    const { chamadas } = await rodar(pendingOk([]), applyOk())
    expect(chamadas[0].args.p_now).toBe(iso(AGORA))
    expect(chamadas[1].args.p_now).toBe(chamadas[0].args.p_now)
  })
  it('todo item de p_marks e de p_misses leva o base_at que pending devolveu, letra por letra', async () => {
    const baseMs = AGORA - 100 * H - 7 * DAY
    const b1 = iso(baseMs).replace('.000Z', '.000123+00:00'), b2 = iso(baseMs).replace('.000Z', '.000654+00:00')
    const { chamadas } = await rodar(pendingOk([item({ id: 'a', base: b1 }), item({ id: 'b', base: b2, leituras: [], primeira: null, ultima: null })]), applyOk())
    const ap = pedido(chamadas, 'competitor_marks_apply')!.args
    expect((ap.p_marks as Array<{ base_at: string }>)[0].base_at).toBe(b1)
    expect((ap.p_misses as Array<{ base_at: string }>)[0].base_at).toBe(b2)
  })
  it('leitura com views inválida é ignorada e contada', async () => {
    const it1 = item()
    ;(it1.readings as Array<Record<string, unknown>>).push({ t: iso(AGORA), views: 'abc', likes: null, comments: null })
    const { r } = await rodar(pendingOk([it1]), applyOk({ marcas: 1 }))
    expect(r.numeros.leituras_ignoradas).toBe(1)
    expect(r.status).toBe('ok')
  })
  it('todas as leituras de um par inválidas: resposta_invalida', async () => {
    const it1 = item({ extra: { readings: [{ t: iso(AGORA), views: null }] } })
    expect((await rodar(pendingOk([it1]), applyOk())).r.motivo).toBe('resposta_invalida')
  })
  it('os seis faltas_* somam o tamanho de p_misses', async () => {
    const itens = [
      item({ id: 'a', leituras: [], primeira: null, ultima: null }),
      item({ id: 'b', leituras: [], primeira: null, ultima: null, extra: { views_hidden: true } }),
      item({ id: 'c', leituras: [[5, 1]], primeira: 5, ultima: 5 }),
      item({ id: 'd', leituras: [[-60, 1]], primeira: -60, ultima: -60 }),
      item({ id: 'e', leituras: [[-60, 1], [60, 9]], primeira: -60, ultima: 60 }),
    ]
    const { r, chamadas } = await rodar(pendingOk(itens), applyOk({ faltas: 5 }))
    const soma = ['sem_leitura', 'views_ocultas', 'comecou_depois', 'descoberto_tarde', 'parou_antes', 'distantes'].reduce((s, k) => s + r.numeros['faltas_' + k], 0)
    expect(soma).toBe((pedido(chamadas, 'competitor_marks_apply')!.args.p_misses as unknown[]).length)
    expect(soma).toBe(5)
  })
})

describe('runFecharMarcas: perdas', () => {
  it('carga inicial só com leitura_comecou_depois: não avisa marcas_perdidas', async () => {
    const itens = [item({ leituras: [[5, 1]], primeira: 5, ultima: 5 })]
    const { r } = await rodar(pendingOk(itens), applyOk({ faltas: 1 }))
    expect(r.status).toBe('ok')
    expect(r.numeros.perdidas).toBe(0)
  })
  it('um par de idade 7 com série antes do alvo e buraco: erro marcas_perdidas com perdidas 1, e os motivos foram mandados ao banco assim mesmo', async () => {
    const { r, chamadas } = await rodar(pendingOk([comBuraco()]), applyOk({ faltas: 1 }))
    expect(r).toMatchObject({ status: 'erro', motivo: 'marcas_perdidas', feitos: 1 })
    expect(r.numeros).toMatchObject({ perdidas: 1, perdidas_7: 1 })
    expect(pedido(chamadas, 'competitor_marks_apply')!.args.p_misses).toHaveLength(1)
  })
  it('vídeo fora do ar com leitura_parou_antes: não avisa', async () => {
    const { r } = await rodar(pendingOk([comBuraco({ extra: { missing_since: iso(AGORA - 50 * H) } })]), applyOk({ faltas: 1 }))
    expect(r.status).toBe('ok')
    expect(r.numeros.perdidas).toBe(0)
  })
  it('perdidas_1 + perdidas_7 + perdidas_30 é igual a perdidas', async () => {
    const itens = [comBuraco({ id: 'a', idade: 1 }), comBuraco({ id: 'b', idade: 7 }), comBuraco({ id: 'c', idade: 30 }), comBuraco({ id: 'd', idade: 30 })]
    const { r } = await rodar(pendingOk(itens), applyOk({ faltas: 4 }))
    expect(r.numeros).toMatchObject({ perdidas_1: 1, perdidas_7: 1, perdidas_30: 2, perdidas: 4 })
  })
  it('só idade 1 perdida: ok, com perdidas_1 no detalhe', async () => {
    const { r } = await rodar(pendingOk([comBuraco({ idade: 1 })]), applyOk({ faltas: 1 }))
    expect(r.status).toBe('ok')
    expect(r.numeros).toMatchObject({ perdidas_1: 1, perdidas: 1 })
  })
  it('uma idade 7 perdida junto de dez da idade 1: erro marcas_perdidas, com perdidas_7 1 e perdidas_1 10', async () => {
    const itens = [comBuraco({ id: 'x7', idade: 7 }), ...Array.from({ length: 10 }, (_, i) => comBuraco({ id: 'x1' + i, idade: 1 }))]
    const { r } = await rodar(pendingOk(itens), applyOk({ faltas: 11 }))
    expect(r).toMatchObject({ status: 'erro', motivo: 'marcas_perdidas' })
    expect(r.numeros).toMatchObject({ perdidas_7: 1, perdidas_1: 10 })
  })
  it('reabertura por versão: par que já tinha leituras_distantes não avisa e conta em perdidas_ja_avisadas; par que tinha leitura_comecou_depois e agora é leituras_distantes avisa', async () => {
    const a = await rodar(pendingOk([comBuraco({ extra: { prev_reason: 'leituras_distantes' } })]), applyOk({ faltas: 1 }))
    expect(a.r.status).toBe('ok')
    expect(a.r.numeros).toMatchObject({ perdidas: 0, perdidas_ja_avisadas: 1 })
    const b = await rodar(pendingOk([comBuraco({ extra: { prev_reason: 'leitura_comecou_depois' } })]), applyOk({ faltas: 1 }))
    expect(b.r).toMatchObject({ status: 'erro', motivo: 'marcas_perdidas' })
    expect(b.r.numeros.perdidas_ja_avisadas).toBe(0)
  })
  it('com weeklyTier30Counts falso, idade 30 de vídeo semanal não avisa e conta em perdidas_30_semanal; de vídeo diário avisa', async () => {
    const lost = MEASURE_RULES.lost as { weeklyTier30Counts: boolean }
    lost.weeklyTier30Counts = false
    try {
      const a = await rodar(pendingOk([comBuraco({ idade: 30, extra: { series_tier: 'semanal' } })]), applyOk({ faltas: 1 }))
      expect(a.r.status).toBe('ok')
      expect(a.r.numeros).toMatchObject({ perdidas_30: 1, perdidas_30_semanal: 1 })
      const b = await rodar(pendingOk([comBuraco({ idade: 30, extra: { series_tier: 'diaria' } })]), applyOk({ faltas: 1 }))
      expect(b.r).toMatchObject({ status: 'erro', motivo: 'marcas_perdidas' })
    } finally { lost.weeklyTier30Counts = true }
  })
  it('um pendente com gap_crossed_pause verdadeiro, série antes do alvo e buraco: o motivo é mandado, conta em pausadas, perdidas fica 0 e o resultado é ok', async () => {
    const { r, chamadas } = await rodar(pendingOk([comBuraco({ extra: { gap_crossed_pause: true } })]), applyOk({ faltas: 1 }))
    expect(pedido(chamadas, 'competitor_marks_apply')!.args.p_misses).toHaveLength(1)
    expect(r.status).toBe('ok')
    expect(r.numeros).toMatchObject({ pausadas: 1, perdidas: 0 })
  })
  it('o mesmo pendente com gap_crossed_pause falso: erro marcas_perdidas', async () => {
    const { r } = await rodar(pendingOk([comBuraco()]), applyOk({ faltas: 1 }))
    expect(r).toMatchObject({ status: 'erro', motivo: 'marcas_perdidas' })
  })
  it('pares_em_pausa vai em numeros e não muda o veredito', async () => {
    const { r } = await rodar(pendingOk([], { pares_em_pausa: 7 }), applyOk())
    expect(r.status).toBe('ok')
    expect(r.numeros.pares_em_pausa).toBe(7)
  })
})

describe('runFecharMarcas: prova e precedência', () => {
  it('sobrou: parcial com o número', async () => {
    const { r } = await rodar(pendingOk([item()], { total_pendentes: 4000 }), applyOk({ marcas: 1 }))
    expect(r).toMatchObject({ status: 'parcial', motivo: 'sobrou', feitos: 1, ficaram: 3999 })
  })
  it('marcas_recusadas maior que zero: erro marca_recusada', async () => {
    const { r } = await rodar(pendingOk([item()]), applyOk({ marcas: 0, marcas_recusadas: 1 }))
    expect(r).toMatchObject({ status: 'erro', motivo: 'marca_recusada' })
  })
  it('faltas_recusadas maior que zero: erro marca_recusada', async () => {
    const { r } = await rodar(pendingOk([]), applyOk({ faltas_recusadas: 1 }))
    expect(r.motivo).toBe('marca_recusada')
  })
  it('em_duas_tabelas ou site_divergente: erro prova_inconsistente', async () => {
    expect((await rodar(pendingOk([]), applyOk({}, { em_duas_tabelas: 1 }))).r.motivo).toBe('prova_inconsistente')
    expect((await rodar(pendingOk([]), applyOk({}, { site_divergente: 2 }))).r.motivo).toBe('prova_inconsistente')
  })
  it('base_divergente maior que zero depois de gravar: erro prova_inconsistente', async () => {
    expect((await rodar(pendingOk([]), applyOk({}, { base_divergente: 1 }))).r.motivo).toBe('prova_inconsistente')
  })
  it('atrasadas com nada sobrando: erro marcas_atrasadas; com sobra: parcial', async () => {
    const a = await rodar(pendingOk([]), applyOk({}, { atrasadas: 3 }))
    expect(a.r).toMatchObject({ status: 'erro', motivo: 'marcas_atrasadas' })
    const b = await rodar(pendingOk([], { total_pendentes: 100 }), applyOk({}, { atrasadas: 3 }))
    expect(b.r).toMatchObject({ status: 'parcial', motivo: 'sobrou' })
  })
  it('precedência: recusada vence prova, que vence perdidas, que vence atrasadas, que vence sobrou', async () => {
    const itens = [comBuraco()]
    const tudo = { atrasadas: 1, em_duas_tabelas: 1 }
    const a = await rodar(pendingOk(itens, { total_pendentes: 50 }), applyOk({ faltas: 1, marcas_recusadas: 1 }, tudo))
    expect(a.r.motivo).toBe('marca_recusada')
    const b = await rodar(pendingOk(itens, { total_pendentes: 50 }), applyOk({ faltas: 1 }, tudo))
    expect(b.r.motivo).toBe('prova_inconsistente')
    const c = await rodar(pendingOk(itens, { total_pendentes: 50 }), applyOk({ faltas: 1 }, { atrasadas: 1 }))
    expect(c.r.motivo).toBe('marcas_perdidas')
    const d = await rodar(pendingOk([item({ leituras: [], primeira: null, ultima: null })]), applyOk({ faltas: 1 }, { atrasadas: 1 }))
    expect(d.r.motivo).toBe('marcas_atrasadas')
    const e = await rodar(pendingOk([item({ leituras: [], primeira: null, ultima: null })], { total_pendentes: 50 }), applyOk({ faltas: 1 }, { atrasadas: 1 }))
    expect(e.r.motivo).toBe('sobrou')
  })
  it('resposta do apply fora da forma: resposta_invalida', async () => {
    expect((await rodar(pendingOk([]), { data: { marcas: 0 }, error: null })).r.motivo).toBe('resposta_invalida')
  })
  it('o catálogo de motivos tem os dez códigos', () => {
    expect(MOTIVOS_DAS_MARCAS).toHaveLength(10)
  })
})
