// @vitest-environment node
/** A5 · E10, Tarefa 9: o caminho sem agenda lê o sinal e as pendências e nunca lança. Leitores injetados; nada de banco. */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerArquivoSemAgenda } from '@/lib/youtube/agenda/arquivo-sem-agenda'
import { FRASE_SINAL_NAO_LIDO } from '@/lib/youtube/agenda/extras-arquivo'
import { sinalDoBanco, type LinhaBruta } from '@/lib/youtube/observatorio/arquivo/sinal-do-banco'

const MB = 1_048_576
const H = 3_600_000
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const sb = {} as SupabaseClient
const dia = (o: number): string => new Date(Date.UTC(2026, 9, 13 + o)).toISOString().slice(0, 10)
const linha = (medido: number): LinhaBruta => ({ day: dia(-1), db_bytes: 100 * MB, competitor_bytes: 20 * MB, own_bytes: 10 * MB, measured_at: new Date(medido).toISOString() })
const pend = { semExport: { valor: [] as string[] }, miniaturas: { valor: { urls: 0, lotes: 0, diasDaMaisAntiga: null } } }
const leitores = (sinal: () => Promise<unknown>, pendencias: () => Promise<unknown> = async () => pend) =>
  ({ sinal, pendencias }) as unknown as NonNullable<Parameters<typeof lerArquivoSemAgenda>[0]['ler']>
const lido = (linhas: LinhaBruta[]) => async () => ({ valor: sinalDoBanco(linhas, AGORA) })

describe('lerArquivoSemAgenda', () => {
  it('sem leitura há 73 h: vermelho (problemas) e linha em acao; há 10 h: só a linha', async () => {
    const a = await lerArquivoSemAgenda({ supabase: sb, agora: () => AGORA, ler: leitores(lido([linha(AGORA - 73 * H)])) })
    expect(a.problemas).toHaveLength(1)
    expect(a.acao).toHaveLength(1)
    const b = await lerArquivoSemAgenda({ supabase: sb, agora: () => AGORA, ler: leitores(lido([linha(AGORA - 10 * H)])) })
    expect(b.problemas).toEqual([])
    expect(b.acao).toHaveLength(1)
  })
  it('tabela vazia: nunca medido, a agenda desligada, sem prometer "primeira leitura"', async () => {
    const x = await lerArquivoSemAgenda({ supabase: sb, agora: () => AGORA, ler: leitores(lido([])) })
    expect(x.acao[0]).toContain('A agenda está desligada')
    expect(x.acao[0]).not.toContain('primeira leitura')
    expect(x.problemas).toEqual([])
  })
  it('as duas leituras lançam: não lança, devolve a frase de não lido e banco.nao_lido', async () => {
    const x = await lerArquivoSemAgenda({ supabase: sb, ler: leitores(async () => { throw new Error('segredo') }, async () => { throw new Error('x') }) })
    expect(x.acao).toEqual([FRASE_SINAL_NAO_LIDO])
    expect(x.banco).toEqual({ nao_lido: 'excecao' })
    expect(JSON.stringify(x)).not.toContain('segredo')
  })
  it('um leitor que lança de forma síncrona cai no catch: banco.nao_lido = excecao, sem lançar nem vazar a mensagem', async () => {
    const x = await lerArquivoSemAgenda({ supabase: sb, agora: () => AGORA, ler: leitores(() => { throw new Error('segredo-sincrono') }) })
    expect(x.banco).toEqual({ nao_lido: 'excecao' })
    expect(x.acao).toEqual([FRASE_SINAL_NAO_LIDO])
    expect(JSON.stringify(x)).not.toContain('segredo-sincrono')
  })
  it('leitura pendurada: estoura o prazo, banco.nao_lido = prazo e o resultado nunca é vazio', async () => {
    vi.useFakeTimers()
    try {
      const p = lerArquivoSemAgenda({ supabase: sb, ler: leitores(() => new Promise(() => {}), () => new Promise(() => {})) })
      await vi.advanceTimersByTimeAsync(60_000)
      const x = await p
      expect(x.banco).toEqual({ nao_lido: 'prazo' })
      expect(x.notas).toContain(FRASE_SINAL_NAO_LIDO)
    } finally { vi.useRealTimers() }
  })
})
