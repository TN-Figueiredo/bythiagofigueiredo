import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { provaLigada, readMissingProof, provaDosAusentes, fecharApagamentos } from '@/lib/youtube/competitor-missing-proof'
import { readProofWithin } from '@/lib/youtube/agenda/fecho'
import { ZEROS_AUSENTES } from './prova-ausentes-falsa'

const NOW = '2026-10-15T12:00:00.000Z'

interface Cena { schema?: { code?: string } | 'lanca' | 'nulo'; rpc?: { data?: unknown; error?: { code: string } | null } | 'lanca'; pendentes?: unknown }
function banco(c: Cena = {}) {
  const rpc = vi.fn(async () => {
    if (c.rpc === 'lanca') throw new Error('x')
    return c.rpc ?? { data: ZEROS_AUSENTES, error: null }
  })
  const from = vi.fn((tabela: string) => {
    const q: Record<string, unknown> = {}
    const fim = async () => {
      if (tabela === 'competitor_missing_baseline') {
        if (c.schema === 'lanca') throw new Error('x')
        if (c.schema === 'nulo') return { data: null, error: null }
        if (c.schema) return { data: null, error: { code: c.schema.code } }
        return { data: [], error: null }
      }
      return { data: c.pendentes ?? [], error: null }
    }
    for (const m of ['select', 'not', 'order', 'eq']) q[m] = () => q
    q.limit = () => fim()
    return q
  })
  return { sb: { rpc, from } as unknown as SupabaseClient, rpc, from }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('provaLigada', () => {
  it('variável ausente: ligada', () => {
    delete process.env.OBS_PROVA_AUSENTES
    expect(provaLigada()).toBe(true)
  })
  it('off, OFF e " off " desligam; vazio, 0 e false não', () => {
    for (const v of ['off', 'OFF', ' off ']) expect(provaLigada({ OBS_PROVA_AUSENTES: v } as NodeJS.ProcessEnv)).toBe(false)
    for (const v of ['', '0', 'false']) expect(provaLigada({ OBS_PROVA_AUSENTES: v } as NodeJS.ProcessEnv)).toBe(true)
  })
})

describe('readMissingProof', () => {
  it('schema ausente: vermelho com o texto', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const v = await readMissingProof(banco({ schema: { code } }).sb, 's1', NOW)
      expect(v.ok).toBe(false)
      expect(v.problems).toEqual(['prova dos ausentes: schema ausente (MG-E9 não aplicada)'])
      expect(v.numeros).toBeNull()
    }
  })
  it('erro de banco na guarda, exceção, nulo, lista, chave faltando, número negativo e texto no lugar de número: vermelho "não foi possível ler"', async () => {
    const semChave: Record<string, unknown> = { ...ZEROS_AUSENTES }
    delete semChave.pisos_novos
    const casos: Cena[] = [
      { schema: { code: '57014' } },
      { rpc: 'lanca' },
      { rpc: { data: null, error: null } },
      { rpc: { data: [], error: null } },
      { rpc: { data: semChave, error: null } },
      { rpc: { data: { ...ZEROS_AUSENTES, esperando: -1 }, error: null } },
      { rpc: { data: { ...ZEROS_AUSENTES, apagando: '3' }, error: null } },
      { rpc: { data: null, error: { code: '40P01' } } },
      { schema: 'lanca' },
      { schema: 'nulo' },
    ]
    for (const c of casos) {
      const v = await readMissingProof(banco(c).sb, 's1', NOW)
      expect(v.ok).toBe(false)
      expect(v.numeros).toBeNull()
      expect(v.problems.join()).toMatch(/^prova dos ausentes: (não foi possível ler|não foi possível conferir o schema)/)
    }
  })
  it('leitura que lança: devolve "não foi possível ler" e a frase final não cita captura nem série', async () => {
    const v = await readMissingProof(banco({ rpc: 'lanca' }).sb, 's1', NOW)
    expect(v.problems).toEqual(['prova dos ausentes: não foi possível ler'])
    expect(v.problems.join()).not.toMatch(/captura|série/)
  })
  it('tudo zero: verde sem nota', async () => {
    const v = await readMissingProof(banco().sb, 's1', NOW)
    expect(v).toEqual({ ok: true, problems: [], notes: [], numeros: ZEROS_AUSENTES })
  })
  it('chama a função com o site e a hora', async () => {
    const b = banco()
    await readMissingProof(b.sb, 's1', NOW)
    expect(b.rpc).toHaveBeenCalledWith('competitor_missing_proof', { p_site: 's1', p_now: NOW })
  })
  it('queda: vermelho com a contagem', async () => {
    const um = await readMissingProof(banco({ rpc: { data: { ...ZEROS_AUSENTES, ausentes_com_queda: 1 }, error: null } }).sb, 's1', NOW)
    expect(um.ok).toBe(false)
    expect(um.problems).toEqual(['prova dos ausentes: 1 vídeo fora do ar perdeu linhas sem resposta de apagar'])
    const tres = await readMissingProof(banco({ rpc: { data: { ...ZEROS_AUSENTES, ausentes_com_queda: 3 }, error: null } }).sb, 's1', NOW)
    expect(tres.problems).toEqual(['prova dos ausentes: 3 vídeos fora do ar perderam linhas sem resposta de apagar'])
  })
  it('apagando há mais de 1 dia: vermelho; há menos de 1 dia: verde', async () => {
    const velho = await readMissingProof(banco({ rpc: { data: { ...ZEROS_AUSENTES, apagando: 2, apagando_ha_mais_de_1d: 2 }, error: null } }).sb, 's1', NOW)
    expect(velho.ok).toBe(false)
    expect(velho.problems).toEqual(['prova dos ausentes: 2 itens apagando há mais de 1 dia'])
    const novo = await readMissingProof(banco({ rpc: { data: { ...ZEROS_AUSENTES, apagando: 2, apagando_ha_mais_de_1d: 0 }, error: null } }).sb, 's1', NOW)
    expect(novo.ok).toBe(true)
  })
  it('itens esperando: nota com a contagem e os dias, e continua verde', async () => {
    const v = await readMissingProof(banco({ rpc: { data: { ...ZEROS_AUSENTES, esperando: 4, mais_antigo_dias: 9 }, error: null } }).sb, 's1', NOW)
    expect(v.ok).toBe(true)
    expect(v.notes).toEqual(['4 itens esperando resposta na fila (o mais antigo há 9 dias)'])
  })
  it('voltaram sem resposta: nota', async () => {
    const v = await readMissingProof(banco({ rpc: { data: { ...ZEROS_AUSENTES, voltaram_sem_resposta: 1 }, error: null } }).sb, 's1', NOW)
    expect(v.ok).toBe(true)
    expect(v.notes).toEqual(['1 item voltou ao ar sem resposta na fila'])
  })
})

describe('provaDosAusentes', () => {
  const dentro = (ler: () => Promise<{ ok: boolean; problems: string[]; notes: string[] }>) => readProofWithin(ler, 20_000)
  it('desligada: nota fixa, numeros nulo e zero chamadas ao banco', async () => {
    const b = banco()
    const v = await provaDosAusentes(b.sb, 's1', NOW, dentro, { OBS_PROVA_AUSENTES: 'off' } as NodeJS.ProcessEnv)
    expect(v).toEqual({ ok: true, problems: [], notes: ['prova dos ausentes desligada (OBS_PROVA_AUSENTES=off)'], numeros: null })
    expect(b.from).not.toHaveBeenCalled()
    expect(b.rpc).not.toHaveBeenCalled()
  })
  it('devolve os números quando lê', async () => {
    const v = await provaDosAusentes(banco().sb, 's1', NOW, dentro, {} as NodeJS.ProcessEnv)
    expect(v.ok).toBe(true)
    expect(v.numeros).toEqual(ZEROS_AUSENTES)
  })
  it('prefixa as frases de readProofWithin e não duplica o prefixo de quem já tem', async () => {
    vi.useFakeTimers()
    const b = banco()
    b.rpc.mockImplementation(() => new Promise(() => undefined))
    const p = provaDosAusentes(b.sb, 's1', NOW, dentro, {} as NodeJS.ProcessEnv)
    await vi.advanceTimersByTimeAsync(20_001)
    const v = await p
    expect(v.ok).toBe(false)
    expect(v.problems).toEqual(['prova dos ausentes: não foi possível ler a prova a tempo (passou de 20 s)'])
    const lancou = await provaDosAusentes(banco({ rpc: 'lanca' }).sb, 's1', NOW, dentro, {} as NodeJS.ProcessEnv)
    expect(lancou.problems).toEqual(['prova dos ausentes: não foi possível ler'])
  })
  it('estouro de prazo: numeros é nulo mesmo que a leitura termine depois', async () => {
    vi.useFakeTimers()
    const b = banco()
    b.rpc.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: ZEROS_AUSENTES, error: null }), 30_000)))
    const p = provaDosAusentes(b.sb, 's1', NOW, ler => readProofWithin(ler, 1_000), {} as NodeJS.ProcessEnv)
    await vi.advanceTimersByTimeAsync(1_001)
    const v = await p
    expect(v.ok).toBe(false)
    expect(v.numeros).toBeNull()
    await vi.advanceTimersByTimeAsync(40_000)
    expect(v.numeros).toBeNull()
  })
})

describe('fecharApagamentos', () => {
  it('com a prova desligada não chama nada', async () => {
    const b = banco()
    const r = await fecharApagamentos(b.sb, { prazoMs: 5000, env: { OBS_PROVA_AUSENTES: 'off' } as NodeJS.ProcessEnv })
    expect(r).toEqual({ tentados: 0, concluidos: 0, sites: [] })
    expect(b.from).not.toHaveBeenCalled()
  })
  it('tira os sites das pendências, não de uma lista recebida', async () => {
    const eqs: unknown[][] = []
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'not', 'order']) q[m] = () => q
    q.eq = (...a: unknown[]) => { eqs.push(a); return q }
    q.limit = () => Promise.resolve(eqs.length === 0 ? { data: [{ site_id: 'sA' }, { site_id: 'sB' }, { site_id: 'sA' }], error: null } : { data: [], error: null })
    const sb = { from: () => q } as unknown as SupabaseClient
    await fecharApagamentos(sb, { prazoMs: 5000, env: {} as NodeJS.ProcessEnv })
    expect(eqs).toEqual([['site_id', 'sA'], ['site_id', 'sB']])
  })
  it('não lança: erro na leitura dos sites vira "erro" no resultado', async () => {
    const sb = { from: () => { throw new Error('x') } } as unknown as SupabaseClient
    const r = await fecharApagamentos(sb, { prazoMs: 5000, env: {} as NodeJS.ProcessEnv })
    expect(r.tentados).toBe(0)
    expect(typeof r.erro).toBe('string')
  })
  it('respeita o prazo: uma conclusão pendurada não prende o resultado', async () => {
    vi.useFakeTimers()
    const q: Record<string, unknown> = {}
    let n = 0
    for (const m of ['select', 'not', 'order', 'eq']) q[m] = () => q
    q.limit = () => (++n === 1 ? Promise.resolve({ data: [{ site_id: 'sA' }], error: null }) : new Promise(() => undefined))
    const sb = { from: () => q } as unknown as SupabaseClient
    const p = fecharApagamentos(sb, { prazoMs: 5000, env: {} as NodeJS.ProcessEnv })
    await vi.advanceTimersByTimeAsync(5_001)
    const r = await p
    expect(r).toEqual({ tentados: 0, concluidos: 0, sites: [] })
  })
})

describe('o módulo', () => {
  const fonte = readFileSync(join(__dirname, '../../src/lib/youtube/competitor-missing-proof.ts'), 'utf8')
  it('não importa agenda/fecho (leitura do arquivo)', () => {
    expect(fonte).not.toMatch(/from ['"][^'"]*agenda\/fecho['"]/)
  })
  it('não tem "as unknown as" (leitura do arquivo)', () => {
    expect(fonte).not.toMatch(/as unknown as/)
  })
})

describe('varredura: todo arquivo que chama readSiteHealth( chama também provaDosAusentes(', () => {
  function arquivos(dir: string, acc: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome)
      if (statSync(p).isDirectory()) arquivos(p, acc)
      else if (/\.(ts|tsx)$/.test(nome)) acc.push(p)
    }
    return acc
  }
  const raiz = join(__dirname, '../../src')
  const todos = arquivos(raiz)
  const chamam = (padrao: RegExp) => todos.filter(f => padrao.test(readFileSync(f, 'utf8'))).map(f => f.slice(raiz.length + 1)).sort()
  it('os dois caminhos do cron chamam as duas provas; a declaração fica de fora de propósito', () => {
    const comDeclaracao = chamam(/readSiteHealth\(/)
    const semDeclaracao = chamam(/(?<!function )readSiteHealth\(/)
    expect(comDeclaracao).toContain('lib/youtube/competitor-health.ts')
    expect(semDeclaracao).not.toContain('lib/youtube/competitor-health.ts')
    expect(semDeclaracao).toEqual(['app/api/cron/sync-youtube/route.ts', 'lib/youtube/agenda/fecho.ts'])
    expect(chamam(/provaDosAusentes\(/)).toEqual(expect.arrayContaining(semDeclaracao))
  })
})
