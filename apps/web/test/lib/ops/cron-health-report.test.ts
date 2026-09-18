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
import { evaluateCron, buildCronHealthReport, type ICronHealthRow } from '@/lib/ops/cron-health-report'

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
