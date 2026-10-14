// @vitest-environment node
/**
 * A5 · E10, Tarefa 3: as pendências do arquivo (`arquivo/ler-pendencias.ts`): tabelas sem export e miniaturas de canais removidos.
 */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerPendenciasDoArquivo, NOME_ILEGIVEL } from '@/lib/youtube/observatorio/arquivo/ler-pendencias'

const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const DIA_MS = 86_400_000
const SEGREDO = 'segredo-da-mensagem-do-banco'

type Resposta = { data?: unknown; error?: { message: string; code?: string } | null } | null
interface Falso { sb: SupabaseClient; lotes: { colunas: string; filtros: unknown[][]; limite: number | null }[]; rpcs: string[] }

function falso(o: { rpc: Resposta | Error; lotes: Resposta | Error }): Falso {
  const lotes: Falso['lotes'] = []
  const rpcs: string[] = []
  const entrega = (r: Resposta | Error) => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r))
  const sb = {
    rpc: (nome: string) => { rpcs.push(nome); return { abortSignal: (s: AbortSignal) => { expect(s).toBeInstanceOf(AbortSignal); return entrega(o.rpc) } } },
    from: (tabela: string) => {
      expect(tabela).toBe('obs_archive_batches')
      const c = { colunas: '', filtros: [] as unknown[][], limite: null as number | null }
      lotes.push(c)
      const b = {
        select: (cols: string) => { c.colunas = cols; return b },
        eq: (...a: unknown[]) => { c.filtros.push(['eq', ...a]); return b },
        not: (...a: unknown[]) => { c.filtros.push(['not', ...a]); return b },
        limit: (n: number) => { c.limite = n; return b },
        abortSignal: (s: AbortSignal) => { expect(s).toBeInstanceOf(AbortSignal); return entrega(o.lotes) },
      }
      return b
    },
  } as unknown as SupabaseClient
  return { sb, lotes, rpcs }
}
const removidoHa = (dias: number, urls: string[]) => ({ deleted_at: new Date(AGORA - dias * DIA_MS).toISOString(), blob_urls_pending: urls })

describe('A5 E10 T3: lerPendenciasDoArquivo', () => {
  it('nada pendente: semExport vazio e zero miniaturas (e a consulta pede só lote de canal removido)', async () => {
    const f = falso({ rpc: { data: [], error: null }, lotes: { data: [], error: null } })
    const r = await lerPendenciasDoArquivo(f.sb, AGORA)
    expect(r.semExport).toEqual({ valor: [] })
    expect(r.miniaturas).toEqual({ valor: { urls: 0, lotes: 0, diasDaMaisAntiga: null } })
    expect(f.rpcs).toEqual(['obs_archive_uncovered'])
    expect(f.lotes[0]!.filtros).toContainEqual(['eq', 'table_name', 'competitor_channels'])
    expect(f.lotes[0]!.filtros).toContainEqual(['not', 'deleted_at', 'is', null])
    expect(f.lotes[0]!.limite).toBeGreaterThan(0)
  })

  it('tabela sem export: o nome vem; nome fora de ^[a-z0-9_]+$ é trocado por "(nome ilegível)"', async () => {
    const r = await lerPendenciasDoArquivo(falso({ rpc: { data: ['competitor_x'], error: null }, lotes: { data: [], error: null } }).sb, AGORA)
    expect(r.semExport).toEqual({ valor: ['competitor_x'] })
    const s = await lerPendenciasDoArquivo(falso({ rpc: { data: ['competitor_y', 'Drop Table; --', 7, 'ok_1'], error: null }, lotes: { data: [], error: null } }).sb, AGORA)
    expect(s.semExport).toEqual({ valor: ['competitor_y', NOME_ILEGIVEL, NOME_ILEGIVEL, 'ok_1'] })
    expect(NOME_ILEGIVEL).toBe('(nome ilegível)')
  })

  it('miniaturas de dois canais removidos: 3 e 2 URLs, há 1 e 5 dias', async () => {
    const data = [removidoHa(1, ['a', 'b', 'c']), removidoHa(5, ['d', 'e']), removidoHa(30, []), { deleted_at: null, blob_urls_pending: ['f'] }]
    const r = await lerPendenciasDoArquivo(falso({ rpc: { data: [], error: null }, lotes: { data, error: null } }).sb, AGORA)
    expect(r.miniaturas).toEqual({ valor: { urls: 5, lotes: 2, diasDaMaisAntiga: 5 } })
  })

  it('uma leitura falha e a outra vem; erro é "porque", nunca lista vazia', async () => {
    const a = await lerPendenciasDoArquivo(falso({ rpc: new Error(SEGREDO), lotes: { data: [removidoHa(2, ['x'])], error: null } }).sb, AGORA)
    expect(a.semExport).toEqual({ porque: 'excecao' })
    expect(a.miniaturas).toEqual({ valor: { urls: 1, lotes: 1, diasDaMaisAntiga: 2 } })
    const b = await lerPendenciasDoArquivo(falso({ rpc: { data: ['competitor_z'], error: null }, lotes: { data: null, error: { message: SEGREDO, code: '42P01' } } }).sb, AGORA)
    expect(b.semExport).toEqual({ valor: ['competitor_z'] })
    expect(b.miniaturas).toEqual({ porque: 'schema_ausente' })
  })

  it('resposta fora da forma: forma_invalida nas duas; erro do banco: erro_do_banco; nenhuma mensagem do banco no valor', async () => {
    const a = await lerPendenciasDoArquivo(falso({ rpc: { data: { 0: 'x' }, error: null }, lotes: { data: 'x', error: null } }).sb, AGORA)
    expect(a).toEqual({ semExport: { porque: 'forma_invalida' }, miniaturas: { porque: 'forma_invalida' } })
    const b = await lerPendenciasDoArquivo(falso({ rpc: { data: null, error: { message: SEGREDO, code: '57014' } }, lotes: { data: null, error: { message: SEGREDO, code: '42501' } } }).sb, AGORA)
    expect(b).toEqual({ semExport: { porque: 'erro_do_banco' }, miniaturas: { porque: 'erro_do_banco' } })
    expect(JSON.stringify([a, b])).not.toContain(SEGREDO)
  })

  it('data de remoção ilegível numa linha com pendência: forma_invalida só nas miniaturas', async () => {
    const r = await lerPendenciasDoArquivo(falso({ rpc: { data: [], error: null }, lotes: { data: [{ deleted_at: 'ontem', blob_urls_pending: ['a'] }], error: null } }).sb, AGORA)
    expect(r.semExport).toEqual({ valor: [] })
    expect(r.miniaturas).toEqual({ porque: 'forma_invalida' })
  })

  it('nunca lança, nem quando o cliente inteiro está quebrado', async () => {
    const sb = { rpc: () => { throw new Error(SEGREDO) }, from: () => { throw new Error(SEGREDO) } } as unknown as SupabaseClient
    const r = await lerPendenciasDoArquivo(sb, AGORA)
    expect(r).toEqual({ semExport: { porque: 'excecao' }, miniaturas: { porque: 'excecao' } })
  })
})
