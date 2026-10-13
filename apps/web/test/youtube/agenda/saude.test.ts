// @vitest-environment node
/**
 * A5 E16, Tarefa 11: o vigia enxerga cada tarefa da agenda (a segunda fonte do relatório de saúde dos crons).
 * Parte pura (`avaliarAgenda`), a leitura limitada (`lerAgendaDoVigia`) e as duas rotas (`/api/health` e o cron-watchdog).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { avaliarAgenda, lerAgendaDoVigia, type ItemAgenda } from '@/lib/youtube/agenda/saude'
import { lerEstado } from '@/lib/youtube/agenda/estado'
import { DEFINICOES } from '@/lib/youtube/agenda/catalogo'
import { chaveDoPeriodo } from '@/lib/youtube/agenda/periodo'
import { buildCronHealthReport, resolveCronName } from '@/lib/ops/cron-health-report'
import type { EstadoAgenda, LinhaTarefa } from '@/lib/youtube/agenda/tipos'
import { GET as healthGET } from '../../../src/app/api/health/route'
import { GET as watchdogGET } from '../../../src/app/api/cron/cron-watchdog/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const H = 3_600_000
const MIN = 60_000
const AGORA = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()

const CAT = [
  { nome: 'leitura_horaria', toleranciaVigiaH: 2, nuncaDesliga: undefined },
  { nome: 'sincronizar_canais', toleranciaVigiaH: 8, nuncaDesliga: undefined },
  { nome: 'serie_semanal', toleranciaVigiaH: 36, nuncaDesliga: undefined },
] as const

function linha(task: string, lastOk: string | null): LinhaTarefa {
  return {
    task, period_key: 'k', status: null, attempts: null, runs: null, unfinished_n: null, started_at: null, finished_at: null,
    done_n: null, left_n: null, reason: null, last_ok_at: lastOk, last_run_status: null, last_run_done_n: null,
  }
}
function estado(oks: Record<string, string | null>, desde: string | null, catalogo: readonly { nome: string }[] = CAT): { valor: EstadoAgenda } {
  return { valor: { agora: iso(AGORA), desde, tarefas: catalogo.map(c => linha(c.nome, oks[c.nome] ?? null)) } }
}
const porNome = (itens: ItemAgenda[], nome: string): ItemAgenda => {
  const i = itens.find(x => x.nome === nome)
  if (!i) throw new Error(`sem item ${nome}`)
  return i
}

describe('avaliarAgenda (puro)', () => {
  it('apagar os ok de uma tarefa a acusa pelo nome, com as outras em dia', () => {
    const e = estado({ sincronizar_canais: iso(AGORA - H), serie_semanal: iso(AGORA - 5 * H) }, iso(AGORA - 5 * H))
    const itens = avaliarAgenda(e, CAT, AGORA, {})
    expect(itens.filter(i => i.status === 'late').map(i => i.nome)).toEqual(['leitura_horaria'])
    expect(porNome(itens, 'sincronizar_canais').status).toBe('ok')
    expect(porNome(itens, 'serie_semanal').status).toBe('ok')
  })

  it('tabela vazia lê como "sem leitura", nunca verde', () => {
    const itens = avaliarAgenda(estado({}, null), CAT, AGORA, {})
    expect(itens).toHaveLength(3)
    expect(itens.every(i => i.status === 'unknown')).toBe(true)
    expect(itens.some(i => i.status === 'ok')).toBe(false)
  })

  it('sem ok, mas a agenda existe há menos que a tolerância', () => {
    const itens = avaliarAgenda(estado({}, iso(AGORA - 3 * H)), CAT, AGORA, {})
    expect(porNome(itens, 'serie_semanal').status).toBe('unknown')
    expect(porNome(itens, 'serie_semanal').ultimoOk).toBeNull()
    // e a horária (tolerância 2 h) com agenda de 3 h e nenhum ok é atrasada
    expect(porNome(itens, 'leitura_horaria').status).toBe('late')
  })

  it('ok velho além da tolerância', () => {
    const itens = avaliarAgenda(estado({ leitura_horaria: iso(AGORA - (2 * H + 5 * MIN)) }, iso(AGORA - 9 * H)), CAT, AGORA, {})
    expect(porNome(itens, 'leitura_horaria').status).toBe('late')
  })

  it('ok dentro da tolerância', () => {
    const itens = avaliarAgenda(estado({ leitura_horaria: iso(AGORA - (H + 59 * MIN)) }, iso(AGORA - 9 * H)), CAT, AGORA, {})
    const i = porNome(itens, 'leitura_horaria')
    expect(i.status).toBe('ok')
    expect(i.ultimoOk).toBe(iso(AGORA - (H + 59 * MIN)))
    expect(i.toleranciaH).toBe(2)
  })

  it('tarefa nova no catálogo entra no relatório sem tocar em vercel.json nem em resolveCronName', () => {
    const cat = [...CAT, { nome: 'tarefa_inventada_agora', toleranciaVigiaH: 1, nuncaDesliga: undefined }]
    const itens = avaliarAgenda(estado({}, iso(AGORA - 5 * H), cat), cat, AGORA, {})
    expect(itens.map(i => i.nome)).toContain('tarefa_inventada_agora')
    const rel = buildCronHealthReport([], new Date(AGORA), itens)
    expect(rel.crons.map(c => c.name)).toContain('agenda:tarefa_inventada_agora')
    expect(rel.lateNames).toContain('agenda:tarefa_inventada_agora')
    // OP-5: o mapa de nomes de cron não conhece nenhum nome do catálogo, nem do real nem do de teste.
    const fonte = readFileSync(resolve(__dirname, '../../../src/lib/ops/cron-health-report.ts'), 'utf8')
    for (const nome of [...cat.map(c => c.nome), ...DEFINICOES.map(d => d.nome)]) {
      expect(fonte.includes(`'${nome}'`), nome).toBe(false)
      expect(resolveCronName(`/api/cron/sync-youtube?mode=${nome}`)).toBe('sync-youtube')
    }
    const vercel = readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8')
    for (const d of DEFINICOES) expect(vercel.includes(d.nome), d.nome).toBe(false)
  })

  it('tarefa em OBS_AGENDA_TASKS_OFF aparece como desligada', () => {
    const e = estado({}, iso(AGORA - 9 * H))
    const itens = avaliarAgenda(e, CAT, AGORA, { OBS_AGENDA_TASKS_OFF: 'leitura_horaria' })
    expect(porNome(itens, 'leitura_horaria').status).toBe('desligada')
    expect(porNome(itens, 'sincronizar_canais').status).toBe('late')
    const rel = buildCronHealthReport([], new Date(AGORA), itens)
    expect(rel.lateNames).not.toContain('agenda:leitura_horaria')
    expect(rel.disabledNames).toEqual(['agenda:leitura_horaria'])
  })

  it('agenda off: todas desligadas, menos a que nunca desliga', () => {
    const cat = [...CAT, { nome: 'anular_identidade', toleranciaVigiaH: 4, nuncaDesliga: true }]
    const e = estado({}, iso(AGORA - 9 * H), cat)
    const itens = avaliarAgenda(e, cat, AGORA, { OBS_AGENDA: 'off' })
    for (const n of ['leitura_horaria', 'sincronizar_canais', 'serie_semanal']) {
      expect(porNome(itens, n).status).toBe('desligada')
      expect(porNome(itens, n).motivo).toBe('agenda off')
    }
    // avaliada normalmente: sem ok e agenda de 9 h contra tolerância de 4 h
    expect(porNome(itens, 'anular_identidade').status).toBe('late')
  })

  it('estado que não pôde ser lido: todas late, com o motivo, sem o texto do banco', () => {
    const itens = avaliarAgenda({ porque: 'erro do banco (código 42501)' }, CAT, AGORA, {})
    expect(itens.every(i => i.status === 'late')).toBe(true)
    for (const i of itens) expect(i.motivo).toBe('não foi possível ler a agenda')
    expect(JSON.stringify(itens)).not.toContain('42501')
  })

  it('schema da agenda ausente (antes da MG10): não conferida, nunca late', () => {
    const itens = avaliarAgenda({ porque: 'migration da agenda não aplicada (código PGRST202)' }, CAT, AGORA, {})
    expect(itens.every(i => i.status === 'unknown')).toBe(true)
    for (const i of itens) expect(i.motivo).toBe('não conferida (schema ausente)')
    expect(JSON.stringify(itens)).not.toContain('PGRST')
  })

  it('agenda off vale mesmo com o estado ilegível: desligada, não late', () => {
    const itens = avaliarAgenda({ porque: 'erro do banco (código 42501)' }, CAT, AGORA, { OBS_AGENDA: 'off' })
    expect(itens.every(i => i.status === 'desligada')).toBe(true)
  })
})

// ---- a leitura limitada -------------------------------------------------------------------------------------------

type Resp = { data: unknown; error: { code?: string; message?: string } | null }
function sbRpc(resp: () => Promise<Resp>) {
  const chamadas: Array<{ fn: string; args: unknown }> = []
  const sb = {
    rpc: vi.fn((fn: string, args: unknown) => {
      chamadas.push({ fn, args })
      return { abortSignal: () => resp() }
    }),
  }
  return { sb, chamadas }
}
const respostaDaAgenda = (oks: Record<string, string | null>, desde: string | null): Resp => ({
  data: {
    agora: iso(AGORA), desde,
    tarefas: DEFINICOES.map(d => linha(d.nome, oks[d.nome] ?? null)).map(l => ({ ...l, period_key: chaveDoPeriodo(
      DEFINICOES.find(d => d.nome === l.task)!.periodo, AGORA) })),
  },
  error: null,
})

describe('lerAgendaDoVigia', () => {
  afterEach(() => { vi.useRealTimers() })

  it('pede o estado das tarefas do catálogo real, com a chave do período corrente', async () => {
    const { sb, chamadas } = sbRpc(() => Promise.resolve(respostaDaAgenda({}, null)))
    await lerAgendaDoVigia(sb as never, AGORA, {})
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]!.fn).toBe('competitor_agenda_state')
    const a = chamadas[0]!.args as { p_tasks: string[]; p_period_keys: string[] }
    expect(a.p_tasks).toEqual(DEFINICOES.map(d => d.nome))
    expect(a.p_period_keys).toEqual(DEFINICOES.map(d => chaveDoPeriodo(d.periodo, AGORA)))
  })

  it('tabela vazia: todas unknown, nenhuma ok', async () => {
    const { sb } = sbRpc(() => Promise.resolve(respostaDaAgenda({}, null)))
    const r = await lerAgendaDoVigia(sb as never, AGORA, {})
    expect(r.itens).toHaveLength(DEFINICOES.length)
    expect(r.itens.every(i => i.status === 'unknown')).toBe(true)
    expect(r.nota).toBeNull()
  })

  it('função da agenda ausente (PGRST202) e tabela ausente (PGRST205, 42P01): não conferida, sem nota de falha', async () => {
    for (const code of ['PGRST202', 'PGRST205', '42P01']) {
      const { sb } = sbRpc(() => Promise.resolve({ data: null, error: { code, message: 'TEXTO-SENTINELA-DO-BANCO' } }))
      const r = await lerAgendaDoVigia(sb as never, AGORA, {})
      expect(r.itens.every(i => i.status === 'unknown' && i.motivo === 'não conferida (schema ausente)'), code).toBe(true)
      expect(JSON.stringify(r)).not.toContain('SENTINELA')
    }
  })

  it('o banco não respondeu (lança): o relatório sai sem a agenda, com nota visível', async () => {
    const { sb } = sbRpc(() => Promise.reject(new Error('TEXTO-SENTINELA-DO-BANCO')))
    const r = await lerAgendaDoVigia(sb as never, AGORA, {})
    expect(r.itens).toEqual([])
    expect(r.nota).toBe('agenda não conferida: o banco não respondeu')
    expect(JSON.stringify(r)).not.toContain('SENTINELA')
  })

  it('o banco não responde nunca: o prazo corta e o resto do relatório sai', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { sb } = sbRpc(() => new Promise<Resp>(() => undefined))
    const p = lerAgendaDoVigia(sb as never, AGORA, {})
    await vi.advanceTimersByTimeAsync(10_000)
    const r = await p
    expect(r.itens).toEqual([])
    expect(r.nota).toBe('agenda não conferida: o banco não respondeu')
  })

  it('cliente sem rpc (lança ao chamar): mesma saída, nunca propaga', async () => {
    const r = await lerAgendaDoVigia({} as never, AGORA, {})
    expect(r.itens).toEqual([])
    expect(r.nota).not.toBeNull()
  })

  it('erro do banco com código (permissão): late, visível, sem o texto do banco', async () => {
    const { sb } = sbRpc(() => Promise.resolve({ data: null, error: { code: '42501', message: 'TEXTO-SENTINELA-DO-BANCO' } }))
    const r = await lerAgendaDoVigia(sb as never, AGORA, {})
    expect(r.itens.every(i => i.status === 'late')).toBe(true)
    expect(JSON.stringify(r)).not.toContain('SENTINELA')
    expect(JSON.stringify(r)).not.toContain('42501')
  })

  it('resposta fora da forma: late (não é "tudo ok")', async () => {
    const { sb } = sbRpc(() => Promise.resolve({ data: { agora: 'x' }, error: null }))
    const r = await lerAgendaDoVigia(sb as never, AGORA, {})
    expect(r.itens.every(i => i.status === 'late')).toBe(true)
  })

  it('acoplamento com estado.ts: as frases de lerEstado que a classificação reconhece', async () => {
    const { sb: s1 } = sbRpc(() => Promise.resolve({ data: null, error: { code: 'PGRST202' } }))
    expect(await lerEstado(s1 as never, [])).toEqual({ porque: expect.stringMatching(/^migration da agenda não aplicada/) })
    const { sb: s2 } = sbRpc(() => Promise.reject(new Error('x')))
    expect(await lerEstado(s2 as never, [])).toEqual({ porque: 'o banco não respondeu' })
  })

  it('OBS_AGENDA=off: desligadas, mesmo com a tabela ausente', async () => {
    const { sb } = sbRpc(() => Promise.resolve({ data: null, error: { code: 'PGRST202' } }))
    const r = await lerAgendaDoVigia(sb as never, AGORA, { OBS_AGENDA: 'off' })
    expect(r.itens.every(i => i.status === 'desligada' && i.motivo === 'agenda off')).toBe(true)
  })
})

// ---- OP-5 ---------------------------------------------------------------------------------------------------------

describe('nenhuma chave de cron_health por tarefa (OP-5)', () => {
  function arquivos(dir: string, out: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome)
      if (statSync(p).isDirectory()) arquivos(p, out)
      else if (/\.(ts|tsx)$/.test(nome)) out.push(p)
    }
    return out
  }
  it('recordCronSuccess( e recordCronFailure( nunca levam o nome de uma tarefa do catálogo', () => {
    const nomes = [...DEFINICOES.map(d => d.nome), 'anular_identidade', 'retratos_comentarios', 'tamanho_do_banco', 'soma_do_mapa', 'podas']
    const achados: string[] = []
    for (const f of arquivos(resolve(__dirname, '../../../src'))) {
      const linhas = readFileSync(f, 'utf8').split('\n')
      linhas.forEach((l, i) => {
        if (!/recordCron(Success|Failure)\(/.test(l)) return
        const janela = linhas.slice(i, i + 3).join(' ')
        if (nomes.some(n => janela.includes(`'${n}'`) || janela.includes(`"${n}"`) || janela.includes(`agenda:${n}`))) achados.push(`${f}:${i + 1}`)
      })
    }
    expect(achados).toEqual([])
  })
})

// ---- as duas rotas ------------------------------------------------------------------------------------------------

const SECRET = 'test-secret'
const mock = vi.mocked(getSupabaseServiceClient)
const cronRow = (cron_name: string) => ({
  cron_name, last_success_at: iso(Date.now() - 5 * MIN), last_failure_at: null, last_error: null, consecutive_failures: 0, severity: 'info',
})

function sbDasRotas(agenda: () => Promise<Resp>) {
  const select = vi.fn(() => {
    const payload = { data: [] as unknown[], error: null }
    const thenable = Promise.resolve(payload) as Promise<typeof payload> & { eq: unknown }
    thenable.eq = vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { consecutive_failures: 0 } })) }))
    return thenable
  })
  const from = vi.fn(() => ({ select, upsert: vi.fn(() => Promise.resolve({ error: null })) }))
  const rpc = vi.fn((fn: string) => {
    if (fn === 'competitor_agenda_state') return { abortSignal: () => agenda() }
    return Promise.resolve({ data: true, error: null })
  })
  return { from, rpc }
}

describe('as duas rotas leem a agenda sem derrubar o resto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', SECRET)
    vi.stubEnv('NTFY_URL', 'https://ntfy.example/topico')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  const reqHealth = () => new Request('http://localhost/api/health', { headers: { authorization: `Bearer ${SECRET}` } }) as never
  const reqWatchdog = () => new Request('http://localhost/api/cron/cron-watchdog', { method: 'GET', headers: { authorization: `Bearer ${SECRET}` } })

  it('/api/health antes da MG10 (função ausente): status e demais crons como antes; tarefas "não conferida"; nada técnico vaza', async () => {
    mock.mockReturnValue(sbDasRotas(() => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'TEXTO-SENTINELA-DO-BANCO' } })) as never)
    const res = await healthGET(reqHealth())
    const corpo = await res.json() as { status: string; crons: Array<{ name: string; status: string }>; unknownNames: string[]; disabledNames: string[] }
    expect(res.status).toBe(200)
    expect(corpo.status).toBe('ok')
    for (const d of DEFINICOES) expect(corpo.unknownNames).toContain(`agenda:${d.nome}`)
    expect(corpo.disabledNames).toEqual([])
    const texto = JSON.stringify(corpo)
    expect(texto).not.toContain('SENTINELA')
    expect(texto).not.toContain('PGRST')
  })

  it('/api/health com a agenda sem resposta: status 200 como antes, crons só os do vercel.json, nota visível', async () => {
    mock.mockReturnValue(sbDasRotas(() => Promise.reject(new Error('x'))) as never)
    const res = await healthGET(reqHealth())
    const corpo = await res.json() as { status: string; crons: Array<{ name: string }>; agendaNota?: string }
    expect(res.status).toBe(200)
    expect(corpo.status).toBe('ok')
    expect(corpo.crons.some(c => c.name.startsWith('agenda:'))).toBe(false)
    expect(corpo.agendaNota).toBe('agenda não conferida: o banco não respondeu')
  })

  it('/api/health com tarefa atrasada: degraded, nomeada; com OBS_AGENDA=off: tudo desligada e status não muda', async () => {
    mock.mockReturnValue(sbDasRotas(() => Promise.resolve(respostaDaAgenda({
      leitura_horaria: iso(Date.now() - 5 * H), sincronizar_canais: iso(Date.now() - H), serie_semanal: iso(Date.now() - H),
    }, iso(Date.now() - 30 * H)))) as never)
    const res = await healthGET(reqHealth())
    const corpo = await res.json() as { status: string; crons: Array<{ name: string; status: string }> }
    expect(corpo.status).toBe('degraded')
    expect(corpo.crons.filter(c => c.name.startsWith('agenda:') && c.status === 'late').map(c => c.name)).toEqual(['agenda:leitura_horaria'])

    vi.stubEnv('OBS_AGENDA', 'off')
    mock.mockReturnValue(sbDasRotas(() => Promise.resolve({ data: null, error: { code: 'PGRST202' } })) as never)
    const off = await (await healthGET(reqHealth())).json() as { status: string; disabledNames: string[] }
    expect(off.status).toBe('ok')
    expect(off.disabledNames).toEqual(DEFINICOES.map(d => `agenda:${d.nome}`))
  })

  it('cron-watchdog antes da MG10: ok e nenhum push', async () => {
    const push = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal('fetch', push)
    mock.mockReturnValue(sbDasRotas(() => Promise.resolve({ data: null, error: { code: 'PGRST205' } })) as never)
    const corpo = await (await watchdogGET(reqWatchdog())).json() as Record<string, unknown>
    expect(corpo.status).toBe('ok')
    expect(corpo.alerted).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('cron-watchdog com a leitura horária atrasada: avisa pelo nome da tarefa', async () => {
    const push = vi.fn((_u: unknown, _i?: unknown) => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal('fetch', push)
    mock.mockReturnValue(sbDasRotas(() => Promise.resolve(respostaDaAgenda({
      leitura_horaria: iso(Date.now() - 5 * H), sincronizar_canais: iso(Date.now() - H), serie_semanal: iso(Date.now() - H),
    }, iso(Date.now() - 30 * H)))) as never)
    const corpo = await (await watchdogGET(reqWatchdog())).json() as { status: string; lateNames?: string[] }
    expect(corpo.status).toBe('degraded')
    expect(corpo.lateNames).toEqual(['agenda:leitura_horaria'])
    expect(push).toHaveBeenCalledTimes(1)
  })
})
