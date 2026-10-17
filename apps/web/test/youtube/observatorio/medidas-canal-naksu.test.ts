import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ROTULO_DA_TABELA } from '@/lib/youtube/observatorio/saiu/rotulos'

const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-medidas.css', 'utf8')

/** Naksu N1 a N4 e o rótulo de competitor_video_marks. */
describe('canal: consertos da Naksu', () => {
  it('N2: a régua da direção ocupa a coluna, não os 124 px do chrome', () => {
    expect(css).toMatch(/\.pc-dg \.obs-md-rg\{[^}]*width:100%/)
  })
  it('N3: as casas de Ritmo rolam em vez de espremer o dígito', () => {
    expect(css).toMatch(/\.pc-cs-l\{[^}]*minmax\(26px,1fr\)[^}]*overflow-x:auto/)
  })
  it('N4: alvos de 44 px por largura de tela', () => {
    expect(css).toMatch(/@media \(max-width:600px\)\{[^@]*\.obs-ch-btn\{min-height:44px\}/)
    expect(css).toMatch(/\.gl-tab summary\{min-height:44px\}/)
  })
  it('rótulo: marca de idade do vídeo, sem pendência', () => {
    const fonte = readFileSync('src/lib/youtube/observatorio/saiu/rotulos.ts', 'utf8')
    expect(fonte).not.toContain('TEXTO-A-REVISAR')
    expect(fonte).toContain("um: 'marca de idade do vídeo'")
    expect(ROTULO_DA_TABELA.competitor_video_marks!.muitos).toBe('marcas de idade do vídeo')
  })
})
