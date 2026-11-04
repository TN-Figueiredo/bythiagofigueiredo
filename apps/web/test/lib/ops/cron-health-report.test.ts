// @vitest-environment node
/**
 * Regressão da janela de atraso do dead-man-switch de crons.
 *
 * Defeito encontrado em 2026-09-18 ao instrumentar `/api/cron/cron-watchdog`:
 * atraso exigia `now >= lastRun + grace`, mas `lastRun` é a ocorrência mais
 * recente ANTERIOR a `now`, então `now - lastRun` é sempre menor que o
 * intervalo do cron. Com o piso `MIN_GRACE_MINUTES = 15`, todo cron de
 * intervalo <= 15 min tinha `grace >= intervalo` e o prazo NUNCA vencia.
 *
 * Efeito medido: um cron `* / 5` (a cada 5 min) PARADO HÁ 30 DIAS era reportado `ok`. O buraco
 * cobria justamente os crons mais frequentes — publish-scheduled,
 * notification-deliver, uptime-probe, social-publish,
 * send-scheduled-newsletters — e o próprio cron-watchdog.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePassos } from '@/lib/youtube/coleta/passos-parciais'
import { JOBS_SEM_GRADE, computeExpectedRuns, resolveCronName, evaluateCron, buildCronHealthReport, groupCronSchedules, aggregateStatus, type ICronHealthRow, type ICronHealthItem } from '@/lib/ops/cron-health-report'
import vercelConfig from '../../../vercel.json'
import type { ItemAgenda } from '@/lib/youtube/agenda/saude'

// Fixo e em UTC: a avaliação é toda em UTC e a virada de hora muda quais
// ocorrências existem, então uma fixture relativa tornaria o teste instável.
const AGORA = new Date('2026-09-18T12:42:00Z')

function linha(over: Partial<ICronHealthRow> = {}): ICronHealthRow {
  return {
    cron_name: 'x',
    last_success_at: AGORA.toISOString(),
    last_failure_at: null,
    last_error: null,
    consecutive_failures: 0,
    severity: 'info',
    ...over,
  }
}

const PARADO_HA_30_DIAS = linha({
  last_success_at: new Date(AGORA.getTime() - 30 * 864e5).toISOString(),
})

describe('atraso de cron por frequência do schedule', () => {
  const schedules: Array<[string, string]> = [
    ['*/5 * * * *', 'publish-scheduled, notification-deliver, uptime-probe'],
    ['*/15 * * * *', 'send-scheduled-newsletters, social-publish, cron-watchdog'],
    ['*/30 * * * *', 'sync-youtube, links-check-alerts'],
    ['0 * * * *', 'links-aggregate-metrics'],
    ['0 7 * * *', 'lgpd-cleanup-sweep'],
    ['0 5 * * 0', 'purge-content-events'],
  ]

  for (const [expr, exemplos] of schedules) {
    it(`'${expr}' parado há 30 dias é late (${exemplos})`, () => {
      expect(evaluateCron('x', [expr], PARADO_HA_30_DIAS, AGORA).status).toBe('late')
    })

    it(`'${expr}' com sucesso agora é ok`, () => {
      expect(evaluateCron('x', [expr], linha(), AGORA).status).toBe('ok')
    })
  }

  it('sucesso DENTRO da janela de grace não é atraso — o grace existe para isso', () => {
    // */5 com grace de 15 min: um sucesso de 6 min atrás cobre a execução
    // esperada cujo prazo venceu, então nada de alarme.
    const r = evaluateCron(
      'x',
      ['*/5 * * * *'],
      linha({ last_success_at: new Date(AGORA.getTime() - 6 * 60_000).toISOString() }),
      AGORA,
    )
    expect(r.status).toBe('ok')
  })

  it('*/5 sem sucesso há 25 min já é atraso (grace de 15 min vencido)', () => {
    const r = evaluateCron(
      'x',
      ['*/5 * * * *'],
      linha({ last_success_at: new Date(AGORA.getTime() - 25 * 60_000).toISOString() }),
      AGORA,
    )
    expect(r.status).toBe('late')
  })

  it('a última execução ter FALHADO é atraso mesmo dentro do grace', () => {
    const r = evaluateCron('x', ['*/5 * * * *'], linha({ consecutive_failures: 2 }), AGORA)
    expect(r.status).toBe('late')
  })
})

describe('regra de unknown (alarme permanente seria pior que silêncio)', () => {
  it('cron sem linha nenhuma é unknown e NÃO entra no agregado', () => {
    const r = buildCronHealthReport([], AGORA)
    expect(r.status).toBe('ok')
    expect(r.unknownCount).toBeGreaterThan(0)
    expect(r.lateNames).toEqual([])
  })
})

describe('agregado', () => {
  it('cron info atrasado => degraded; critical atrasado => down', () => {
    const info = buildCronHealthReport(
      [{ ...PARADO_HA_30_DIAS, cron_name: 'publish-scheduled' }],
      AGORA,
    )
    expect(info.status).toBe('degraded')
    expect(info.lateNames).toEqual(['publish-scheduled'])

    const critical = buildCronHealthReport(
      [{ ...PARADO_HA_30_DIAS, cron_name: 'sync-youtube', severity: 'critical' }],
      AGORA,
    )
    expect(critical.status).toBe('down')
  })
})

// ---------------------------------------------------------------------------
// A5 E16, Tarefa 11: a segunda fonte (a agenda). Só aditiva.
// ---------------------------------------------------------------------------
describe('agenda como segunda fonte do relatório', () => {
  const item = (nome: string, status: ItemAgenda['status'], motivo?: string): ItemAgenda => ({
    nome, status, ultimoOk: null, toleranciaH: 2, ...(motivo ? { motivo } : {}),
  })
  // Todos os crons do vercel.json em dia: o retrato base de "tudo verde".
  // (mais a dupla do aquecimento, que não tem grade: sem as duas linhas o job é unknown)
  const TODOS_EM_DIA = [...Array.from(groupCronSchedules(vercelConfig.crons).keys()), 'observatorio-aquecer', 'observatorio-aquecer-pedido'].map(n => linha({ cron_name: n }))

  it('sem o parâmetro da agenda o relatório é o de hoje', () => {
    const antigo = buildCronHealthReport(TODOS_EM_DIA, AGORA)
    const vazio = buildCronHealthReport(TODOS_EM_DIA, AGORA, [])
    const indefinido = buildCronHealthReport(TODOS_EM_DIA, AGORA, undefined)
    expect(vazio).toEqual(antigo)
    expect(indefinido).toEqual(antigo)
    expect(antigo.crons).toHaveLength(groupCronSchedules(vercelConfig.crons).size + JOBS_SEM_GRADE.length)
    expect(antigo.crons.some(c => c.name.startsWith('agenda:'))).toBe(false)
    expect(antigo.status).toBe('ok')
    expect(antigo.lateNames).toEqual([])
    expect(antigo.unknownNames).toEqual([])
    expect(antigo.disabledNames).toEqual([])
  })

  it('cada item entra como agenda:<nome>, sem schedules, severidade info; late vira degraded', () => {
    const r = buildCronHealthReport(TODOS_EM_DIA, AGORA, [item('leitura_horaria', 'late', 'x'), item('serie_semanal', 'ok')])
    const c = r.crons.find(x => x.name === 'agenda:leitura_horaria')
    expect(c).toMatchObject({ name: 'agenda:leitura_horaria', status: 'late', schedules: [], severity: 'info', motivo: 'x' })
    expect(r.crons.find(x => x.name === 'agenda:serie_semanal')?.status).toBe('ok')
    expect(r.status).toBe('degraded')
    expect(r.lateNames).toEqual(['agenda:leitura_horaria'])
  })

  it('unknown vai a unknownNames e não aciona alarme', () => {
    const r = buildCronHealthReport(TODOS_EM_DIA, AGORA, [item('leitura_horaria', 'unknown', 'sem leitura')])
    expect(r.status).toBe('ok')
    expect(r.unknownNames).toEqual(['agenda:leitura_horaria'])
    expect(r.unknownCount).toBe(1)
  })

  it('tarefa desligada não muda o status agregado (S-I8)', () => {
    const uma = buildCronHealthReport(TODOS_EM_DIA, AGORA, [item('leitura_horaria', 'desligada', 'agenda off'), item('serie_semanal', 'ok')])
    expect(uma.status).toBe('ok')
    const tres = buildCronHealthReport(TODOS_EM_DIA, AGORA, ['leitura_horaria', 'sincronizar_canais', 'serie_semanal'].map(n => item(n, 'desligada', 'agenda off')))
    expect(tres.status).toBe('ok')
    expect(tres.disabledNames).toEqual(['agenda:leitura_horaria', 'agenda:sincronizar_canais', 'agenda:serie_semanal'])
    expect(tres.lateNames).toEqual([])
    expect(tres.unknownNames).toEqual([])
  })

  it('tarefa desligada não esconde uma atrasada (S-I8)', () => {
    const r = buildCronHealthReport(TODOS_EM_DIA, AGORA, [item('leitura_horaria', 'desligada', 'agenda off'), item('serie_semanal', 'late')])
    expect(r.status).toBe('degraded')
    expect(r.lateNames).toEqual(['agenda:serie_semanal'])
    expect(r.disabledNames).toEqual(['agenda:leitura_horaria'])
  })

  it('aggregateStatus ignora desligada, e o cron de verdade atrasado continua valendo', () => {
    const base = (name: string, status: ICronHealthItem['status'], severity = 'info'): ICronHealthItem => ({
      name, status, schedules: [], severity, lastSuccessAt: null, lastFailureAt: null, lastError: null,
      consecutiveFailures: null, expectedLastRun: null, graceMinutes: null,
    })
    expect(aggregateStatus([base('a', 'desligada'), base('b', 'ok')])).toBe('ok')
    expect(aggregateStatus([base('a', 'desligada'), base('b', 'late', 'critical')])).toBe('down')
  })

  it('a agenda não toca nos crons que não são dela', () => {
    const sem = buildCronHealthReport([{ ...PARADO_HA_30_DIAS, cron_name: 'publish-scheduled' }], AGORA)
    const com = buildCronHealthReport([{ ...PARADO_HA_30_DIAS, cron_name: 'publish-scheduled' }], AGORA, [item('leitura_horaria', 'ok')])
    expect(com.crons.filter(c => !c.name.startsWith('agenda:'))).toEqual(sem.crons)
    expect(com.lateNames).toEqual(sem.lateNames)
    expect(com.status).toBe(sem.status)
  })
})

describe('o vigia carrega a leitura da agenda por import estático', () => {
  it('sem import() dinâmico: se o módulo não carregar o build quebra (barulho), nunca um item "unknown" em silêncio', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/lib/ops/cron-health-report.ts'), 'utf8')
    expect(fonte).not.toMatch(/import\s*\(/)
    expect(fonte).toMatch(/^import \{[^}]*lerAgendaDoVigia[^}]*\} from '@\/lib\/youtube\/agenda\/saude'/m)
    expect(fonte).not.toContain('leitura_da_agenda')
  })
})

describe('F0-c: entrada parcial da coleta', () => {
  it('resolveCronName do caminho com passos devolve o nome parcial; sem passos, o completo', () => {
    expect(resolveCronName('/api/cron/sync-analytics-metrics?passos=jobs,relatorios')).toBe('sync-analytics-metrics-parcial')
    expect(resolveCronName('/api/cron/sync-analytics-metrics')).toBe('sync-analytics-metrics')
  })

  it('o vercel.json real tem as duas chaves, com os horários certos', () => {
    const g = groupCronSchedules(vercelConfig.crons)
    expect(g.get('sync-analytics-metrics')).toEqual(['4 12 * * *'])
    expect(g.get('sync-analytics-metrics-parcial')).toEqual(['7 0 * * *'])
  })

  it('toda entrada do vercel.json com passos passa em parsePassos', () => {
    const com = vercelConfig.crons.filter(c => c.path.includes('passos'))
    expect(com.length).toBeGreaterThan(0)
    for (const c of com) expect(parsePassos(new URL(c.path, 'http://x').searchParams.get('passos')).ok).toBe(true)
  })

  it('desfazer: sem a linha da parcial, a chave some e o vigia não a avalia', () => {
    const sem = vercelConfig.crons.filter(c => !c.path.includes('passos'))
    expect(groupCronSchedules(sem).has('sync-analytics-metrics-parcial')).toBe(false)
    expect(groupCronSchedules(sem).has('sync-analytics-metrics')).toBe(true)
    const rel = buildCronHealthReport([], AGORA)
    expect(rel.crons.some(c => c.name === 'sync-analytics-metrics-parcial')).toBe(true)
  })
})

describe('F3-cache T3: o vigia do aquecimento (pedido × feito, sem grade)', () => {
  const min = (n: number): string => new Date(AGORA.getTime() - n * 60_000).toISOString()
  const pedido = (ha: number) => linha({ cron_name: 'observatorio-aquecer-pedido', last_success_at: min(ha) })
  const feito = (ha: number, o: Partial<ICronHealthRow> = {}) => linha({ cron_name: 'observatorio-aquecer', last_success_at: min(ha), ...o })
  const item = (rows: ICronHealthRow[]) => buildCronHealthReport(rows, AGORA).crons.find(c => c.name === 'observatorio-aquecer')!

  it('1. pedido há mais de 5 min sem aquecimento posterior (+5 min): vermelho', () => {
    const i = item([pedido(30), feito(24 * 60)])
    expect(i.status).toBe('late')
    expect(buildCronHealthReport([pedido(30), feito(24 * 60)], AGORA).lateNames).toContain('observatorio-aquecer')
  })
  it('1a. pedido há 20 s com aquecimento de ontem: verde (o aquecimento ainda está correndo)', () => {
    expect(item([linha({ cron_name: 'observatorio-aquecer-pedido', last_success_at: new Date(AGORA.getTime() - 20_000).toISOString() }), feito(24 * 60)]).status).toBe('ok')
  })
  it('1b. pedido há 6 min sem aquecimento posterior: vermelho', () => {
    expect(item([pedido(6), feito(24 * 60)]).status).toBe('late')
  })
  it('Phil M1: aquecimento 10 s ANTES do pedido, now = pedido + 6 min: vermelho', () => {
    const pedidoEm = AGORA.getTime() - 6 * 60_000
    const rows = [
      linha({ cron_name: 'observatorio-aquecer-pedido', last_success_at: new Date(pedidoEm).toISOString() }),
      linha({ cron_name: 'observatorio-aquecer', last_success_at: new Date(pedidoEm - 10_000).toISOString() }),
    ]
    expect(item(rows).status).toBe('late')
  })
  it('1c. aquecimento posterior ao pedido: verde', () => {
    expect(item([pedido(30), feito(29.5)]).status).toBe('ok')
  })
  it('1d. a 1a execução da vida (pedido há 20 s, sem linha de aquecer) não dá vermelho falso', () => {
    expect(item([linha({ cron_name: 'observatorio-aquecer-pedido', last_success_at: new Date(AGORA.getTime() - 20_000).toISOString() })]).status).toBe('ok')
  })
  it('2. aquecimento mais novo que o pedido: verde', () => {
    expect(item([pedido(60), feito(10)]).status).toBe('ok')
  })
  it('3. consecutive_failures = 1 em observatorio-aquecer: vermelho', () => {
    expect(item([pedido(60), feito(59, { consecutive_failures: 1, last_error: 'aqueceu 3 de 5' })]).status).toBe('late')
  })
  it('4. 12 h sem pedido e sem linha de aquecimento nova: verde (sem coleta com lista não há dívida)', () => {
    expect(item([pedido(12 * 60), feito(12 * 60 - 1)]).status).toBe('ok')
    expect(item([feito(12 * 60)]).status).toBe('ok')
  })
  it('5. o job continua fora de computeExpectedRuns e do vercel.json', () => {
    expect(groupCronSchedules(vercelConfig.crons).has('observatorio-aquecer')).toBe(false)
    expect(groupCronSchedules(vercelConfig.crons).has('observatorio-aquecer-pedido')).toBe(false)
    expect(computeExpectedRuns([], AGORA)).toEqual({ lastRun: null, previousRun: null })
    expect(item([pedido(30), feito(24 * 60)]).schedules).toEqual([])
    expect(item([pedido(30), feito(24 * 60)]).expectedLastRun).toBeNull()
  })
  it('6. sem nenhuma das duas linhas: unknown, fora do agregado', () => {
    const r = buildCronHealthReport([], AGORA)
    expect(r.crons.find(c => c.name === 'observatorio-aquecer')!.status).toBe('unknown')
    expect(r.unknownNames).toContain('observatorio-aquecer')
  })
  it('severidade info: vermelho vira degraded, nunca down', () => {
    const r = buildCronHealthReport([...Array.from(groupCronSchedules(vercelConfig.crons).keys()).map(n => linha({ cron_name: n })), pedido(30), feito(24 * 60)], AGORA)
    expect(r.status).toBe('degraded')
  })
})
