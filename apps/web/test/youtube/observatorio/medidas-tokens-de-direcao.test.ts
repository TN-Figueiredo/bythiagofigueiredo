// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-tokens-de-direcao.test.ts
// E5a Tarefa 3 (item 241): os tokens de direção (--dir-up, --dir-dn, --dir-eq) são só da direção. Quem os usa é uma lista fechada.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const css = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? css(path.join(d, e.name)) : e.name.endsWith('.css') ? [path.join(d, e.name)] : [])

describe('tokens de direção (E5a T3)', () => {
  it('só medidas.css e os arquivos da A4 nomeados os usam (fora tokens-telas.css)', () => {
    const usam = css(DIR)
      .filter(f => /--dir-(up|dn|eq)/.test(fs.readFileSync(f, 'utf8')))
      .map(f => path.relative(DIR, f))
      .filter(f => f !== '_chrome/tokens-telas.css')
      .sort()
    expect(usam).toEqual([
      '_chrome/medidas/medidas.css',
      '_proprio/proprio.css',
      '_proprio/retencao-curva.css',
      '_proprio/retencao.css',
      '_proprio/video-blocos.css',
    ])
  })
})
