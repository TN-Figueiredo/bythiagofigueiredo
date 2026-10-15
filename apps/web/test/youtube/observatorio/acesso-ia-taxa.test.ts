// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 5: a taxa (30 por minuto, 500 por dia, por chave) e a regra das linhas `limite` (plano, 4.5).
 * `decidirTaxa` é pura; `somarNaTaxa` fala com `obs_ai_rate_hit` por um cliente simulado.
 */
import { describe, expect, it, vi } from 'vitest'
import { decidirTaxa, somarNaTaxa, type DecisaoDeTaxa } from '@/lib/youtube/observatorio/acesso-ia/taxa'

const AGORA = Date.parse('2026-10-13T15:07:42.500Z')
const MINUTO = 60_000

const limite = (d: DecisaoDeTaxa) => {
  if (d.serve) throw new Error('esperava limite')
  return d
}

describe('decidirTaxa: o minuto', () => {
  it('30 no minuto serve; 31 é limite por minuto e registra; 32 é limite e não registra (fronteira)', () => {
    expect(decidirTaxa(30, 30, AGORA)).toEqual({ serve: true })
    expect(limite(decidirTaxa(31, 31, AGORA))).toMatchObject({ por: 'minuto', registrar: true })
    expect(limite(decidirTaxa(32, 32, AGORA))).toMatchObject({ por: 'minuto', registrar: false })
  })

  it('500 no dia com 31 no minuto: limite por minuto, registra', () => {
    expect(limite(decidirTaxa(31, 500, AGORA))).toMatchObject({ por: 'minuto', registrar: true })
  })
})

describe('decidirTaxa: o dia', () => {
  it('500 no dia serve; 501 com 5 no minuto é limite por dia e registra; 502 com 6 não registra', () => {
    expect(decidirTaxa(5, 500, AGORA)).toEqual({ serve: true })
    expect(limite(decidirTaxa(5, 501, AGORA))).toMatchObject({ por: 'dia', registrar: true })
    expect(limite(decidirTaxa(6, 502, AGORA))).toMatchObject({ por: 'dia', registrar: false })
  })

  it('502 com 1 no minuto (minuto novo): NÃO registra (a regra antiga gravava uma linha por minuto)', () => {
    expect(limite(decidirTaxa(1, 502, AGORA))).toMatchObject({ por: 'dia', registrar: false })
  })

  it('900 com 1 no minuto: não registra', () => {
    expect(limite(decidirTaxa(1, 900, AGORA))).toMatchObject({ por: 'dia', registrar: false })
  })

  it("501 no dia com 31 no minuto: limite por 'dia' (não por 'minuto') e registra: o dia tem precedência", () => {
    expect(limite(decidirTaxa(31, 501, AGORA))).toMatchObject({ por: 'dia', registrar: true })
  })

  it('501 no dia com 35 no minuto: limite por dia e registra (o estouro do dia nunca fica sem linha, mesmo no minuto que já teve a sua)', () => {
    expect(limite(decidirTaxa(35, 501, AGORA))).toMatchObject({ por: 'dia', registrar: true })
  })
})

describe('decidirTaxa: entrada que não é contagem falha FECHADA', () => {
  const invalidos: Array<[string, number]> = [
    ['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['-Infinity', Number.NEGATIVE_INFINITY], ['negativo', -1], ['zero', 0],
    ['fracionário', 1.5], ['undefined como número', undefined as unknown as number], ['null como número', null as unknown as number], ['texto como número', '3' as unknown as number],
  ]
  it.each(invalidos)('noMinuto %s (com noDia válido): não serve, por dia, sem linha de registro', (_nome, v) => {
    const d = limite(decidirTaxa(v, 5, AGORA))
    expect(d).toMatchObject({ serve: false, por: 'dia', registrar: false })
    expect(Number.isNaN(Date.parse(d.voltaEm))).toBe(false)
  })
  it.each(invalidos)('noDia %s (com noMinuto válido): não serve', (_nome, v) => {
    expect(limite(decidirTaxa(5, v, AGORA))).toMatchObject({ serve: false, por: 'dia', registrar: false })
  })
  it('NaN nos dois: não serve (antes servia, porque NaN > 500 é falso)', () => {
    expect(decidirTaxa(Number.NaN, Number.NaN, AGORA).serve).toBe(false)
  })
  it('agora ilegível (NaN, Infinity): não serve e não lança; a hora de volta é uma data real', () => {
    for (const agora of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const d = limite(decidirTaxa(1, 1, agora))
      expect(d).toMatchObject({ serve: false, registrar: false })
      expect(Number.isNaN(Date.parse(d.voltaEm))).toBe(false)
    }
  })
  it('o domínio válido não muda: 1 e 1 servem; 30 e 500 servem', () => {
    expect(decidirTaxa(1, 1, AGORA)).toEqual({ serve: true })
    expect(decidirTaxa(30, 500, AGORA)).toEqual({ serve: true })
  })
})

describe('decidirTaxa: a hora de volta', () => {
  it('por minuto: o início do minuto seguinte, em UTC', () => {
    expect(limite(decidirTaxa(31, 31, AGORA)).voltaEm).toBe('2026-10-13T15:08:00.000Z')
  })

  it('por dia: 00:00 UTC do dia seguinte', () => {
    expect(limite(decidirTaxa(1, 501, AGORA)).voltaEm).toBe('2026-10-14T00:00:00.000Z')
  })

  it('virada de mês e de ano; e o instante exato de um minuto cheio volta no minuto seguinte, não nele mesmo', () => {
    const fimDeMes = Date.parse('2026-10-31T23:59:30.000Z')
    expect(limite(decidirTaxa(1, 501, fimDeMes)).voltaEm).toBe('2026-11-01T00:00:00.000Z')
    expect(limite(decidirTaxa(31, 31, fimDeMes)).voltaEm).toBe('2026-11-01T00:00:00.000Z')
    const ano = new Date(AGORA).getUTCFullYear()
    const fimDeAno = Date.UTC(ano, 11, 31, 23, 59, 59, 999)
    expect(limite(decidirTaxa(1, 501, fimDeAno)).voltaEm).toBe(`${ano + 1}-01-01T00:00:00.000Z`)
    const minutoCheio = Date.parse('2026-10-13T15:08:00.000Z')
    expect(limite(decidirTaxa(31, 31, minutoCheio)).voltaEm).toBe('2026-10-13T15:09:00.000Z')
  })
})

/** Simula um cliente em laço: `porMinuto` chamadas em cada um dos 1.440 minutos do dia, o contador do banco subindo a cada uma. */
function diaInteiro(porMinuto: number) {
  let noDia = 0
  let registros = 0
  let porDia = 0
  let porMinutoRegistros = 0
  const inicio = Date.parse('2026-10-13T00:00:00.000Z')
  const depoisDoEstouro: number[] = []
  let estourou = false
  for (let m = 0; m < 1_440; m++) {
    for (let c = 1; c <= porMinuto; c++) {
      noDia += 1
      const d = decidirTaxa(c, noDia, inicio + m * MINUTO)
      if (!d.serve && d.registrar) {
        registros += 1
        if (d.por === 'dia') porDia += 1
        else porMinutoRegistros += 1
        if (d.por === 'dia') estourou = true
      } else if (estourou) depoisDoEstouro.push(noDia)
    }
  }
  return { registros, porDia, porMinutoRegistros, depoisDoEstouro }
}

describe('decidirTaxa: o dia inteiro', () => {
  it('um dia de 1.440 minutos com um cliente em laço de 40 chamadas por minuto: no máximo 17 linhas, exatamente 1 delas pelo dia', () => {
    const r = diaInteiro(40)
    expect(r.registros).toBeLessThanOrEqual(17)
    expect(r.porDia).toBe(1)
  })

  it('com 31 chamadas por minuto (o pior caso de linhas de minuto): são 16 de minuto e 1 de dia, 17 no total', () => {
    const r = diaInteiro(31)
    expect(r.porMinutoRegistros).toBe(16)
    expect(r.porDia).toBe(1)
    expect(r.registros).toBe(17)
  })

  it('o mesmo dia com 1 chamada por minuto depois do estouro: nenhuma linha depois da do 501', () => {
    let noDia = 500
    const linhas: number[] = []
    for (let m = 0; m < 600; m++) {
      noDia += 1
      const d = decidirTaxa(1, noDia, Date.parse('2026-10-13T12:00:00.000Z') + m * MINUTO)
      if (!d.serve && d.registrar) linhas.push(noDia)
    }
    expect(linhas).toEqual([501])
  })

  it('para toda sequência de um minuto (noMinuto de 1 a 40) começando com noDia de 460 a 505: no máximo 1 linha por motivo, e no máximo 2 no minuto', () => {
    for (let comeco = 460; comeco <= 505; comeco++) {
      const porMotivo = { minuto: 0, dia: 0 }
      for (let c = 1; c <= 40; c++) {
        const d = decidirTaxa(c, comeco + c, AGORA)
        if (!d.serve && d.registrar) porMotivo[d.por] += 1
      }
      expect(porMotivo.minuto).toBeLessThanOrEqual(1)
      expect(porMotivo.dia).toBeLessThanOrEqual(1)
      expect(porMotivo.minuto + porMotivo.dia).toBeLessThanOrEqual(2)
    }
  })
})

type Resp = { data: unknown; error: { code?: string; message?: string } | null }

function clienteDaTaxa(resposta: Resp | 'lanca' | 'pendente') {
  const chamadas: Array<{ nome: string; args: unknown }> = []
  const sinais: AbortSignal[] = []
  const sb = {
    rpc: (nome: string, args: unknown) => {
      chamadas.push({ nome, args })
      return {
        abortSignal: (s: AbortSignal) => {
          sinais.push(s)
          if (resposta === 'lanca') return Promise.reject(new Error('o banco quebrou'))
          if (resposta === 'pendente') return new Promise(() => {})
          return Promise.resolve(resposta)
        },
      }
    },
  }
  return { sb: sb as never, chamadas, sinais }
}

describe('somarNaTaxa', () => {
  it.each([['null', null], ['undefined', undefined], ['texto vazio', ''], ['só espaços', '   '], ['número', 7], ['objeto', {}]])('keyId %s: key_invalida no TypeScript, sem ida ao banco', async (_nome, k) => {
    const { sb, chamadas } = clienteDaTaxa({ data: { no_minuto: 1, no_dia: 1 }, error: null })
    expect(await somarNaTaxa(sb, k as unknown as string, AGORA)).toEqual({ ok: false, code: 'key_invalida' })
    expect(chamadas).toEqual([])
  })

  it('a função recebe o keyId pedido e o instante, e mais nada (argumentos exatos)', async () => {
    const { sb, chamadas } = clienteDaTaxa({ data: { no_minuto: 3, no_dia: 9 }, error: null })
    await somarNaTaxa(sb, 'key-do-pedido', AGORA)
    expect(chamadas).toEqual([{ nome: 'obs_ai_rate_hit', args: { p_key: 'key-do-pedido', p_now: '2026-10-13T15:07:42.500Z' } }])
  })

  it.each([
    ['uma linha', { no_minuto: 3, no_dia: 9 }],
    ['uma lista com uma linha', [{ no_minuto: 3, no_dia: 9 }]],
  ])('a função devolve %s: vale', async (_n, data) => {
    const { sb } = clienteDaTaxa({ data, error: null })
    expect(await somarNaTaxa(sb, 'k', AGORA)).toEqual({ ok: true, noMinuto: 3, noDia: 9 })
  })

  it.each([
    ['lista vazia', []],
    ['lista com duas linhas (não se escolhe uma)', [{ no_minuto: 3, no_dia: 9 }, { no_minuto: 4, no_dia: 10 }]],
    ['null', null],
    ['número em texto', { no_minuto: '3', no_dia: '9' }],
    ['só um dos dois números', { no_minuto: 3 }],
    ['zero (depois de somar nunca é zero)', { no_minuto: 0, no_dia: 0 }],
    ['fracionário', { no_minuto: 1.5, no_dia: 2 }],
    ['NaN e infinito', { no_minuto: Number.NaN, no_dia: Number.POSITIVE_INFINITY }],
    ['um texto solto', 'ok'],
  ])('a função devolve %s: erro forma_invalida (sem número não se serve)', async (_n, data) => {
    const { sb } = clienteDaTaxa({ data, error: null })
    expect(await somarNaTaxa(sb, 'k', AGORA)).toEqual({ ok: false, code: 'forma_invalida' })
  })

  it('erro do banco e função ausente: ok false com o code', async () => {
    expect(await somarNaTaxa(clienteDaTaxa({ data: null, error: { code: 'PGRST202', message: 'x' } }).sb, 'k', AGORA)).toEqual({ ok: false, code: 'PGRST202' })
    expect(await somarNaTaxa(clienteDaTaxa({ data: null, error: { message: 'sem código' } }).sb, 'k', AGORA)).toEqual({ ok: false, code: 'desconhecido' })
  })

  it('exceção: nunca lança, devolve ok false', async () => {
    expect(await somarNaTaxa(clienteDaTaxa('lanca').sb, 'k', AGORA)).toEqual({ ok: false, code: 'excecao' })
  })

  it('não responde em 20 ms (relógio de verdade): ok false com code tempo, e a chamada recebeu sinal de cancelamento', async () => {
    const { sb, sinais } = clienteDaTaxa('pendente')
    expect(await somarNaTaxa(sb, 'k', AGORA, { prazoMs: 20 })).toEqual({ ok: false, code: 'tempo' })
    expect(sinais).toHaveLength(1)
    expect(sinais[0]!.aborted).toBe(true)
  })

  it('sem opcoes o prazo é 5.000 (espia AbortSignal.timeout)', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await somarNaTaxa(clienteDaTaxa({ data: { no_minuto: 1, no_dia: 1 }, error: null }).sb, 'k', AGORA)
    expect(espia.mock.calls.map((c) => c[0])).toEqual([5_000])
    espia.mockRestore()
  })
})
