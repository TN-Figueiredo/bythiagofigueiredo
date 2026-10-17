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
      '_canais/canais.css',
      '_canais/ri.css', // E5a R3: barra divergente e setas de Inscritos usam --dir-up/dn/eq
      '_canal/medidas/canal-medidas.css', // E5a T15: frase do topo, pastilha em queda e setas da direção usam --dir-up/dn/eq
      '_chrome/medidas/graficos.css', // E5a T14c: a faixa da subida usa --dir-up
      '_chrome/medidas/medidas.css',
      '_insights/direcao-nicho.css', // E5a T9: a régua desdobrada de Insights usa --dir-up/dn/eq
      '_proprio/assistido-periodo.css',
      '_proprio/proprio.css',
      '_proprio/retencao-curva.css',
      '_proprio/retencao.css',
      '_proprio/video-blocos.css',
    ])
  })
  it('em medidas.css, --dir-* só aparece em seletor de direção (.obs-md-dir*, .obs-md-rg*, .em_queda): parado e pausado têm cor própria', () => {
    const txt = fs.readFileSync(path.join(DIR, '_chrome/medidas/medidas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const regras = [...txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /--dir-(up|dn|eq)/.test(m[2]!))
    expect(regras.length).toBeGreaterThan(0)
    for (const m of regras) expect(m[1]!.trim(), m[1]).toMatch(/^(\[data-obs\]\s+)?\.(obs-md-dir|obs-md-rg|obs-md-pas\.em_queda)/)
    expect(txt).not.toMatch(/\.obs-md-pas\.(parado|pausado)[^{]*\{[^}]*--dir-/)
  })
  it('em canal-medidas.css, nenhuma regra de parado ou pausado usa --dir-* (portão Yannis I3)', () => {
    const txt = fs.readFileSync(path.join(DIR, '_canal/medidas/canal-medidas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const regras = [...txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /\.(parado|pausado)\b/.test(m[1]!))
    expect(regras.length).toBeGreaterThan(0)
    for (const m of regras) expect(m[2], m[1]).not.toMatch(/--dir-/)
  })
})
