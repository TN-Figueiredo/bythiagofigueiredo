// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 13a: a poda do registro (`obs_ai_access_log`, 400 dias) e do contador (`obs_ai_rate`, 2 dias).
 * O banco é simulado por tabelas de verdade (linhas em memória que obedecem a `order`, `limit` e `lt`), para a fatia, a fronteira e a
 * convergência serem provadas contra dados, não contra chamadas decoradas. Sem filtro de `site_id`, de propósito.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { podarAcessoIa } from '@/lib/youtube/observatorio/acesso-ia/poda'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'

const AGORA = Date.parse('2026-10-13T15:00:00.000Z')
const DIA = 86_400_000
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()
const diasAtras = (n: number) => iso(AGORA - n * DIA)
const SOBRA_FARTA = () => 60_000

type Linha = { at?: string; bucket?: string; origin?: string; expires_at?: string }
type Resp = { data?: unknown; count?: number | null; error?: { code?: string; message?: string } | null }

interface Chamada { tabela: string; modo: 'select' | 'delete'; filtros: Array<[string, string, unknown]> }

/** A ordem das tabelas na poda e a coluna do prazo de cada uma (as duas de hoje primeiro: uma falha numa nova não tira o registro da poda). */
const TABELAS: Array<[string, string]> = [
  ['obs_ai_access_log', 'at'], ['obs_ai_rate', 'bucket'],
  ['obs_ai_oauth_tokens', 'expires_at'], ['obs_ai_oauth_pedidos', 'expires_at'], ['obs_ai_rate_ip', 'bucket'], ['obs_ai_rate_pessoa', 'bucket'],
]
const COLUNA = new Map(TABELAS)

interface Banco {
  sb: never
  registro: Linha[]
  taxa: Linha[]
  /** linhas das tabelas OAuth novas, por nome */
  novas: Record<string, Linha[]>
  chamadas: Chamada[]
  /** nome das tabelas e das funções, na ordem em que foram chamadas (`rpc:<nome>` para função) */
  ordem: string[]
  rpcs: Array<{ nome: string; args: unknown }>
  sinais: AbortSignal[]
}

/** `forcar(tabela, modo, ordemDaChamadaNaqueleModo)` devolve uma resposta no lugar da simulada (para falhas e contagem nula). */
function criarBanco(
  registro: Linha[],
  taxa: Linha[],
  forcar?: (tabela: string, modo: 'select' | 'delete', n: number) => Resp | 'lanca' | undefined,
  novas: Record<string, Linha[]> = {},
  rpcData: () => Resp = () => ({ data: 0, error: null }),
): Banco {
  const lin: Record<string, Linha[]> = { obs_ai_access_log: [...registro], obs_ai_rate: [...taxa] }
  for (const [t] of TABELAS) if (lin[t] === undefined) lin[t] = [...(novas[t] ?? [])]
  const b = { chamadas: [] as Chamada[], sinais: [] as AbortSignal[], ordem: [] as string[], rpcs: [] as Array<{ nome: string; args: unknown }> }
  const contagem = new Map<string, number>()
  const sb = {
    rpc: (nome: string, args: unknown) => {
      b.ordem.push(`rpc:${nome}`)
      b.rpcs.push({ nome, args })
      return { abortSignal: (s: AbortSignal) => { b.sinais.push(s); return Promise.resolve(rpcData()) } }
    },
    from: (tabela: string) => {
      const col = COLUNA.get(tabela)!
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
        b.ordem.push(tabela)
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
          const todas = lin[tabela]!
          const ordem = [...todas].sort((x, y) => String((x as Record<string, unknown>)[col]).localeCompare(String((y as Record<string, unknown>)[col])))
          return Promise.resolve({ data: ordenar ? ordem.slice(0, max) : ordem, count: todas.length, error: null })
        }
        const sai = lin[tabela]!.filter(casa)
        lin[tabela] = lin[tabela]!.filter((l) => !casa(l))
        return Promise.resolve({ data: null, count: sai.length, error: null })
      }
      return cad
    },
  }
  const out = Object.assign(b, { sb: sb as never }) as unknown as Banco
  Object.defineProperty(out, 'registro', { get: () => lin.obs_ai_access_log })
  Object.defineProperty(out, 'taxa', { get: () => lin.obs_ai_rate })
  Object.defineProperty(out, 'novas', { get: () => lin })
  return out
}

/** Executa a poda e devolve também o banco depois dela (para comparar o que sobrou). */
/** Poda inteira, com tudo o que as tabelas OAuth acrescentaram ao resultado. */
const podarTudo = (b: Banco, sobra: () => number = SOBRA_FARTA, agora = AGORA) => podarAcessoIa(b.sb, agora, sobra)
/**
 * Os testes de A5 (13a) olham o resultado das DUAS tabelas de hoje: o `ok` volta só com os quatro contadores delas. Os contadores das tabelas
 * OAuth (C1) são provados nos testes da seção própria, com `podarTudo`.
 */
const podar = async (b: Banco, sobra: () => number = SOBRA_FARTA, agora = AGORA) => {
  const r = await podarTudo(b, sobra, agora)
  if (!r.ok) return r
  const { registroTotal, registroApagadas, taxaTotal, taxaApagadas } = r.r
  return { ok: true as const, r: { registroTotal, registroApagadas, taxaTotal, taxaApagadas } }
}

const registroEm = (...dias: number[]): Linha[] => dias.map((d) => ({ at: diasAtras(d), origin: 'mcp' }))
const taxaEm = (...dias: number[]): Linha[] => dias.map((d) => ({ bucket: diasAtras(d) }))
const intervalo = (de: number, ate: number): number[] => Array.from({ length: ate - de + 1 }, (_, i) => de + i)

describe('podarAcessoIa: dia normal e tabelas vazias', () => {
  it('as duas tabelas vazias: ok, feitas 0, os dois totais 0 (zero linhas LIDAS, não "nada a fazer por falta de leitura")', async () => {
    const b = criarBanco([], [])
    expect(await podar(b)).toEqual({ ok: true, r: { registroTotal: 0, registroApagadas: 0, taxaTotal: 0, taxaApagadas: 0 } })
    expect(b.chamadas.filter((c) => c.modo === 'select' && (c.tabela === 'obs_ai_access_log' || c.tabela === 'obs_ai_rate'))).toHaveLength(2)
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
    expect(r1.feito.limpoAte).toBe(diasAtras(470))
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

  it('cada ida recebe sinal de cancelamento de 2.500 ms (as quatro das duas tabelas de hoje, mais uma leitura por tabela OAuth vazia e a função dos clientes)', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    const b = criarBanco(registroEm(450), taxaEm(10))
    await podar(b)
    expect(espia.mock.calls.map((c) => c[0])).toEqual(Array(4 + 4 + 1).fill(2_500))
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

describe('podarAcessoIa: as tabelas do OAuth (C1, spec 6)', () => {
  const todasAsTabelas = ['obs_ai_access_log', 'obs_ai_rate', 'obs_ai_oauth_tokens', 'obs_ai_oauth_pedidos', 'obs_ai_rate_ip', 'obs_ai_rate_pessoa']
  const expira = (...dias: number[]): Linha[] => dias.map((d) => ({ expires_at: diasAtras(d) }))
  const sobras = (...xs: number[]) => {
    let i = 0
    return () => xs[Math.min(i++, xs.length - 1)]!
  }

  it('tokens: vencido há 30 dias menos um minuto fica; há 30 dias e um minuto sai (por expires_at, nunca por used_at)', async () => {
    const b = criarBanco([], [], undefined, { obs_ai_oauth_tokens: [{ expires_at: iso(AGORA - 30 * DIA + MIN) }, { expires_at: iso(AGORA - 30 * DIA - MIN) }] })
    const r = await podarTudo(b)
    expect(r).toMatchObject({ ok: true, r: { tokensTotal: 2, tokensApagadas: 1 } })
    expect(b.novas.obs_ai_oauth_tokens!.map((l) => l.expires_at)).toEqual([iso(AGORA - 30 * DIA + MIN)])
    const apagar = b.chamadas.find((c) => c.tabela === 'obs_ai_oauth_tokens' && c.modo === 'delete')!
    expect(apagar.filtros).toEqual([['lt', 'expires_at', iso(AGORA - 30 * DIA)]])
  })

  it('pedidos: vencido há 1 dia menos um minuto fica; há 1 dia e um minuto sai', async () => {
    const b = criarBanco([], [], undefined, { obs_ai_oauth_pedidos: [{ expires_at: iso(AGORA - DIA + MIN) }, { expires_at: iso(AGORA - DIA - MIN) }] })
    expect(await podarTudo(b)).toMatchObject({ ok: true, r: { pedidosTotal: 2, pedidosApagadas: 1 } })
    expect(b.novas.obs_ai_oauth_pedidos!.map((l) => l.expires_at)).toEqual([iso(AGORA - DIA + MIN)])
  })

  it('obs_ai_rate_ip e obs_ai_rate_pessoa: balde de 2 dias menos um minuto fica; de 2 dias e um minuto sai', async () => {
    const baldes = [{ bucket: iso(AGORA - 2 * DIA + MIN) }, { bucket: iso(AGORA - 2 * DIA - MIN) }]
    const b = criarBanco([], [], undefined, { obs_ai_rate_ip: baldes, obs_ai_rate_pessoa: baldes })
    expect(await podarTudo(b)).toMatchObject({ ok: true, r: { rateIpTotal: 2, rateIpApagadas: 1, ratePessoaTotal: 2, ratePessoaApagadas: 1 } })
    expect(b.novas.obs_ai_rate_ip!.map((l) => l.bucket)).toEqual([iso(AGORA - 2 * DIA + MIN)])
    expect(b.novas.obs_ai_rate_pessoa!.map((l) => l.bucket)).toEqual([iso(AGORA - 2 * DIA + MIN)])
  })

  it('todas por `.lt` (sem filtro de site, pessoa ou cliente) e os clientes por rpc obs_ai_podar_clientes(p_agora, p_max), com o número no resultado', async () => {
    const b = criarBanco(registroEm(450), taxaEm(10), undefined, { obs_ai_oauth_tokens: expira(40), obs_ai_oauth_pedidos: expira(3), obs_ai_rate_ip: taxaEm(5), obs_ai_rate_pessoa: taxaEm(5) }, () => ({ data: 4, error: null }))
    const r = await podarTudo(b)
    expect(r).toMatchObject({ ok: true, r: { registroApagadas: 1, taxaApagadas: 1, tokensApagadas: 1, pedidosApagadas: 1, rateIpApagadas: 1, ratePessoaApagadas: 1, clientesApagados: 4 } })
    for (const c of b.chamadas.filter((x) => x.modo === 'delete')) expect(c.filtros.every(([op]) => op === 'lt')).toBe(true)
    expect(b.rpcs).toEqual([{ nome: 'obs_ai_podar_clientes', args: { p_agora: iso(AGORA), p_max: ACESSO_IA_RULES.clientesPodadosPorExecucao } }])
  })

  it('a ordem: as duas de hoje primeiro, depois tokens, pedidos, rate_ip, rate_pessoa e por último a função dos clientes', async () => {
    const b = criarBanco([], [])
    await podarTudo(b)
    expect(b.ordem).toEqual([...todasAsTabelas, 'rpc:obs_ai_podar_clientes'])
  })

  it('falha numa tabela nova: as duas de hoje já foram podadas e estão no feito; as seguintes e os clientes não são tocados', async () => {
    const b = criarBanco(registroEm(450), taxaEm(10), (t, modo) => (t === 'obs_ai_oauth_tokens' && modo === 'select' ? { data: null, count: null, error: { code: '57014' } } : undefined))
    expect(await podarTudo(b)).toEqual({ ok: false, motivo: 'banco_falhou', feito: { registroTotal: 1, registroApagadas: 1, taxaTotal: 1, taxaApagadas: 1 } })
    expect(b.ordem).toEqual(['obs_ai_access_log', 'obs_ai_access_log', 'obs_ai_rate', 'obs_ai_rate', 'obs_ai_oauth_tokens'])
  })

  it('tabela nova ausente (42P01, antes da migration): schema_ausente, e o registro e o contador de hoje seguem podados', async () => {
    const b = criarBanco(registroEm(450), [], (t) => (t === 'obs_ai_oauth_pedidos' ? { data: null, count: null, error: { code: '42P01' } } : undefined))
    expect(await podarTudo(b)).toMatchObject({ ok: false, motivo: 'schema_ausente', feito: { registroApagadas: 1, tokensTotal: 0, tokensApagadas: 0 } })
    expect(b.registro).toEqual([])
  })

  it('a função dos clientes: erro vira banco_falhou, função ausente vira schema_ausente, número inválido vira contagem_ausente', async () => {
    const com = (resp: Resp) => criarBanco([], [], undefined, {}, () => resp)
    expect(await podarTudo(com({ data: null, error: { code: '57014' } }))).toMatchObject({ ok: false, motivo: 'banco_falhou' })
    expect(await podarTudo(com({ data: null, error: { code: 'PGRST202' } }))).toMatchObject({ ok: false, motivo: 'schema_ausente' })
    for (const data of [null, -1, 1.5, '3']) expect(await podarTudo(com({ data, error: null })), String(data)).toMatchObject({ ok: false, motivo: 'contagem_ausente' })
  })

  it('para no sobraMs: sobram menos de 3 s antes da 3ª tabela, a poda pára com o feito das duas de hoje e não toca as novas', async () => {
    const b = criarBanco([], [])
    const r = await podarTudo(b, sobras(60_000, 60_000, 2_999))
    expect(r).toEqual({ ok: false, motivo: 'sem_tempo_para_terminar', feito: { registroTotal: 0, registroApagadas: 0, taxaTotal: 0, taxaApagadas: 0 } })
    expect(b.ordem).toEqual(['obs_ai_access_log', 'obs_ai_rate'])
  })

  it('para no sobraMs também antes da função dos clientes: a função não é chamada', async () => {
    const b = criarBanco([], [])
    const r = await podarTudo(b, sobras(...Array(6).fill(60_000), 2_999))
    expect(r).toMatchObject({ ok: false, motivo: 'sem_tempo_para_terminar', feito: { ratePessoaApagadas: 0 } })
    expect(b.rpcs).toHaveLength(0)
  })

  it('atraso nas tabelas novas devolve atraso_restante com o limite inferior mais antigo (fatia de 30 dias)', async () => {
    const b = criarBanco([], [], undefined, { obs_ai_oauth_tokens: expira(...intervalo(31, 130)) })
    const r = await podarTudo(b)
    expect(r).toMatchObject({ ok: false, motivo: 'atraso_restante', feito: { tokensApagadas: 30, limpoAte: diasAtras(100) } })
  })

  it('conta de tempo (Phil M10): o pior caso são 13 idas de 2,5 s = 32,5 s, mais as folgas de 3 s, abaixo dos 85 s de fimAteMs', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    const velho = { obs_ai_oauth_tokens: expira(40), obs_ai_oauth_pedidos: expira(3), obs_ai_rate_ip: taxaEm(5), obs_ai_rate_pessoa: taxaEm(5) }
    const b = criarBanco(registroEm(450), taxaEm(10), undefined, velho)
    expect(await podarTudo(b)).toMatchObject({ ok: true })
    const prazos = espia.mock.calls.map((c) => c[0] as number)
    espia.mockRestore()
    expect(prazos).toHaveLength(13)
    const pior = prazos.reduce((a, x) => a + x, 0) + ACESSO_IA_RULES.folgaMs
    expect(pior).toBe(35_500)
    expect(pior).toBeLessThan(85_000)
  })
})

describe('poda.ts é só de servidor', () => {
  it("tem `import 'server-only'` (o plano marca o módulo como server-only)", () => {
    const texto = readFileSync(resolve(__dirname, '../../../src/lib/youtube/observatorio/acesso-ia/poda.ts'), 'utf8')
    expect(texto).toMatch(/^import 'server-only'$/m)
  })
})
