// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const base = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab')
const css = readFileSync(join(base, '_components/ab-pagina.css'), 'utf8')
const page = readFileSync(join(base, '[testId]/page.tsx'), 'utf8')

describe('M7d T2: coluna única (contrato do CSS)', () => {
  it('largura, alinhamento e container', () => {
    expect(css).toContain('--ab-largura: 1040px')
    expect(css).toContain('margin-inline: 0')
    expect(css).toContain('container-type: inline-size')
  })
  it('recuo de 16px abaixo de 640px do container', () => {
    expect(css).toMatch(/@container \(max-width: 640px\)\s*\{[^}]*--ab-recuo: 16px/)
  })
  it('page.tsx importa o CSS e usa as classes nos três retornos', () => {
    expect(page).toContain("import '../_components/ab-pagina.css'")
    expect(page).toContain('className="ab-pagina"')
    expect(page).toContain('className="ab-coluna"')
    expect((page.match(/<Pagina>/g) ?? []).length).toBe(3)
  })
})
