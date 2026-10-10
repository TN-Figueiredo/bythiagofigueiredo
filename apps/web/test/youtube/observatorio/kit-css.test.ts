// @vitest-environment node
/** O kit promovido (spec de telas, seção 2 "Reuso exige promoção"; plano da A0, D4): cada classe obs-ch-* tem as mesmas
 *  declarações da classe de tela de onde veio. Quem mudar uma sem a outra quebra aqui. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const css = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Declarações da regra cujo seletor é exatamente `sel`, normalizadas e ordenadas. */
function decl(src: string, sel: string): string[] {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const m = src.match(new RegExp('(?:^|})\\s*' + esc + '\\s*\\{([^}]*)\\}'))
  if (!m) throw new Error('regra não encontrada: ' + sel)
  return m[1]!.split(';').map(d => d.trim().replace(/\s*:\s*/, ':')).filter(Boolean).sort()
}
const PARES: Array<[string, string, string]> = [
  ['_canais/canais.css', '[data-obs-screen="canais"] .dstats', '[data-obs] .obs-ch-dstats'],
  ['_canais/canais.css', '[data-obs-screen="canais"] .youtag', '[data-obs] .obs-ch-youtag'],
  ['_insights/insights.css', '[data-obs-screen="insights"] .stamp', '[data-obs] .obs-ch-stamp'],
  ['_outliers/outliers.css', '.obs-out .obs-out-card', '[data-obs] .obs-ch-card'],
  ['_outliers/outliers.css', '.obs-out .obs-out-ttl', '[data-obs] .obs-ch-ttl'],
]
describe('Observatório · kit promovido', () => {
  const kit = css('_chrome/kit.css')
  it.each(PARES)('%s %s = %s', (arquivo, origem, promovida) => {
    expect(decl(kit, promovida)).toEqual(decl(css(arquivo), origem))
  })
  it('o kit não traz color-mix nem z-index numérico', () => {
    expect(kit).not.toMatch(/color-mix\s*\(/)
    expect(kit).not.toMatch(/z-index\s*:\s*-?\d/)
  })
})
