import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste.css'), 'utf8')
const base = css.match(/^\.pm4-vt b \{[^}]*\}/m)?.[0] ?? ''
const noContainer = css.match(/^\s+\.pm4-vt b \{[^}]*\}/m)?.[0] ?? ''

describe('M7d T6: título da versão no placar', () => {
  it('regra base: clamp de 2 linhas, sem reticências nem nowrap', () => {
    const r = base
    expect(r).toContain('-webkit-line-clamp: 2')
    expect(r).toContain('-webkit-box-orient: vertical')
    expect(r).toContain('overflow-wrap: anywhere')
    expect(r).not.toContain('text-overflow: ellipsis')
    expect(r).not.toContain('nowrap')
  })
  it('no bloco de 640 px o clamp vira 5', () => {
    expect(noContainer).toContain('-webkit-line-clamp: 5')
  })
})
