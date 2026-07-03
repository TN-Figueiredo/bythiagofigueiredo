// @vitest-environment node
// Guardian for the temporal-rot class of test bugs (see CLAUDE.md "Regras
// anti-regressão de testes"): a hardcoded future date in a fixture silently
// becomes "expiring"/"expired" when the wall clock catches up and breaks CI
// with no code change (happened 2026-07-01 with Q2 fixtures, and 3 social
// suites were armed with '2027-06-01' expiries). Fixtures that interact with
// expiry logic must be relative (Date.now() + N days) or run under fake timers.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// e2e (Playwright *.spec) is outside vitest but its fixtures rot the same way.
const TEST_ROOTS = ['test', 'src', 'lib', 'e2e']
const APP_ROOT = join(__dirname, '..', '..')

// Dynamic floor: anything dated next year onwards is "future". Current-year
// fixtures are allowed — they don't rot forward the way future expiries do,
// and files pinning "now" (fake timers) legitimately use them. Computing the
// floor from the wall clock keeps this guardian itself from rotting.
const FUTURE_YEAR_FLOOR = new Date().getUTCFullYear() + 1

// ISO-ish dates anywhere in the line (quotes, template literals, mid-string),
// plus numeric constructors: new Date(2027, …) / Date.UTC(2027, …).
const ISO_DATE = /\b(20\d{2})-\d{2}-\d{2}/g
const NUMERIC_CTOR = /(?:new\s+Date|Date\.UTC)\(\s*(20\d{2})\s*,/g

function futureYearsIn(line: string): number[] {
  const years: number[] = []
  for (const re of [ISO_DATE, NUMERIC_CTOR]) {
    re.lastIndex = 0
    for (let m = re.exec(line); m !== null; m = re.exec(line)) {
      const y = Number(m[1])
      if (y >= FUTURE_YEAR_FLOOR) years.push(y)
    }
  }
  return years
}

// Files verified to use future dates inertly (no wall-clock comparison on the
// consuming path). Re-verify before adding to this list.
const ALLOWLIST = new Set([
  // mocked refreshToken return value — only persisted via toISOString(), never
  // compared against Date.now() (verified in lib/social/workflows.ts)
  'test/lib/social/execute-with-retry.test.ts',
  // pure function with an explicit input date (getNextMonthRange('2026-12-01')
  // → 2027 range) — no wall clock involved
  'test/api/links/cron-partition-maintenance.test.ts',
  // '2099-06-01' is a deliberate far-future sentinel for the schedule
  // validator ("scheduledFor must be in the future") — rots in 2099
  'test/api/pipeline/publish-blog.test.ts',
  // pure date math over an explicit `from` input (leap-year slot expansion);
  // neither test nor source touches Date.now()
  'lib/newsletter/cadence-slots.test.ts',
  // this guardian's own patterns
  'test/unit/test-hygiene.test.ts',
])

function collectTestFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((e) => e.isFile() && /\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
}

describe('test-suite hygiene', () => {
  it('no hardcoded future-year date literals in test fixtures (temporal rot)', () => {
    const offenders: string[] = []
    for (const root of TEST_ROOTS) {
      for (const file of collectTestFiles(join(APP_ROOT, root))) {
        const rel = relative(APP_ROOT, file)
        if (ALLOWLIST.has(rel)) continue
        const lines = readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, i) => {
          if (futureYearsIn(line).length > 0) offenders.push(`${rel}:${i + 1}  ${line.trim()}`)
        })
      }
    }
    expect(
      offenders,
      `Hardcoded future dates rot into expiry zones and break CI on wall clock.\n` +
        `Use relative dates (new Date(Date.now() + N * 864e5).toISOString()) or\n` +
        `vi.useFakeTimers({ now, toFake: ['Date'] }). If genuinely inert, add the\n` +
        `file to the ALLOWLIST in ${relative(APP_ROOT, __filename)} with a rationale.\n\n` +
        offenders.join('\n'),
    ).toEqual([])
  })
})
