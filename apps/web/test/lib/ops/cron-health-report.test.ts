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
import { evaluateCron, buildCronHealthReport, groupCronSchedules, aggregateStatus, type ICronHealthRow, type ICronHealthItem } from '@/lib/ops/cron-health-report'
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
  const TODOS_EM_DIA = Array.from(groupCronSchedules(vercelConfig.crons).keys()).map(n => linha({ cron_name: n }))

  it('sem o parâmetro da agenda o relatório é o de hoje', () => {
    const antigo = buildCronHealthReport(TODOS_EM_DIA, AGORA)
    const vazio = buildCronHealthReport(TODOS_EM_DIA, AGORA, [])
    const indefinido = buildCronHealthReport(TODOS_EM_DIA, AGORA, undefined)
    expect(vazio).toEqual(antigo)
    expect(indefinido).toEqual(antigo)
    expect(antigo.crons).toHaveLength(groupCronSchedules(vercelConfig.crons).size)
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
