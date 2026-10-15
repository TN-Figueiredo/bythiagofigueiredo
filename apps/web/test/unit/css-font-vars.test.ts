// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : []
  })
}

describe('variáveis de fonte nos CSS', () => {
  it('nenhum .css usa var(--mono) ou var(--sans) (o app define --font-mono/--font-sans)', () => {
    const bad = cssFiles(join(__dirname, '../../src')).filter((f) =>
      /var\(\s*--(mono|sans)\s*[,)]/.test(readFileSync(f, 'utf8')),
    )
    expect(bad).toEqual([])
  })
})
