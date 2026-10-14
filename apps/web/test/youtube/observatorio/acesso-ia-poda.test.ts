// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 13a: a poda do registro (`obs_ai_access_log`, 400 dias) e do contador (`obs_ai_rate`, 2 dias).
 * O banco é simulado por tabelas de verdade (linhas em memória que obedecem a `order`, `limit` e `lt`), para a fatia, a fronteira e a
 * convergência serem provadas contra dados, não contra chamadas decoradas. Sem filtro de `site_id`, de propósito.
 */
import { describe, expect, it, vi } from 'vitest'
import { podarAcessoIa } from '@/lib/youtube/observatorio/acesso-ia/poda'

const AGORA = Date.parse('2026-10-13T15:00:00.000Z')
const DIA = 86_400_000
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()
const diasAtras = (n: number) => iso(AGORA - n * DIA)
const SOBRA_FARTA = () => 60_000

type Linha = { at?: string; bucket?: string; origin?: string }
type Resp = { data?: unknown; count?: number | null; error?: { code?: string; message?: string } | null }

interface Chamada { tabela: string; modo: 'select' | 'delete'; filtros: Array<[string, string, unknown]> }

interface Banco {
  sb: never
  registro: Linha[]
  taxa: Linha[]
  chamadas: Chamada[]
  sinais: AbortSignal[]
}

/** `forcar(tabela, modo, ordemDaChamadaNaqueleModo)` devolve uma resposta no lugar da simulada (para falhas e contagem nula). */
function criarBanco(
  registro: Linha[],
  taxa: Linha[],
  forcar?: (tabela: string, modo: 'select' | 'delete', n: number) => Resp | 'lanca' | undefined,
): Banco {
  const b = { registro: [...registro], taxa: [...taxa], chamadas: [] as Chamada[], sinais: [] as AbortSignal[] }
  const contagem = new Map<string, number>()
  const sb = {
    from: (tabela: string) => {
      const col = tabela === 'obs_ai_access_log' ? 'at' : 'bucket'
      const alvo = () => (tabela === 'obs_ai_access_log' ? b.registro : b.taxa)
      let modo: 'select' | 'delete' = 'select'
      let ordenar = false
      let max = Infinity
      const filtros: Array<[string, string, unknown]> = []
      const cad: Record<string, unknown> = {}
      cad.select = () => { modo = 'select'; return cad }
      cad.delete = () => { modo = 'delete'; return cad }
      cad.order = () => { ordenar = true; return cad }
      cad.limit = (n: number) => { max = n; return cad }
      cad.lt = (c: string, v: unknown) => { filtros.push(['lt', c, v]); return cad }
      cad.eq = (c: string, v: unknown) => { filtros.push(['eq', c, v]); return cad }
      cad.abortSignal = (s: AbortSignal) => {
        b.sinais.push(s)
        b.chamadas.push({ tabela, modo, filtros: [...filtros] })
        const chave = `${tabela}:${modo}`
        const n = (contagem.get(chave) ?? 0) + 1
        contagem.set(chave, n)
        const f = forcar?.(tabela, modo, n)
        if (f === 'lanca') return Promise.reject(new Error('o banco quebrou'))
        if (f) return Promise.resolve(f)
        const casa = (l: Linha) => filtros.every(([op, c, v]) => {
          const x = (l as Record<string, unknown>)[c]
          return op === 'lt' ? typeof x === 'string' && x < String(v) : x === v
        })
        if (modo === 'select') {
          const todas = alvo()
          const ordem = [...todas].sort((x, y) => String((x as Record<string, unknown>)[col]).localeCompare(String((y as Record<string, unknown>)[col])))
          return Promise.resolve({ data: ordenar ? ordem.slice(0, max) : ordem, count: todas.length, error: null })
        }
        const sai = alvo().filter(casa)
        const fica = alvo().filter((l) => !casa(l))
        if (tabela === 'obs_ai_access_log') b.registro = fica
        else b.taxa = fica
        return Promise.resolve({ data: null, count: sai.length, error: null })
      }
      return cad
    },
  }
  return Object.assign(b, { sb: sb as never }) as Banco
}

/** Executa a poda e devolve também o banco depois dela (para comparar o que sobrou). */
const podar = (b: Banco, sobra: () => number = SOBRA_FARTA, agora = AGORA) => podarAcessoIa(b.sb, agora, sobra)

const registroEm = (...dias: number[]): Linha[] => dias.map((d) => ({ at: diasAtras(d), origin: 'mcp' }))
const taxaEm = (...dias: number[]): Linha[] => dias.map((d) => ({ bucket: diasAtras(d) }))
const intervalo = (de: number, ate: number): number[] => Array.from({ length: ate - de + 1 }, (_, i) => de + i)

describe('podarAcessoIa: dia normal e tabelas vazias', () => {
  it('as duas tabelas vazias: ok, feitas 0, os dois totais 0 (zero linhas LIDAS, não "nada a fazer por falta de leitura")', async () => {
    const b = criarBanco([], [])
    expect(await podar(b)).toEqual({ ok: true, r: { registroTotal: 0, registroApagadas: 0, taxaTotal: 0, taxaApagadas: 0 } })
    expect(b.chamadas.filter((c) => c.modo === 'select')).toHaveLength(2)
    expect(b.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
  })

  it('existem linhas, nenhuma velha: ok, nada apagado, com os dois totais', async () => {
    const b = criarBanco(registroEm(1, 200, 399), taxaEm(0, 1))
    expect(await podar(b)).toEqual({ ok: true, r: { registroTotal: 3, registroApagadas: 0, taxaTotal: 2, taxaApagadas: 0 } })
    expect(b.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
  })

  it('dia normal (só um dia vencido): uma execução, ok, e apaga as duas tabelas', async () => {
    const b = criarBanco(registroEm(399, 401, 401.5), taxaEm(1, 3))
    const r = await podar(b)
    expect(r).toEqual({ ok: true, r: { registroTotal: 3, registroApagadas: 2, taxaTotal: 2, taxaApagadas: 1 } })
    expect(b.registro).toHaveLength(1)
    expect(b.taxa).toHaveLength(1)
  })
})

describe('podarAcessoIa: as fronteiras', () => {
  it('registro: linha com 400 dias menos um minuto fica; com 400 dias e um minuto sai', async () => {
    const b = criarBanco([{ at: iso(AGORA - 400 * DIA + MIN) }, { at: iso(AGORA - 400 * DIA - MIN) }], [])
    const r = await podar(b)
    expect(r).toMatchObject({ ok: true, r: { registroApagadas: 1 } })
    expect(b.registro.map((l) => l.at)).toEqual([iso(AGORA - 400 * DIA + MIN)])
  })

  it('contador: balde de 2 dias menos um minuto fica; de 2 dias e um minuto sai', async () => {
    const b = criarBanco([], [{ bucket: iso(AGORA - 2 * DIA + MIN) }, { bucket: iso(AGORA - 2 * DIA - MIN) }])
    const r = await podar(b)
    expect(r).toMatchObject({ ok: true, r: { taxaApagadas: 1 } })
    expect(b.taxa.map((l) => l.bucket)).toEqual([iso(AGORA - 2 * DIA + MIN)])
  })

  it('a linha EXATAMENTE no corte fica (o corte é estritamente menor)', async () => {
    const b = criarBanco([{ at: iso(AGORA - 400 * DIA) }], [{ bucket: iso(AGORA - 2 * DIA) }])
    expect(await podar(b)).toMatchObject({ ok: true, r: { registroApagadas: 0, taxaApagadas: 0 } })
    expect(b.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
  })

  it('a fatia nunca passa do corte: com a linha mais antiga a 5 dias do corte, a linha de 399 dias fica', async () => {
    const b = criarBanco(registroEm(405, 399), [])
    const r = await podar(b)
    expect(r).toMatchObject({ ok: true, r: { registroApagadas: 1 } })
    expect(b.registro.map((l) => l.at)).toEqual([diasAtras(399)])
    const apagar = b.chamadas.find((c) => c.tabela === 'obs_ai_access_log' && c.modo === 'delete')!
    expect(apagar.filtros).toEqual([['lt', 'at', iso(AGORA - 400 * DIA)]])
  })

  it('o corte usa o relógio injetado, não o do sistema', async () => {
    const depois = AGORA + 101 * DIA
    // com o relógio de AGORA a linha de 300 dias não vence; com o relógio injetado 101 dias adiante (401 dias de idade), vence
    expect(await podar(criarBanco(registroEm(300), []))).toMatchObject({ ok: true, r: { registroApagadas: 0 } })
    expect(await podar(criarBanco(registroEm(300), []), SOBRA_FARTA, depois)).toMatchObject({ ok: true, r: { registroApagadas: 1 } })
  })

  it('a guarda vale para as duas origens: a linha velha do botão sai junto com a do mcp, e nenhum filtro de site_id ou de origem entra no apagamento', async () => {
    const b = criarBanco([{ at: diasAtras(450), origin: 'botao' }, { at: diasAtras(450), origin: 'mcp' }], [])
    const r = await podar(b)
    expect(r).toMatchObject({ ok: true, r: { registroApagadas: 2 } })
    expect(b.registro).toEqual([])
    for (const c of b.chamadas.filter((x) => x.modo === 'delete')) {
      expect(c.filtros.every(([op]) => op === 'lt')).toBe(true)
    }
  })
})

describe('podarAcessoIa: a fatia converge quando a tarefa ficou parada', () => {
  it('atraso de 100 dias no registro: a 1ª execução apaga só os 30 dias mais antigos e devolve atraso_restante com a data; a 4ª devolve ok', async () => {
    const b = criarBanco(registroEm(...intervalo(401, 500)), [])
    const r1 = await podar(b)
    expect(r1.ok).toBe(false)
    if (r1.ok) return
    expect(r1.motivo).toBe('atraso_restante')
    expect(r1.feito.registroApagadas).toBe(30)
    expect(r1.feito.maisAntigaQueFicou).toBe(diasAtras(470))
    expect(b.registro).toHaveLength(70)
    expect((await podar(b)).ok).toBe(false)
    expect((await podar(b)).ok).toBe(false)
    const r4 = await podar(b)
    expect(r4).toMatchObject({ ok: true, r: { registroTotal: 10, registroApagadas: 10 } })
    expect(b.registro).toEqual([])
  })

  it('contador com 30 dias de atraso: ok na 1ª execução, e nenhum balde com menos de 2 dias sai', async () => {
    const b = criarBanco([], taxaEm(0, 1, ...intervalo(3, 32)))
    const r = await podar(b)
    expect(r).toMatchObject({ ok: true, r: { taxaTotal: 32, taxaApagadas: 30 } })
    expect(b.taxa.map((l) => l.bucket)).toEqual([diasAtras(0), diasAtras(1)])
  })

  it('contador com 100 dias de atraso: a 1ª execução devolve atraso_restante, e converge em quatro', async () => {
    const b = criarBanco([], taxaEm(...intervalo(3, 102)))
    const r1 = await podar(b)
    expect(r1).toMatchObject({ ok: false, motivo: 'atraso_restante' })
    for (let i = 2; i <= 3; i++) expect(await podar(b)).toMatchObject({ ok: false, motivo: 'atraso_restante' })
    expect((await podar(b)).ok).toBe(true)
    expect(b.taxa).toEqual([])
  })

  it('apagou tudo o que havia: não é atraso (nada sobrou para apagar depois)', async () => {
    const b = criarBanco(registroEm(500, 480), [])
    expect(await podar(b)).toMatchObject({ ok: true, r: { registroApagadas: 2 } })
  })
})

describe('podarAcessoIa: as falhas', () => {
  it.each(['42P01', 'PGRST205'])('tabela ausente (%s) ao contar: erro schema_ausente', async (code) => {
    const b = criarBanco([], [], () => ({ data: null, count: null, error: { code } }))
    expect(await podar(b)).toEqual({ ok: false, motivo: 'schema_ausente', feito: {} })
  })

  it('tabela ausente só no contador: schema_ausente, com o que o registro já fez em feito', async () => {
    const b = criarBanco(registroEm(450), [], (t) => (t === 'obs_ai_rate' ? { data: null, count: null, error: { code: '42P01' } } : undefined))
    expect(await podar(b)).toMatchObject({ ok: false, motivo: 'schema_ausente', feito: { registroTotal: 1, registroApagadas: 1 } })
  })

  it('erro ao contar: banco_falhou, e nada é apagado', async () => {
    const b = criarBanco(registroEm(450), taxaEm(10), (_t, modo) => (modo === 'select' ? { data: null, count: null, error: { code: '57014' } } : undefined))
    expect(await podar(b)).toEqual({ ok: false, motivo: 'banco_falhou', feito: {} })
    expect(b.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
    expect(b.registro).toHaveLength(1)
  })

  it('exceção do cliente: banco_falhou, nunca lança', async () => {
    const b = criarBanco(registroEm(450), [], () => 'lanca')
    expect(await podar(b)).toEqual({ ok: false, motivo: 'banco_falhou', feito: {} })
  })

  it('apagou o registro e o contador falhou: o erro traz o que foi feito (registroApagadas no feito)', async () => {
    const b = criarBanco(registroEm(450, 451), taxaEm(10), (t, modo) => (t === 'obs_ai_rate' && modo === 'select' ? { data: null, count: null, error: { code: '57014' } } : undefined))
    expect(await podar(b)).toEqual({ ok: false, motivo: 'banco_falhou', feito: { registroTotal: 2, registroApagadas: 2 } })
  })

  it('erro ao apagar o contador: banco_falhou, com o registro já feito', async () => {
    const b = criarBanco(registroEm(450), taxaEm(10), (t, modo) => (t === 'obs_ai_rate' && modo === 'delete' ? { data: null, count: null, error: { code: '57014' } } : undefined))
    expect(await podar(b)).toMatchObject({ ok: false, motivo: 'banco_falhou', feito: { registroApagadas: 1, taxaTotal: 1 } })
  })

  it('count nulo na resposta do apagamento: contagem_ausente (não se afirma número que o banco não deu)', async () => {
    const b = criarBanco(registroEm(450), [], (_t, modo) => (modo === 'delete' ? { data: null, count: null, error: null } : undefined))
    const r = await podar(b)
    expect(r).toMatchObject({ ok: false, motivo: 'contagem_ausente' })
    if (!r.ok) expect(r.feito.registroApagadas).toBeUndefined()
  })

  it('count nulo na leitura: contagem_ausente, e nada é apagado', async () => {
    const b = criarBanco(registroEm(450), [], (_t, modo) => (modo === 'select' ? { data: [{ at: diasAtras(450) }], count: null, error: null } : undefined))
    expect(await podar(b)).toMatchObject({ ok: false, motivo: 'contagem_ausente' })
    expect(b.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
  })

  it('o total é maior que zero e a leitura da linha mais antiga veio vazia: contagem_ausente, nada é apagado', async () => {
    const b = criarBanco(registroEm(450), [], (t, modo) => (t === 'obs_ai_access_log' && modo === 'select' ? { data: [], count: 5, error: null } : undefined))
    expect(await podar(b)).toMatchObject({ ok: false, motivo: 'contagem_ausente' })
    expect(b.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
  })

  it('a linha mais antiga com data ilegível: contagem_ausente, nada é apagado', async () => {
    const b = criarBanco([], [], (t, modo) => (t === 'obs_ai_access_log' && modo === 'select' ? { data: [{ at: 'ontem' }], count: 1, error: null } : undefined))
    expect(await podar(b)).toMatchObject({ ok: false, motivo: 'contagem_ausente' })
  })
})

describe('podarAcessoIa: o relógio e o prazo', () => {
  /** A cada ida a poda pergunta quanto sobra: devolve as sobras na ordem. */
  const sobras = (...xs: number[]) => {
    let i = 0
    return () => xs[Math.min(i++, xs.length - 1)]!
  }

  it('sobram 2 s antes de uma ida: parcial (sem_tempo_para_terminar), essa ida não é feita; sobram 3 s: é feita', async () => {
    const curto = criarBanco(registroEm(450), taxaEm(10))
    // ida 1 (ler o registro) com folga; ida 2 (apagar o registro) com 2 s: não é feita
    expect(await podar(curto, sobras(60_000, 2_000))).toEqual({ ok: false, motivo: 'sem_tempo_para_terminar', feito: { registroTotal: 1 } })
    expect(curto.chamadas.filter((c) => c.modo === 'delete')).toHaveLength(0)
    expect(curto.registro).toHaveLength(1)

    const justo = criarBanco(registroEm(450), taxaEm(10))
    expect(await podar(justo, sobras(3_000))).toMatchObject({ ok: true, r: { registroApagadas: 1, taxaApagadas: 1 } })
  })

  it('sobram 2 s antes da PRIMEIRA ida: nada é chamado, parcial com feito vazio', async () => {
    const b = criarBanco(registroEm(450), taxaEm(10))
    expect(await podar(b, sobras(2_999))).toEqual({ ok: false, motivo: 'sem_tempo_para_terminar', feito: {} })
    expect(b.chamadas).toHaveLength(0)
  })

  it('sem tempo no meio, depois de apagar o registro: parcial com o registro feito em feito', async () => {
    const b = criarBanco(registroEm(450), taxaEm(10))
    const r = await podar(b, sobras(60_000, 60_000, 1_000))
    expect(r).toEqual({ ok: false, motivo: 'sem_tempo_para_terminar', feito: { registroTotal: 1, registroApagadas: 1 } })
    expect(b.taxa).toHaveLength(1)
  })

  it('cada ida recebe sinal de cancelamento de 2.500 ms (as quatro)', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    const b = criarBanco(registroEm(450), taxaEm(10))
    await podar(b)
    expect(espia.mock.calls.map((c) => c[0])).toEqual([2_500, 2_500, 2_500, 2_500])
    espia.mockRestore()
  })

  it('uma ida que não responde em 20 ms vira banco_falhou (o prazo corta), sem pendurar a tarefa', async () => {
    const b = criarBanco(registroEm(450), [])
    const original = b.sb as unknown as { from: (t: string) => Record<string, unknown> }
    const travado = {
      from: (t: string) => {
        const cad = original.from(t)
        cad.abortSignal = () => new Promise(() => {})
        return cad
      },
    }
    const espia = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort())
    const r = await podarAcessoIa(travado as never, AGORA, SOBRA_FARTA)
    espia.mockRestore()
    expect(r).toMatchObject({ ok: false, motivo: 'banco_falhou' })
  })
})
