import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CAMPAIGN_INTERESTS } from '../../lib/campaigns/interest'

describe('CAMPAIGN_INTERESTS matches SQL check constraint vocabulary', () => {
  it('TS const and migration file agree', () => {
    const path = resolve(
      __dirname,
      '../../../../supabase/migrations/20260414000019_campaign_interest_check.sql'
    )
    const sql = readFileSync(path, 'utf8')
    const m = sql.match(/interest in \(([^)]+)\)/i)
    expect(m).not.toBeNull()
    const sqlValues = m![1]
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .sort()
    const tsValues = [...CAMPAIGN_INTERESTS].sort()
    expect(tsValues).toEqual(sqlValues)
  })
})
