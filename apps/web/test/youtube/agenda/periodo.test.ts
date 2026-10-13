// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { chaveDoPeriodo, inicioDoPeriodo, horaSP } from '@/lib/youtube/agenda/periodo'
import { comPrazo, LIMITE_FUNCAO_MS } from '@/lib/youtube/agenda/relogio'

// Datas relativas: um dia fixo no passado serve de âncora; o que importa é a hora do relógio de São Paulo (UTC−3).
const DIA0 = Date.UTC(2026, 9, 12)   // 12/10/2026 00:00 UTC
const sp = (dia: number, h: number, m = 0, s = 0) => DIA0 + dia * 86_400_000 + (h + 3) * 3_600_000 + m * 60_000 + s * 1000

describe('periodo (São Paulo, UTC−3 fixo)', () => {
  it('chave da hora, da faixa e do dia em São Paulo', () => {
    const t = Date.UTC(2026, 9, 13, 2, 59, 59) // 13/10 02:59:59 UTC = 12/10 23:59:59 SP
    expect(chaveDoPeriodo('hora', t)).toBe('2026-10-12T23')
    expect(chaveDoPeriodo('faixa', t)).toBe('2026-10-12#18')
    expect(chaveDoPeriodo('dia', t)).toBe('2026-10-12')
  })

  it('a virada do dia de São Paulo', () => {
    const t = Date.UTC(2026, 9, 13, 3, 0, 0)
    expect(chaveDoPeriodo('dia', t)).toBe('2026-10-13')
    expect(chaveDoPeriodo('faixa', t)).toBe('2026-10-13#00')
    expect(chaveDoPeriodo('hora', t)).toBe('2026-10-13T00')
    expect(horaSP(t)).toBe(0)
  })

  it('a virada da hora', () => {
    const antes = sp(0, 14, 59, 59), depois = sp(0, 15, 0, 0)
    expect(chaveDoPeriodo('hora', antes)).toBe('2026-10-12T14')
    expect(chaveDoPeriodo('hora', depois)).toBe('2026-10-12T15')
    expect(horaSP(antes)).toBe(14)
    expect(horaSP(depois)).toBe(15)
  })

  it('as quatro faixas', () => {
    const f = (h: number, m: number) => chaveDoPeriodo('faixa', sp(0, h, m)).split('#')[1]
    expect([f(0, 0), f(5, 59), f(6, 0), f(12, 0), f(18, 0), f(23, 59)]).toEqual(['00', '00', '06', '12', '18', '18'])
  })

  it('instante inválido (NaN, Infinity, data inválida) lança erro de mensagem fixa, não RangeError cru', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, new Date('x').getTime()]) {
      for (const p of ['hora', 'faixa', 'dia'] as const) {
        expect(() => chaveDoPeriodo(p, v), `${p} ${v}`).toThrow('instante inválido para a chave do período')
      }
    }
    // fora do alcance de Date também não vaza o RangeError do toISOString
    expect(() => chaveDoPeriodo('dia', 8.64e15 + 4 * 3_600_000)).toThrow('instante inválido para a chave do período')
  })

  it('mês e ano viram: 31/12 23:59 SP e 01/01 00:00 SP', () => {
    expect(chaveDoPeriodo('dia', Date.UTC(2026, 0, 1, 2, 59, 59))).toBe('2025-12-31')
    expect(chaveDoPeriodo('dia', Date.UTC(2026, 0, 1, 3, 0, 0))).toBe('2026-01-01')
  })

  it('o início do período corrente, em ms', () => {
    const t = sp(0, 14, 37, 12)
    expect(inicioDoPeriodo('hora', t)).toBe(sp(0, 14))
    expect(inicioDoPeriodo('faixa', t)).toBe(sp(0, 12))
    expect(inicioDoPeriodo('dia', t)).toBe(sp(0, 0))
    // exatamente no começo: o início é o próprio instante
    expect(inicioDoPeriodo('hora', sp(0, 14))).toBe(sp(0, 14))
    expect(inicioDoPeriodo('dia', sp(0, 0))).toBe(sp(0, 0))
  })

  it('a chave de um instante dentro do período é a chave do início do período', () => {
    const t = sp(3, 7, 41, 9)
    for (const p of ['hora', 'faixa', 'dia'] as const) expect(chaveDoPeriodo(p, inicioDoPeriodo(p, t))).toBe(chaveDoPeriodo(p, t))
  })
})

describe('comPrazo', () => {
  afterEach(() => { vi.useRealTimers() })
  const espera = <T,>(ms: number, v: T) => new Promise<T>(r => setTimeout(() => r(v), ms))

  it('volta a tempo, estoura, e rejeição tardia não vira erro solto', async () => {
    const soltos: unknown[] = []
    const h = (e: unknown) => { soltos.push(e) }
    process.on('unhandledRejection', h)
    try {
      expect(await comPrazo(espera(10, 'a'), 50)).toEqual({ valor: 'a' })
      expect(await comPrazo(espera(100, 'b'), 20)).toEqual({ estourou: true })
      const tardia = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('tarde')), 60))
      expect(await comPrazo(tardia, 20)).toEqual({ estourou: true })
      await new Promise(r => setTimeout(r, 120))
      await new Promise(r => setImmediate(r))
      expect(soltos).toEqual([])
    } finally { process.off('unhandledRejection', h) }
  })

  it('rejeição ANTES do prazo propaga (não é por causa do prazo)', async () => {
    await expect(comPrazo(Promise.reject(new Error('antes')), 50)).rejects.toThrow('antes')
  })

  it('prazo zero estoura na hora: sem esperar temporizador nenhum', async () => {
    vi.useFakeTimers()
    const eterna = new Promise<string>(() => undefined)
    // com relógio falso, esperar um temporizador travaria: só a resposta imediata passa
    await expect(comPrazo(eterna, 0)).resolves.toEqual({ estourou: true })
    await expect(comPrazo(eterna, -1)).resolves.toEqual({ estourou: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('prazo zero ou negativo: estourou na hora, sem lançar, e a promessa que perde não vira erro solto', async () => {
    const soltos: unknown[] = []
    const h = (e: unknown) => { soltos.push(e) }
    process.on('unhandledRejection', h)
    try {
      expect(await comPrazo(espera(10, 'x'), 0)).toEqual({ estourou: true })
      expect(await comPrazo(espera(10, 'x'), -5)).toEqual({ estourou: true })
      expect(await comPrazo(espera(10, 'x'), Number.NaN)).toEqual({ estourou: true })
      const rej = new Promise<string>((_, r) => setTimeout(() => r(new Error('x')), 5))
      expect(await comPrazo(rej, 0)).toEqual({ estourou: true })
      await new Promise(r => setTimeout(r, 40))
      expect(soltos).toEqual([])
    } finally { process.off('unhandledRejection', h) }
  })

  it('limpa o timer quando a promessa vence', async () => {
    vi.useFakeTimers()
    const p = comPrazo(Promise.resolve(7), 10_000)
    await expect(p).resolves.toEqual({ valor: 7 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a constante do limite da função existe (o resto está em catalogo.test.ts)', () => {
    expect(LIMITE_FUNCAO_MS).toBe(300_000)
  })
})
