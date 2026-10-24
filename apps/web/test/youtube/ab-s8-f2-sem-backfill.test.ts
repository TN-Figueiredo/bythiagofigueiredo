// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { groupCronSchedules, buildCronHealthReport } from '@/lib/ops/cron-health-report'

const SRC = resolve(__dirname, '../../src')
const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8')) as {
  crons: Array<{ path: string; schedule: string }>
}

function varrer(dir: string, acc: Array<{ path: string; txt: string }> = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    const st = statSync(p)
    if (st.isDirectory()) varrer(p, acc)
    else if (/\.(ts|tsx)$/.test(nome)) acc.push({ path: p, txt: readFileSync(p, 'utf8') })
  }
  return acc
}
// Lidos uma vez só e reaproveitados nos itens 3 e 4.
const arquivos = varrer(SRC)

describe('S8-F2: ab-backfill fora (escrita das views como impressões)', () => {
  it('vercel.json não tem rota ab-backfill', () => {
    expect(vercel.crons.filter((c) => c.path.startsWith('/api/cron/ab-backfill'))).toEqual([])
  })

  it('o diretório da rota não existe', () => {
    expect(existsSync(join(SRC, 'app/api/cron/ab-backfill'))).toBe(false)
  })

  it('ninguém em src usa fetchAnalyticsForDateRange', () => {
    expect(arquivos.filter((a) => a.txt.includes('fetchAnalyticsForDateRange')).map((a) => a.path)).toEqual([])
  })

  // Limite: só pega objeto literal com aspas simples; `.update(patch)` escapa.
  // A rede de verdade é a semente 1200/900 da T6.
  it('nenhum update/upsert/insert literal de impressions/clicks/ctr em ab_test_cycles', () => {
    const re = /from\('ab_test_cycles'\)[\s\S]{0,300}?\.(update|upsert|insert)\(\s*\{[^}]*\b(impressions|clicks|ctr)\s*:/
    const achados = arquivos.filter((a) => a.txt.includes("'ab_test_cycles'") && re.test(a.txt)).map((a) => a.path)
    expect(achados).toEqual([])
  })

  it('a agenda não tem grupo ab-backfill', () => {
    expect(groupCronSchedules(vercel.crons).has('ab-backfill')).toBe(false)
  })

  it('K5: linha velha de ab-backfill em cron_health não muda o relatório', () => {
    const velha = {
      cron_name: 'ab-backfill',
      last_success_at: '2026-01-01T11:00:00Z',
      last_failure_at: '2026-01-02T11:00:00Z',
      last_error: 'x',
      consecutive_failures: 9,
      severity: 'critical',
    }
    const agora = new Date('2026-10-24T15:00:00Z')
    const com = buildCronHealthReport([velha as never], agora)
    const sem = buildCronHealthReport([], agora)
    expect(com.status).toBe(sem.status)
    expect(com.unknownNames).toEqual(sem.unknownNames)
    expect(com.crons.map((c) => c.name)).toEqual(sem.crons.map((c) => c.name))
    expect(com.crons.map((c) => c.name)).not.toContain('ab-backfill')
  })
})
