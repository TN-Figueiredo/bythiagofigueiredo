// @vitest-environment node
/** A5 · E9, Tarefa 6: a janela da recusa e a do vigia da forja são a mesma. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { STALE_AFTER_MINUTES } from '@/lib/youtube/analysis-progress'
import { JANELA_FORJA_MIN } from '@/lib/youtube/observatorio/saiu/modelo'

describe('A5 E9 T6: janela da forja', () => {
  it('a constante do vigia e a da recusa são a mesma', () => {
    const texto = readFileSync(path.resolve(__dirname, '../../../src/app/api/cron/youtube-intelligence-watchdog/route.ts'), 'utf8')
    const m = /STALE_THRESHOLD_MINUTES\s*=\s*(\d+)/.exec(texto)
    expect(m, 'a varredura não achou STALE_THRESHOLD_MINUTES no vigia: o teste olha para nada').not.toBeNull()
    expect(Number(m?.[1])).toBe(STALE_AFTER_MINUTES)
    expect(JANELA_FORJA_MIN).toBe(STALE_AFTER_MINUTES)
  })
})
