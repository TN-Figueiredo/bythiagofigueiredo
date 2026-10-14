// @vitest-environment node
/**
 * A5 · E10, Tarefa 3: o leitor do sinal (`arquivo/ler-sinal.ts`). O banco é um falso que registra a consulta inteira
 * (tabela, colunas, filtros, ordem, limite), porque "não há filtro por data" só se prova olhando o que foi pedido.
 */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerSinalDoBanco, TETO_LEITURA_MS, COLUNAS_DO_SINAL, LINHAS_LIDAS } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { PROOF_MIN_MS } from '@/lib/youtube/agenda/fecho'

const MB = 1_048_576
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const dia = (offset: number): string => new Date(Date.UTC(2026, 9, 13 + offset)).toISOString().slice(0, 10)
const SEGREDO = 'segredo-da-mensagem-do-banco'

interface Consulta { tabela: string; colunas: string; filtros: unknown[][]; ordens: unknown[][]; limite: number | null; sinal: AbortSignal | null }
type Resposta = { data?: unknown; error?: { message: string; code?: string } | null } | null

function falso(resp: Resposta | (() => Resposta | Promise<Resposta>) | Error) {
  const consultas: Consulta[] = []
  const sb = {
    from: (tabela: string) => {
      const c: Consulta = { tabela, colunas: '', filtros: [], ordens: [], limite: null, sinal: null }
      consultas.push(c)
      const b = {
        select: (cols: string) => { c.colunas = cols; return b },
        order: (...a: unknown[]) => { c.ordens.push(a); return b },
        limit: (n: number) => { c.limite = n; return b },
        eq: (...a: unknown[]) => { c.filtros.push(['eq', ...a]); return b },
        gte: (...a: unknown[]) => { c.filtros.push(['gte', ...a]); return b },
        gt: (...a: unknown[]) => { c.filtros.push(['gt', ...a]); return b },
        not: (...a: unknown[]) => { c.filtros.push(['not', ...a]); return b },
        abortSignal: (s: AbortSignal) => {
          c.sinal = s
          if (resp instanceof Error) return Promise.reject(resp)
          return Promise.resolve(typeof resp === 'function' ? resp() : resp)
        },
      }
      return b
    },
  } as unknown as SupabaseClient
  return { sb, consultas }
}
const linha = (offset: number, mb: number, extra: Record<string, unknown> = {}) => ({
  day: dia(offset), db_bytes: Math.round(mb * MB), competitor_bytes: 10 * MB, own_bytes: 20 * MB, measured_at: `${dia(offset)}T08:10:00.000Z`, ...extra,
})

describe('A5 E10 T3: lerSinalDoBanco', () => {
  it('o teto é o da prova (3 s) e cada ida leva um sinal de tempo', async () => {
    expect(TETO_LEITURA_MS).toBe(PROOF_MIN_MS)
    const { sb, consultas } = falso({ data: [], error: null })
    await lerSinalDoBanco(sb, AGORA)
    expect(consultas[0]!.sinal).toBeInstanceOf(AbortSignal)
  })

  it('tabela ausente (42P01 e PGRST205): schema_ausente', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const { sb } = falso({ data: null, error: { message: SEGREDO, code } })
      expect(await lerSinalDoBanco(sb, AGORA)).toEqual({ porque: 'schema_ausente' })
    }
  })

  it('outros erros: erro_do_banco; prazo (cliente abortado); exceção; nenhuma mensagem do banco no resultado', async () => {
    const a = await lerSinalDoBanco(falso({ data: null, error: { message: SEGREDO, code: '57014' } }).sb, AGORA)
    expect(a).toEqual({ porque: 'erro_do_banco' })
    const b = await lerSinalDoBanco(falso({ data: null, error: { message: 'AbortError: The operation was aborted', code: '' } }).sb, AGORA)
    expect(b).toEqual({ porque: 'prazo' })
    const c = await lerSinalDoBanco(falso(new Error(SEGREDO)).sb, AGORA)
    expect(c).toEqual({ porque: 'excecao' })
    expect(JSON.stringify([a, b, c])).not.toContain(SEGREDO)
  })

  it('lista vazia é "nunca medido", não erro', async () => {
    const r = await lerSinalDoBanco(falso({ data: [], error: null }).sb, AGORA)
    expect('valor' in r && r.valor.estado).toBe('nunca_medido')
  })

  it('resposta que não é lista: forma_invalida (nula, objeto, texto, sem resposta)', async () => {
    for (const data of [null, { day: dia(0) }, 'x', 7]) {
      expect(await lerSinalDoBanco(falso({ data, error: null }).sb, AGORA), JSON.stringify(data)).toEqual({ porque: 'forma_invalida' })
    }
    expect(await lerSinalDoBanco(falso(null).sb, AGORA)).toEqual({ porque: 'forma_invalida' })
  })

  it('a consulta: cinco colunas, day decrescente, 29 linhas, e NENHUM filtro (por data nem por outra coisa)', async () => {
    const { sb, consultas } = falso({ data: [linha(0, 216)], error: null })
    await lerSinalDoBanco(sb, AGORA)
    expect(consultas).toHaveLength(1)
    const q = consultas[0]!
    expect(q.tabela).toBe('obs_db_size_daily')
    expect(q.colunas).toBe(COLUNAS_DO_SINAL)
    expect(COLUNAS_DO_SINAL).toBe('day, db_bytes, competitor_bytes, own_bytes, measured_at')
    expect(q.ordens).toEqual([['day', { ascending: false }]])
    expect(q.limite).toBe(29)
    expect(LINHAS_LIDAS).toBe(29)
    expect(q.filtros).toEqual([])
  })

  it('a última medida tem 40 dias: sem_leitura_hoje, amarelo, com a data dela (nunca "nunca medido")', async () => {
    const { sb } = falso({ data: [linha(-40, 360)], error: null })
    const r = await lerSinalDoBanco(sb, AGORA)
    expect('valor' in r).toBe(true)
    if (!('valor' in r)) return
    expect(r.valor.estado).toBe('sem_leitura_hoje')
    expect(r.valor.cor).toBe('amarelo')
    expect(r.valor.ultima?.day).toBe(dia(-40))
    expect(r.valor.frase).toBe('Sem leitura do banco do site hoje. A medida das 05:00 não chegou; a última, de 03/09, foi 72% do limite.')
    expect(r.valor.frase).not.toMatch(/Ainda sem medida/)
  })

  it('o guarda de forma: linha estranha vira ilegível, não derruba a leitura; bigint em texto serve', async () => {
    const boas = Array.from({ length: 20 }, (_, i) => linha(-(19 - i), 216 - (19 - i) * 0.2))
    const data = [...boas, 'lixo', null, { ...linha(-25, 100), db_bytes: 'abc' }, { ...linha(-26, 100), db_bytes: String(100 * MB), competitor_bytes: String(MB), own_bytes: String(MB) }]
    const r = await lerSinalDoBanco(falso({ data, error: null }).sb, AGORA)
    expect('valor' in r).toBe(true)
    if (!('valor' in r)) return
    expect(r.valor.ilegiveis).toBe(3) // 'lixo', null e db_bytes 'abc'; a linha com números em texto de dígitos é lida
    expect(r.valor.estado).toBe('medido')
  })
})
