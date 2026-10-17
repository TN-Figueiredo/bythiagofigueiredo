// @vitest-environment node
// Gio C5 M1: o alvo da miniatura estreita tem 44 px de altura (borda inclusa) e não passa da largura dela (não invade o vizinho).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_historico/historico.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('M1 · alvo da miniatura estreita', () => {
  it('::after cobre a borda (top/bottom -1px) e a largura exata do clipe', () => {
    const m = css.match(/\.clip\.narrow::after\{([^}]*)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/top:-1px/)
    expect(m![1]).toMatch(/bottom:-1px/)
    expect(m![1]).toMatch(/width:100%/)
    expect(m![1]).not.toMatch(/max\(/)
  })
})
