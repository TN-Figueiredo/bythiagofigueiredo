// @vitest-environment node
// O fecho do disparo da agenda (A5 E16, Tarefa 12): a mensagem de falha, a guarda `schemaTablesReady`, as três funções novas do lote e `fecharDisparo`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-health')>()), readSiteHealth: vi.fn() }))
vi.mock('@/lib/youtube/horaria/prova', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/horaria/prova')>()
  return { ...o, lerProvaHoraria: vi.fn(), lerNegadosDoDono: vi.fn(), veredictoHorario: vi.fn(o.veredictoHorario) }
})

import { schemaTablesReady, schemaReady, readSiteHealth } from '@/lib/youtube/competitor-health'
import { lerNegadosDoDono, lerProvaHoraria, veredictoHorario, type ProvaHoraria } from '@/lib/youtube/horaria/prova'
import { currentSlotStart, ownerActions, weeklyPendingCount, type BatchRow } from '@/lib/youtube/competitor-sync-batch'
import { failureMessage, fecharDisparo, listaDeConcorrentesVazia, type EntradaFecho } from '@/lib/youtube/agenda/fecho'
import type { EstadoFinalTarefa, ResumoDisparo } from '@/lib/youtube/agenda/despachante'

const H = 3_600_000
const SENTINELA = 'TEXTO-SENTINELA-DO-BANCO'

// ───────────────────────── schemaTablesReady ─────────────────────────
type Resp = { data: unknown; error: { message?: string; code?: string } | null } | null | 'lanca' | 'pendura'
/** Um banco falso que registra a ORDEM em que as consultas partem e quando cada uma resolve. */
function bancoDeTabelas(resp: Record<string, Resp>, sinal?: AbortSignal) {
  const partidas: string[] = []
  const resolvidas: string[] = []
  const eventos: string[] = []
  const sb = {
    from: (tabela: string) => ({
      select: (_cols: string) => ({
        limit: () => {
          partidas.push(tabela)
          eventos.push('parte ' + tabela)
          const r: Resp = tabela in resp ? resp[tabela]! : { data: [], error: null }
          const p = new Promise<unknown>((resolve, reject) => {
            queueMicrotask(() => {
              resolvidas.push(tabela)
              eventos.push('resolve ' + tabela)
              if (r === 'lanca') reject(new Error('fetch failed ' + SENTINELA))
              else if (r !== 'pendura') resolve(r)
            })
          })
          return Object.assign(p, {
            abortSignal: (s: AbortSignal) => (s.aborted
              ? Promise.resolve({ data: null, error: { message: 'AbortError: ' + SENTINELA, code: '' } })
              : p),
          })
        },
      }),
    }),
  } as unknown as SupabaseClient
  void sinal
  return { sb, partidas, resolvidas, eventos }
}

describe('schemaTablesReady', () => {
  it('os quatro jeitos de "não li": lança, nulo, erro de rede, forma errada — nunca null; o codigo é o SQLSTATE quando o erro do banco o traz', async () => {
    const grupos: Array<[string, Array<[string, string]>]> = [['MGX', [['t1', 'a']]]]
    const lanca = await schemaTablesReady(bancoDeTabelas({ t1: 'lanca' }).sb, grupos)
    expect(lanca).toMatchObject({ tipo: 'nao_conferido', codigo: null })
    const nulo = await schemaTablesReady(bancoDeTabelas({ t1: null }).sb, grupos)
    expect(nulo).toMatchObject({ tipo: 'nao_conferido', codigo: null })
    const rede = await schemaTablesReady(bancoDeTabelas({ t1: { data: null, error: { message: 'fetch failed' } } }).sb, grupos)
    expect(rede).toMatchObject({ tipo: 'nao_conferido', codigo: null })
    const forma = await schemaTablesReady(bancoDeTabelas({ t1: { data: { x: 1 }, error: null } }).sb, grupos)
    expect(forma).toMatchObject({ tipo: 'nao_conferido', codigo: null })
    const timeout = await schemaTablesReady(bancoDeTabelas({ t1: { data: null, error: { message: 'canceling statement', code: '57014' } } }).sb, grupos)
    expect(timeout).toMatchObject({ tipo: 'nao_conferido', codigo: '57014' })
    const ausente = await schemaTablesReady(bancoDeTabelas({ t1: { data: null, error: { message: 'relation does not exist', code: '42P01' } } }).sb, grupos)
    expect(ausente).toMatchObject({ tipo: 'ausente', codigo: '42P01' })
    const postgrest = await schemaTablesReady(bancoDeTabelas({ t1: { data: null, error: { message: 'x', code: 'PGRST205' } } }).sb, grupos)
    expect(postgrest).toMatchObject({ tipo: 'ausente', codigo: 'PGRST205' })
    // um código que não tem a forma de SQLSTATE nunca sai como `codigo`
    const estranho = await schemaTablesReady(bancoDeTabelas({ t1: { data: null, error: { message: 'x', code: 'texto livre ' + SENTINELA } } }).sb, grupos)
    expect(estranho).toMatchObject({ tipo: 'nao_conferido', codigo: null })
    expect(await schemaTablesReady(bancoDeTabelas({}).sb, grupos)).toBeNull()
  })

  it('consulta em paralelo, com o sinal, e o texto é o da primeira da lista', async () => {
    const grupos: Array<[string, Array<[string, string]>]> = [['MGX', [['t1', 'a'], ['t2', 'b'], ['t3', 'c']]]]
    const ausente = (m: string) => ({ data: null, error: { message: m, code: '42P01' } })
    const a = bancoDeTabelas({ t2: ausente('segunda'), t3: ausente('terceira') })
    const r = await schemaTablesReady(a.sb, grupos, { signal: new AbortController().signal })
    // as 3 consultas partiram antes de qualquer uma resolver
    expect(a.partidas).toEqual(['t1', 't2', 't3'])
    expect(a.eventos.slice(0, 3)).toEqual(['parte t1', 'parte t2', 'parte t3'])
    expect(a.resolvidas.length).toBe(3)
    expect(r).toMatchObject({ tipo: 'ausente' })
    expect(r?.texto).toContain('(t2)')
    expect(r?.texto).toContain('segunda')
    expect(r?.texto).not.toContain('terceira')
    // sinal já abortado: não dá para saber, e a falha não leva o texto cru como código
    const ab = new AbortController(); ab.abort()
    const b = bancoDeTabelas({})
    expect(await schemaTablesReady(b.sb, grupos, { signal: ab.signal })).toMatchObject({ tipo: 'nao_conferido', codigo: null })
  })

  it('schemaReady: a assinatura e os textos de sempre (o texto da primeira falha, ou null)', async () => {
    expect(await schemaReady(bancoDeTabelas({}).sb, 'e1e2')).toBeNull()
    const t = await schemaReady(bancoDeTabelas({ competitor_videos: { data: null, error: { message: 'column x does not exist', code: '42703' } } }).sb, 'e1')
    expect(t).toBe('migration MG1 não aplicada (competitor_videos): column x does not exist. Nada foi gravado.')
  })
})

// ───────────────────────── as funções novas do lote ─────────────────────────
const linha = (id: string, o: Partial<BatchRow> = {}): BatchRow => ({
  id, channel_id: 'UC' + id, channel_name: 'Canal ' + id, site_id: 's1', last_synced_at: null, last_ok_synced_at: null, sync_status: null,
  sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null, ...o,
})

describe('competitor-sync-batch: ownerActions, weeklyPendingCount e started', () => {
  const agora = Date.now()
  it('ownerActions: a frase de acao_do_dono para canal em erro há mais de 3 dias; vazio sem eles', () => {
    const velho = new Date(agora - 4 * 24 * H).toISOString()
    const rows = [linha('a', { sync_status: 'error', sync_error_since: velho, sync_error: 'channel not found' }), linha('b')]
    const r = ownerActions(rows, agora)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/^canal Canal a em erro há 4 dias: /)
    expect(ownerActions([linha('b')], agora)).toEqual([])
  })
  it('weeklyPendingCount: os elegíveis sem a passada de hoje; ausente não conta', () => {
    const hojeSP = new Date(agora - 3 * H).toISOString().slice(0, 10)
    const rows = [linha('a', { weekly_pass_date: hojeSP }), linha('b', { weekly_pass_date: '2000-01-01' }), linha('c'), linha('d', { missing_since: '2026-01-01T00:00:00Z' })]
    expect(weeklyPendingCount(rows, agora)).toBe(2)
    expect(weeklyPendingCount([], agora)).toBe(0)
  })
  describe('runCompetitorBatch com started', () => {
    const sp = (iso: string) => Date.parse(iso + '-03:00')
    const rodar = async (started: number | undefined, nowMs: number) => {
      vi.resetModules()
      const synced: string[] = []
      vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncStatsOf: () => undefined, syncCompetitorChannel: vi.fn(async (r: { id: string }) => { synced.push(r.id); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
      const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: null }]
      vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
      const { runCompetitorBatch, BATCH_BUDGET_MS } = await import('@/lib/youtube/competitor-sync-batch')
      const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: BATCH_BUDGET_MS, now: () => nowMs, ...(started === undefined ? {} : { started }) })
      return { r, synced }
    }
    it('sem started: o relógio do lote é o da chamada (como hoje)', async () => {
      const { r, synced } = await rodar(undefined, sp('2026-10-24T15:02:00'))
      expect(synced).toEqual(['a', 'b'])
      expect(r).toMatchObject({ synced: 2, stoppedForTime: false })
    })
    it('com started 201 s antes do relógio, nenhum canal começa: parou por tempo, tudo ainda devido', async () => {
      const now = sp('2026-10-24T15:02:00')
      const { r, synced } = await rodar(now - 201_000, now)
      expect(synced).toEqual([])
      expect(r).toMatchObject({ synced: 0, stoppedForTime: true, remainingDue: 2 })
    })
    it('com started 199 s antes, os canais ainda cabem', async () => {
      const now = sp('2026-10-24T15:02:00')
      const { r } = await rodar(now - 199_000, now)
      expect(r.synced).toBe(2)
    })
  })
})

// ───────────────────────── a mensagem de falha ─────────────────────────
describe('failureMessage', () => {
  it('só lote, prova e cota dá o texto de hoje (os três casos que a rota já tinha)', () => {
    expect(failureMessage({ lote: null, prova: ['2 vídeos da faixa semanal sem ponto há mais de 8 dias'], cota: null })).toBe('série e captura: 2 vídeos da faixa semanal sem ponto há mais de 8 dias')
    expect(failureMessage({ lote: '14 de 15 canais falharam', prova: ['cota do dia não registrada (15 canais lidos)'], cota: null }))
      .toBe('14 de 15 canais falharam | série e captura: cota do dia não registrada (15 canais lidos)')
    expect(failureMessage({ lote: '3 de 5 canais falharam', prova: [], cota: '1 unidade de cota não registrada' })).toBe('3 de 5 canais falharam | 1 unidade de cota não registrada')
    expect(failureMessage({ lote: null, prova: [], cota: '4 unidades de cota não registradas' })).toBe('4 unidades de cota não registradas')
    expect(failureMessage({ lote: null, prova: ['a', 'b'], cota: null })).toBe('série e captura: a; b')
  })
  it('agenda, tarefas, lote, prova, horária e cota, nessa ordem, com os dois prefixos', () => {
    const m = failureMessage({
      semAgenda: 'SEM-AGENDA', tarefas: ['anulação: falhou', 'série semanal: 2 erros na passada'], lote: 'LOTE',
      prova: ['P1', 'P2'], horaria: ['H1', 'H2'], cota: 'COTA',
    })
    expect(m).toBe('SEM-AGENDA | anulação: falhou | série semanal: 2 erros na passada | LOTE | série e captura: P1; P2 | leitura horária: H1; H2 | COTA')
    expect(m.split('série e captura: ').length - 1).toBe(1)
    expect(m.split('leitura horária: ').length - 1).toBe(1)
  })
  it('a prova horária não entra sob "série e captura"', () => {
    expect(failureMessage({ lote: null, prova: [], horaria: ['H1'], cota: null })).toBe('leitura horária: H1')
  })
  it('o corte em 480 é entre frases, com frase de tarefa na frente: termina em "e mais N avisos" e a cota vai inteira', () => {
    const tarefas = ['leitura horária: cota do YouTube esgotada', 'sincronização dos canais: o lote de canais falhou', 'série semanal: 2 erros na passada']
    const prova = Array.from({ length: 12 }, (_, i) => 'problema número ' + i + ' com texto comprido')
    const m = failureMessage({ tarefas, lote: null, prova, cota: '37 unidades de cota não registradas' })
    expect(m.length).toBeLessThanOrEqual(480)
    expect(m).toMatch(/ \| e mais \d+ avisos?$/)
    expect(m.startsWith(tarefas.join(' | '))).toBe(true)
    expect(m).toContain('37 unidades de cota não registradas')
    const ditas = prova.filter(p => m.includes(p)).length
    const n = Number(/e mais (\d+) avisos?$/.exec(m)![1])
    expect(ditas + n).toBe(12)
    for (const p of prova) { if (m.includes(p.slice(0, 20))) expect(m).toContain(p) }
  })
  it('uma frase sozinha acima do limite é cortada com reticências em 480 (as saídas antecipadas do lote antigo passam por aqui)', () => {
    const m = failureMessage({ lote: 'x'.repeat(900), prova: [], cota: null })
    expect(m).toHaveLength(480)
    expect(m.endsWith('…')).toBe(true)
    expect(failureMessage({ lote: 'curta', prova: [], cota: null })).toBe('curta')
  })
})

// ───────────────────────── fecharDisparo ─────────────────────────
const AGORA = Date.now()
const OK = { ok: true, problems: [] as string[], notes: [] as string[] }
const PROVA: ProvaHoraria = {
  desde: new Date(AGORA - 30 * H).toISOString(), ultima_leitura: new Date(AGORA - 0.2 * H).toISOString(), horas_lidas_24h: 24,
  videos_na_lista: 10, videos_fora_do_teto: 0, videos_cobrados: 10, videos_abaixo_de_22h: 0, videos_abaixo_do_lido: 0,
  proprios_desde: null, proprios_ultima_leitura: null, proprios_na_lista: 0, proprios_fora_do_teto: 0, proprios_sem_captura: 0,
  proprios_cobrados: 0, proprios_abaixo_de_22h: 0, proprios_abaixo_do_lido: 0, proprios_em_competitor: 0,
}
const CATALOGO_FECHO = [
  { nome: 'leitura_horaria', rotulo: 'leitura horária', tetoTentativas: 3 },
  { nome: 'sincronizar_canais', rotulo: 'sincronização dos canais', tetoTentativas: 9 },
  { nome: 'serie_semanal', rotulo: 'série semanal', tetoTentativas: 12 },
]
const final = (tarefa: string, estado: EstadoFinalTarefa['estado'], o: Partial<EstadoFinalTarefa> = {}): EstadoFinalTarefa =>
  ({ tarefa, estado, ms: 0, feitas: null, deixadas: null, ...o })
const todasOk = (): EstadoFinalTarefa[] => [final('leitura_horaria', 'nao_devida'), final('sincronizar_canais', 'nao_devida'), final('serie_semanal', 'nao_devida')]
const entrada = (o: Partial<EntradaFecho> & { tarefas?: EstadoFinalTarefa[]; problemas?: string[] } = {}): EntradaFecho => {
  const resumo: ResumoDisparo = { tarefas: o.tarefas ?? todasOk(), problemas: o.problemas ?? [], notas: [] }
  return {
    sb: {} as SupabaseClient, t0: AGORA, agora: () => AGORA, resumo, catalogo: CATALOGO_FECHO, desligadas: new Set<string>(),
    linhas: [linha('a', { site_id: 's1' }), linha('b', { site_id: 's2' })], agendaDesde: new Date(AGORA - 48 * H).toISOString(), problemasAntes: [],
    ...Object.fromEntries(Object.entries(o).filter(([k]) => !['tarefas', 'problemas'].includes(k))),
    // a ordem importa: `resumo` montado acima vence
    ...{ resumo },
  } as EntradaFecho
}

describe('fecharDisparo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readSiteHealth).mockResolvedValue(OK)
    vi.mocked(lerProvaHoraria).mockResolvedValue({ valor: PROVA })
    vi.mocked(lerNegadosDoDono).mockResolvedValue({ valor: { negados: 0, semClasse: 0 } })
  })
  afterEach(() => { vi.useRealTimers() })

  it('a prova é lida em todo disparo, mesmo sem nada devido, e por site', async () => {
    const f = await fecharDisparo(entrada())
    expect(vi.mocked(readSiteHealth).mock.calls.map(c => c[1])).toEqual(['s1', 's2'])
    expect(vi.mocked(lerProvaHoraria).mock.calls.map(c => c[1])).toEqual(['s1', 's2'])
    expect(f.vermelho).toBe(false)
    expect(f.mensagem).toBeNull()
  })

  it('problema da prova horária de um site deixa o cron vermelho, sob "leitura horária:"', async () => {
    vi.mocked(lerProvaHoraria).mockImplementation(async (_sb, siteId) => ({ valor: { ...PROVA, ...(siteId === 's2' ? { ultima_leitura: new Date(AGORA - 5 * H).toISOString() } : {}) } }))
    const f = await fecharDisparo(entrada())
    expect(f.vermelho).toBe(true)
    expect(f.provaHoraria.ok).toBe(false)
    expect(f.mensagem).toMatch(/^leitura horária: leitura horária parada há 5 h/)
    expect(f.avisos).toEqual([expect.objectContaining({ siteId: 's2', chave: 'leitura_horaria_parada', tarefa: 'leitura horária' })])
  })

  it.each([
    ['faixa parcial às 18:10', 'parcial', Date.parse('2026-10-12T21:10:00Z'), false],
    ['faixa ok', 'ok', Date.parse('2026-10-12T21:10:00Z'), true],
    // m-1 do portão final (mutante M16): `nao_devida` é o estado de 17 em cada 18 disparos da faixa; sem ele, a diária devida sem ponto só seria cobrada 2 h depois do começo
    ['faixa nao_devida às 18:10 (já fechou ok neste período)', 'nao_devida', Date.parse('2026-10-12T21:10:00Z'), true],
    ['faixa parcial às 20:01 (passaram 2 h do começo)', 'parcial', Date.parse('2026-10-12T23:01:00Z'), true],
  ] as const)('slotDone vem da linha da faixa: %s', async (_n, estado, agora, esperado) => {
    expect(currentSlotStart(agora)).toBe(Date.parse('2026-10-12T21:00:00Z')) // 18:00 em São Paulo
    await fecharDisparo(entrada({
      agora: () => agora, t0: agora,
      tarefas: [final('leitura_horaria', 'ok'), final('sincronizar_canais', estado), final('serie_semanal', 'nao_devida')],
    }))
    expect(vi.mocked(readSiteHealth).mock.calls[0]![3]).toMatchObject({ slotDone: esperado, e2: true })
  })

  it('serie_semanal desligada: a prova recebe weekly false; ligada, a opção não existe', async () => {
    await fecharDisparo(entrada({ desligadas: new Set(['serie_semanal']) }))
    expect(vi.mocked(readSiteHealth).mock.calls[0]![3]).toMatchObject({ weekly: false })
    vi.mocked(readSiteHealth).mockClear()
    await fecharDisparo(entrada())
    expect(vi.mocked(readSiteHealth).mock.calls[0]![3]).not.toHaveProperty('weekly')
  })

  it('leitura_horaria desligada: nenhuma prova horária é lida e a nota diz que está desligada', async () => {
    const f = await fecharDisparo(entrada({ desligadas: new Set(['leitura_horaria']) }))
    expect(vi.mocked(lerProvaHoraria)).not.toHaveBeenCalled()
    expect(vi.mocked(lerNegadosDoDono)).not.toHaveBeenCalled()
    expect(f.provaHoraria.notes).toContain('leitura horária desligada')
    expect(f.vermelho).toBe(false)
  })

  it('acao_do_dono vem das linhas, em toda resposta, mesmo sem nada devido', async () => {
    const velho = new Date(AGORA - 4 * 24 * H).toISOString()
    const f = await fecharDisparo(entrada({ linhas: [linha('a', { sync_status: 'error', sync_error_since: velho, sync_error: 'channel not found' })] }))
    expect(f.acaoDoDono).toHaveLength(1)
    expect(f.acaoDoDono[0]).toMatch(/em erro há 4 dias/)
    expect((await fecharDisparo(entrada({ linhas: null }))).acaoDoDono).toEqual([])
  })

  it('sem as linhas dos canais não há sites: problema, como hoje com a lista de sites ausente; sem canais: nota', async () => {
    const sem = await fecharDisparo(entrada({ linhas: null }))
    expect(sem.vermelho).toBe(true)
    expect(sem.prova.problems).toEqual(['não foi possível ler a lista de sites da prova'])
    expect(vi.mocked(readSiteHealth)).not.toHaveBeenCalled()
    const vazio = await fecharDisparo(entrada({ linhas: [] }))
    expect(vazio.vermelho).toBe(false)
    expect(vazio.prova.notes).toEqual(['nenhum canal de concorrente ativo'])
  })

  it('o lote vermelho, a cota perdida e as tarefas entram na mensagem; erro da série semanal acrescenta a frase com o número', async () => {
    const lote = { synced: 1, errors: 14, errorsKnown: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: ['s1'], healthSiteIds: ['s1'], quotaLost: 3, channelsActive: 15, channelsLongError: 0 }
    const f = await fecharDisparo(entrada({
      tarefas: [
        final('leitura_horaria', 'ok'),
        final('sincronizar_canais', 'erro', { motivo: 'lote_em_erro', extra: lote }),
        final('serie_semanal', 'parcial', { motivo: 'semanal_com_erros', detalhe: { erros: 2 } }),
      ],
      problemas: ['sincronização dos canais: o lote de canais falhou'],
    }))
    expect(f.mensagem).toBe('sincronização dos canais: o lote de canais falhou | série semanal: 2 erros na passada | 14 de 15 canais falharam | 3 unidades de cota não registradas')
    expect(f.lote).toBe(lote)
  })

  it('cota perdida sozinha (lote verde, prova verde) continua uma falha, com a frase inteira', async () => {
    const lote = { synced: 3, errors: 0, errorsKnown: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: ['s1'], healthSiteIds: ['s1'], quotaLost: 3, channelsActive: 15, channelsLongError: 0 }
    const f = await fecharDisparo(entrada({ tarefas: [final('leitura_horaria', 'ok'), final('sincronizar_canais', 'ok', { extra: lote }), final('serie_semanal', 'nao_devida')] }))
    expect(f.vermelho).toBe(true)
    expect(f.mensagem).toBe('3 unidades de cota não registradas')
    expect(f.cota).toBe('3 unidades de cota não registradas')
  })

  it('tarefa esgotada neste disparo gera um aviso por site, com o teto da tarefa', async () => {
    const f = await fecharDisparo(entrada({ tarefas: [final('leitura_horaria', 'esgotada'), final('sincronizar_canais', 'nao_devida'), final('serie_semanal', 'nao_devida')], problemas: ['leitura horária: esgotou as 3 tentativas do período'] }))
    expect(f.avisos.filter(a => a.chave === 'tarefa_esgotada').map(a => [a.siteId, a.tarefa, a.frase])).toEqual([
      ['s1', 'leitura horária', 'leitura horária esgotou as 3 tentativas do período'],
      ['s2', 'leitura horária', 'leitura horária esgotou as 3 tentativas do período'],
    ])
  })

  it('fecharDisparo lê os negados do dono uma vez e entrega a todos os sites', async () => {
    vi.mocked(lerNegadosDoDono).mockResolvedValue({ valor: { negados: 1, semClasse: 2 } })
    await fecharDisparo(entrada())
    expect(vi.mocked(lerNegadosDoDono)).toHaveBeenCalledTimes(1)
    const chamadas = vi.mocked(veredictoHorario).mock.calls
    expect(chamadas).toHaveLength(2)
    for (const c of chamadas) expect(c[1]).toMatchObject({ negadosDoDono: 1, negadosSemClasse: 2 })
  })

  it('negados que não puderam ser lidos: o vermelho do dono continua (nada é descontado) e a nota diz', async () => {
    vi.mocked(lerNegadosDoDono).mockResolvedValue({ porque: 'a leitura dos vídeos negados falhou (ver Sentry)' })
    vi.mocked(lerProvaHoraria).mockResolvedValue({ valor: { ...PROVA, proprios_cobrados: 1, proprios_ultima_leitura: new Date(AGORA - 5 * H).toISOString(), proprios_desde: new Date(AGORA - 40 * H).toISOString() } })
    const f = await fecharDisparo(entrada())
    for (const c of vi.mocked(veredictoHorario).mock.calls) expect(c[1]).toMatchObject({ negadosDoDono: null, negadosSemClasse: 0 })
    expect(f.provaHoraria.problems.some(p => /seu canal parada/.test(p))).toBe(true)
    expect(f.provaHoraria.notes.some(n => /não foi possível ler quantos vídeos do seu canal/.test(n))).toBe(true)
    expect(f.vermelho).toBe(true)
  })

  it('passa agendaDesde de verdade: com a agenda de 48 h e nenhuma leitura gravada, é vermelho; sem agendaDesde, só a nota de carência', async () => {
    const semLeitura: ProvaHoraria = { ...PROVA, desde: null, ultima_leitura: null, horas_lidas_24h: 0 }
    vi.mocked(lerProvaHoraria).mockResolvedValue({ valor: semLeitura })
    const velha = await fecharDisparo(entrada())
    expect(velha.provaHoraria.problems).toContain('nenhuma leitura horária gravada')
    const nova = await fecharDisparo(entrada({ agendaDesde: null }))
    expect(nova.provaHoraria.problems).toEqual([])
    expect(nova.provaHoraria.notes.some(n => /ainda sem leitura/.test(n))).toBe(true)
  })

  it('listaDoDisparo é por site e só de concorrentes: lista dos concorrentes vazia dá 0; o total do dono e de todos os sites nunca vira o número do site', async () => {
    const lista = (d: Record<string, number>): EstadoFinalTarefa => final('leitura_horaria', 'ok', { detalhe: d })
    expect(listaDeConcorrentesVazia(lista({ lista: 0, proprios_lista: 0 }))).toBe(0)
    expect(listaDeConcorrentesVazia(lista({ lista: 5, proprios_lista: 5 }))).toBe(0) // só o dono: concorrentes zero
    expect(listaDeConcorrentesVazia(lista({ lista: 25, proprios_lista: 5 }))).toBeNull() // 20 de concorrentes em todos os sites: sem número por site
    expect(listaDeConcorrentesVazia(final('leitura_horaria', 'erro', { motivo: 'lista_falhou', detalhe: { lista: 0, proprios_lista: 0 } }))).toBeNull()
    expect(listaDeConcorrentesVazia(final('leitura_horaria', 'erro', { motivo: 'api_falhou', detalhe: { lista: 7, proprios_lista: 7 } }))).toBe(0)
    expect(listaDeConcorrentesVazia(final('leitura_horaria', 'nao_devida'))).toBeNull()
    expect(listaDeConcorrentesVazia(undefined)).toBeNull()
    // e no veredito: lista de concorrentes vazia com vídeos elegíveis na prova do site é problema
    const f = await fecharDisparo(entrada({ tarefas: [lista({ lista: 0, proprios_lista: 0 }), final('sincronizar_canais', 'nao_devida'), final('serie_semanal', 'nao_devida')] }))
    expect(f.provaHoraria.problems).toContain('a leitura horária montou lista vazia com 10 vídeos elegíveis')
    vi.mocked(veredictoHorario).mockClear()
    await fecharDisparo(entrada({ tarefas: [lista({ lista: 25, proprios_lista: 5 }), final('sincronizar_canais', 'nao_devida'), final('serie_semanal', 'nao_devida')] }))
    for (const c of vi.mocked(veredictoHorario).mock.calls) expect(c[1].listaDoDisparo).toBeNull()
  })

  it('a prova que lança ou pendura não vira verde: vermelho em português, dentro do teto', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(AGORA)
    vi.mocked(readSiteHealth).mockReturnValue(new Promise(() => undefined))
    vi.mocked(lerProvaHoraria).mockRejectedValue(new Error(SENTINELA))
    const p = fecharDisparo(entrada({ linhas: [linha('a', { site_id: 's1' })] }))
    await vi.advanceTimersByTimeAsync(20_000)
    const f = await p
    expect(f.vermelho).toBe(true)
    expect(f.prova.problems[0]).toMatch(/não foi possível ler a prova a tempo.*passou de 20 s/)
    expect(f.provaHoraria.problems).toContain('não foi possível ler a prova da leitura horária')
    expect(JSON.stringify(f)).not.toContain(SENTINELA)
  })
})
