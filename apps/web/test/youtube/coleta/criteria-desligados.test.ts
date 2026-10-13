// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'
import { criterioDesligados, EXECUCOES_ATE_O_VERMELHO } from '@/lib/youtube/coleta/criteria-desligados'
import { criarRelogio, LIMITE_DA_FUNCAO_MS } from '@/lib/youtube/coleta/clock'
import { PASSOS_COM_INTERRUPTOR } from '@/lib/youtube/coleta/passos-desligados'
import { criteriosE11 } from '@/lib/youtube/coleta/criteria-e11'

const DIA_MS = 86_400_000
/** Execução anterior `i` dias atrás (1 = a mais recente). `desligados` entram no resumo como `{ desligado: true }`. */
const execucao = (i: number, desligados: string[] = [], extra: Row = {}): Row => ({
  ran_at: new Date(Date.now() - i * DIA_MS).toISOString(),
  resumo: { ...Object.fromEntries(desligados.map(p => [p, { desligado: true }])), ...extra },
})
const NOTA = (p: string, n: number) => `${p}: passo desligado por YT_OWN_STEPS_OFF (há ${n} execuções)`
const VERMELHO = (p: string, n: number) =>
  `${p}: passo desligado há ${n} execuções ou mais por YT_OWN_STEPS_OFF; religue (tire o nome da variável na Vercel e faça um deploy) ou tire o passo por commit`
const SEM_AVALIAR = (p: string, motivo: string) => `critérios: não foi possível avaliar há quanto tempo o passo ${p} está desligado (${motivo})`

async function rodar(db: FakeDb, desligados: readonly string[], relogio = criarRelogio()) {
  const falhas: string[] = []
  const notas = await criterioDesligados({ supabase: db.client, falhas, relogio }, desligados)
  return { notas, falhas }
}
/** `n` execuções anteriores seguidas com o passo desligado (a mais recente primeiro). */
const seguidas = (passo: string, n: number): Row[] => Array.from({ length: n }, (_, i) => execucao(i + 1, [passo]))

afterEach(() => {
  vi.useRealTimers()
})

describe('A5 E6/E8 · criterioDesligados', () => {
  it('a constante do prazo de vermelho é 7', () => {
    expect(EXECUCOES_ATE_O_VERMELHO).toBe(7)
  })

  it('nenhum passo desligado: não lê a tabela e devolve lista vazia', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 3) })
    const { notas, falhas } = await rodar(db, [])
    expect(notas).toEqual([])
    expect(falhas).toEqual([])
    expect(db.leituras.yt_own_collection_runs ?? 0).toBe(0)
  })

  it('lê uma vez só, mesmo com dois passos desligados, e pede as 8 mais recentes', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 10) })
    await rodar(db, ['retencao', 'dimensoes'])
    expect(db.leituras.yt_own_collection_runs).toBe(1)
  })

  it('não sobe: 6 execuções anteriores desligadas (a de hoje é a 7ª): nota na lista devolvida, falhas vazio', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 6) })
    const { notas, falhas } = await rodar(db, ['retencao'])
    expect(notas).toEqual([NOTA('retencao', 7)])
    expect(falhas).toEqual([])
  })

  it('sobe: 7 anteriores desligadas (hoje é a 8ª): a nota vai para falhas e não para a lista', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 7) })
    const { notas, falhas } = await rodar(db, ['retencao'])
    expect(falhas).toEqual([VERMELHO('retencao', 8)])
    expect(notas).toEqual([])
  })

  it('sobe também com as 8 lidas todas desligadas (o número nunca passa do que foi lido, mais a de hoje)', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 12) })
    const { notas, falhas } = await rodar(db, ['retencao'])
    expect(falhas).toEqual([VERMELHO('retencao', 9)])
    expect(notas).toEqual([])
  })

  it('não sobe: 7 anteriores, mas a 3ª mais recente rodou o passo: a sequência é 2, hoje é a 3ª', async () => {
    const linhas = seguidas('retencao', 7)
    linhas[2] = execucao(3, [], { retencao: { desligado: false } })
    const db = fakeSupabase({ yt_own_collection_runs: linhas })
    const { notas, falhas } = await rodar(db, ['retencao'])
    expect(notas).toEqual([NOTA('retencao', 3)])
    expect(falhas).toEqual([])
  })

  it('a ordem da tabela não importa: conta da mais recente para trás', async () => {
    const linhas = seguidas('retencao', 3).reverse()
    const db = fakeSupabase({ yt_own_collection_runs: linhas })
    const { notas } = await rodar(db, ['retencao'])
    expect(notas).toEqual([NOTA('retencao', 4)])
  })

  it('tabela de execuções vazia (primeiro dia): o passo desligado fica visível, como a 1ª execução', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: [] })
    const { notas, falhas } = await rodar(db, ['retencao'])
    expect(notas).toEqual([NOTA('retencao', 1)])
    expect(falhas).toEqual([])
  })

  it('execução antiga sem a chave do passo (de antes do envio) conta como "não desligado"', async () => {
    const db = fakeSupabase({
      yt_own_collection_runs: [execucao(1, ['retencao']), execucao(2, [], { diario: { ok: true } }), execucao(3, ['retencao'])],
    })
    const { notas } = await rodar(db, ['retencao'])
    expect(notas).toEqual([NOTA('retencao', 2)])
  })

  it('resumo ausente, nulo ou de forma estranha conta como "não desligado" e não derruba', async () => {
    const hoje = Date.now()
    const db = fakeSupabase({
      yt_own_collection_runs: [
        { ran_at: new Date(hoje - 1 * DIA_MS).toISOString(), resumo: { retencao: { desligado: true } } },
        { ran_at: new Date(hoje - 2 * DIA_MS).toISOString(), resumo: null },
        { ran_at: new Date(hoje - 3 * DIA_MS).toISOString(), resumo: { retencao: { desligado: true } } },
      ],
    })
    expect((await rodar(db, ['retencao'])).notas).toEqual([NOTA('retencao', 2)])
    const db2 = fakeSupabase({ yt_own_collection_runs: [{ ran_at: new Date(hoje - DIA_MS).toISOString(), resumo: { retencao: 'sim' } }] })
    expect((await rodar(db2, ['retencao'])).notas).toEqual([NOTA('retencao', 1)])
    const db3 = fakeSupabase({ yt_own_collection_runs: [{ ran_at: new Date(hoje - DIA_MS).toISOString(), resumo: { retencao: { desligado: 'true' } } }] })
    expect((await rodar(db3, ['retencao'])).notas).toEqual([NOTA('retencao', 1)])
  })

  it('leitura que falha: "não foi possível avaliar" em falhas (uma por passo) e nenhuma nota', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 3) })
    db.errors.yt_own_collection_runs = { code: '57014', message: 'canceling statement' }
    const { notas, falhas } = await rodar(db, ['retencao', 'dimensoes'])
    expect(notas).toEqual([])
    expect(falhas).toContain('erro de banco ao ler yt_own_collection_runs')
    expect(falhas).toContain(SEM_AVALIAR('retencao', 'yt_own_collection_runs'))
    expect(falhas).toContain(SEM_AVALIAR('dimensoes', 'yt_own_collection_runs'))
    expect(falhas.join('|')).not.toContain('canceling')
  })

  it('tabela ausente: schema_ausente: yt_own_collection_runs, e o passo não fica sem avaliação registrada', async () => {
    const db = fakeSupabase({})
    db.errors.yt_own_collection_runs = { code: '42P01', message: 'relation "yt_own_collection_runs" does not exist' }
    const { notas, falhas } = await rodar(db, ['retencao'])
    expect(notas).toEqual([])
    expect(falhas).toContain('schema_ausente: yt_own_collection_runs')
    expect(falhas).toContain(SEM_AVALIAR('retencao', 'yt_own_collection_runs'))
  })

  it('dados que não são lista: não foi possível avaliar (nunca zero, nunca "há 1 execução")', async () => {
    const supabase = {
      from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: { x: 1 }, error: null }) }) }) }),
    } as unknown as SupabaseClient
    const falhas: string[] = []
    const notas = await criterioDesligados({ supabase, falhas, relogio: criarRelogio() }, ['retencao'])
    expect(notas).toEqual([])
    expect(falhas).toEqual([SEM_AVALIAR('retencao', 'yt_own_collection_runs')])
  })

  it('a leitura que lança exceção vira "não foi possível avaliar", sem propagar', async () => {
    const supabase = { from: () => { throw new Error('boom com segredo') } } as unknown as SupabaseClient
    const falhas: string[] = []
    const notas = await criterioDesligados({ supabase, falhas, relogio: criarRelogio() }, ['retencao'])
    expect(notas).toEqual([])
    expect(falhas).toEqual(['erro de banco ao ler yt_own_collection_runs', SEM_AVALIAR('retencao', 'yt_own_collection_runs')])
    expect(falhas.join('|')).not.toContain('segredo')
  })

  it('dois passos desligados, um há 8 e outro há 2: um em falhas, outro na lista devolvida', async () => {
    const linhas: Row[] = Array.from({ length: 7 }, (_, i) => execucao(i + 1, i === 0 ? ['retencao', 'dimensoes'] : ['retencao']))
    const db = fakeSupabase({ yt_own_collection_runs: linhas })
    // dimensoes: só a mais recente desligada (seguidas = 1, hoje é a 2ª); retencao: 7 seguidas (hoje é a 8ª)
    const { notas, falhas } = await rodar(db, ['retencao', 'dimensoes'])
    expect(falhas).toEqual([VERMELHO('retencao', 8)])
    expect(notas).toEqual([NOTA('dimensoes', 2)])
  })

  it('nome repetido na lista conta uma vez', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 1) })
    const { notas } = await rodar(db, ['retencao', 'retencao'])
    expect(notas).toEqual([NOTA('retencao', 2)])
  })

  it('o resumo de um passo não vale para outro', async () => {
    const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 5) })
    const { notas } = await rodar(db, ['versoes'])
    expect(notas).toEqual([NOTA('versoes', 1)])
  })

  it('serve a todo passo com interruptor, inclusive os da E11', async () => {
    for (const passo of PASSOS_COM_INTERRUPTOR) {
      const db = fakeSupabase({ yt_own_collection_runs: seguidas(passo, 2) })
      expect((await rodar(db, [passo])).notas).toEqual([NOTA(passo, 3)])
    }
  })

  describe('prazo (1 s, nos 296 s da função)', () => {
    it('prazo já vencido (relógio com 297 s): não lê a tabela; "sem tempo" em falhas; lista devolvida vazia', async () => {
      const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 3) })
      const relogio = criarRelogio(Date.now() - 297_000)
      const { notas, falhas } = await rodar(db, ['retencao'], relogio)
      expect(notas).toEqual([])
      expect(falhas).toEqual([SEM_AVALIAR('retencao', 'sem tempo')])
      expect(db.leituras.yt_own_collection_runs ?? 0).toBe(0)
    })

    it('sem tempo: uma nota por passo desligado', async () => {
      const db = fakeSupabase({})
      const relogio = criarRelogio(Date.now() - (LIMITE_DA_FUNCAO_MS + 1_000))
      const { falhas } = await rodar(db, ['retencao', 'dimensoes'], relogio)
      expect(falhas).toEqual([SEM_AVALIAR('retencao', 'sem tempo'), SEM_AVALIAR('dimensoes', 'sem tempo')])
    })

    it('passa dos 270 s do relógio global mas ainda cabe nos 296 s: lê normalmente', async () => {
      const db = fakeSupabase({ yt_own_collection_runs: seguidas('retencao', 1) })
      const relogio = criarRelogio(Date.now() - 280_000)
      const { notas, falhas } = await rodar(db, ['retencao'], relogio)
      expect(notas).toEqual([NOTA('retencao', 2)])
      expect(falhas).toEqual([])
    })

    it('a leitura que não responde em 1 s vira "sem tempo", uma por passo', async () => {
      vi.useFakeTimers()
      const supabase = {
        from: () => ({ select: () => ({ order: () => ({ limit: () => new Promise(() => {}) }) }) }),
      } as unknown as SupabaseClient
      const falhas: string[] = []
      const p = criterioDesligados({ supabase, falhas, relogio: criarRelogio() }, ['retencao', 'versoes'])
      await vi.advanceTimersByTimeAsync(1_001)
      expect(await p).toEqual([])
      expect(falhas).toEqual([SEM_AVALIAR('retencao', 'sem tempo'), SEM_AVALIAR('versoes', 'sem tempo')])
    })
  })

  it('a chamada que a E11 vai fazer (Tarefa 10): o `desligados` de criteriosE11 entra sem adaptação', () => {
    type Entrada = Awaited<ReturnType<typeof criteriosE11>>['desligados']
    const f = (d: Entrada) => criterioDesligados({ supabase: fakeSupabase({}).client, falhas: [], relogio: criarRelogio() }, d)
    expect(typeof f).toBe('function')
  })
})
