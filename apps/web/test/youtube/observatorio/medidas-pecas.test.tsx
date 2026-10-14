// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-pecas.test.tsx
// E5a Tarefa 3: as peças comuns de tela (COMP/_chrome/medidas). Renderização estática, sem DOM.
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { Direcao } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/direcao'
import { ZeroMedido, NaoMedido, AindaNaoExiste, NaoCarregou } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/marcas'
import { EstadoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estado-canal'
import { ReguaDirecao } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/regua-direcao'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/medidas')
const texto = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

describe('peças comuns de tela (E5a T3)', () => {
  it('os três símbolos, nas duas variantes, levam a palavra por extenso', () => {
    for (const variante of ['cheio', 'contorno'] as const) {
      for (const [simbolo, palavra, pct] of [['sobe', 'subindo', 18], ['estavel', 'estável', 2], ['desce', 'descendo', -18]] as const) {
        for (const palavraVisivel of [true, false]) {
          const html = renderToStaticMarkup(<Direcao variante={variante} simbolo={simbolo} pct={pct} palavraVisivel={palavraVisivel} />)
          expect(texto(html), `${variante} ${simbolo}`).toContain(palavra)
        }
      }
    }
  })
  it('estável é cinza e diz "estável", nunca "parado"', () => {
    const html = renderToStaticMarkup(<Direcao variante="cheio" simbolo="estavel" pct={0} />)
    expect(html).toContain('estavel'); expect(texto(html)).toContain('estável'); expect(html).not.toMatch(/parado/i)
    const css = fs.readFileSync(path.join(DIR, 'medidas.css'), 'utf8')
    expect(css).toMatch(/\.obs-md-dir\.estavel\{--d:var\(--dir-eq\)\}/)
  })
  it('as quatro marcas têm classes diferentes e nenhuma renderiza o algarismo 0, salvo ZeroMedido', () => {
    const z = renderToStaticMarkup(<ZeroMedido />)
    const n = renderToStaticMarkup(<NaoMedido curta="fecha em 17/12" longa="a janela ainda não fechou" />)
    const a = renderToStaticMarkup(<AindaNaoExiste existeEm="2026-12-14" />)
    const c = renderToStaticMarkup(<NaoCarregou />)
    const classes = [z, n, a, c].map(h => /class="([^"]*)"/.exec(h)![1])
    expect(new Set(classes).size).toBe(4)
    expect(texto(z)).toBe('0')
    for (const h of [n, a, c]) expect(texto(h)).not.toMatch(/(^|\s)0(\s|$)/)
  })
  it('NaoMedido leva a curta e a longa', () => {
    const t = texto(renderToStaticMarkup(<NaoMedido curta="fecha em 17/12" longa="a janela ainda não fechou" />))
    expect(t).toContain('fecha em 17/12'); expect(t).toContain('a janela ainda não fechou')
  })
  it('NaoCarregou tem role alert e nunca o texto "não medido"', () => {
    const html = renderToStaticMarkup(<NaoCarregou onTentar={() => undefined} />)
    expect(html).toContain('role="alert"'); expect(html.toLowerCase()).not.toContain('não medido'); expect(html).toContain('<button')
    expect(renderToStaticMarkup(<NaoCarregou />)).not.toContain('<button')
  })
  it('AindaNaoExiste sem data lança (a data é obrigatória)', () => {
    expect(() => renderToStaticMarkup(<AindaNaoExiste existeEm="" />)).toThrow()
  })
  it('EstadoDoCanal: ativo não tem pastilha; os outros têm forma própria', () => {
    expect(renderToStaticMarkup(<EstadoDoCanal estado="ativo" />)).toBe('')
    const parado = renderToStaticMarkup(<EstadoDoCanal estado="parado" dataOuDias={40} tambemEmQueda />)
    expect(texto(parado)).toContain('Parado há 40 dias sem publicar'); expect(texto(parado)).toContain('Também em queda.')
    expect(texto(renderToStaticMarkup(<EstadoDoCanal estado="parado" dataOuDias={1} />))).toContain('há 1 dia sem')
    expect(texto(renderToStaticMarkup(<EstadoDoCanal estado="fora_do_ar" dataOuDias="2026-12-04" />))).toContain('Saiu do YouTube em 04/12')
    expect(texto(renderToStaticMarkup(<EstadoDoCanal estado="sem_videos" />))).toContain('Sem vídeos')
    expect(renderToStaticMarkup(<EstadoDoCanal estado="em_queda" />)).toContain('em_queda')
  })
  it('régua fora da escala diz o valor verdadeiro no texto alternativo', () => {
    const html = renderToStaticMarkup(<ReguaDirecao limite={60} pct={217} foraDaEscala="acima" />)
    expect(html).toContain('role="img"'); expect(html).toContain('+217%'); expect(html).toContain('passa do limite')
    expect(html).toContain('obs-md-rg-clip acima')
    const dentro = renderToStaticMarkup(<ReguaDirecao limite={50} pct={-18} foraDaEscala={null} />)
    expect(dentro).toContain('menos 18%'); expect(dentro).not.toContain('passa do limite'); expect(dentro).not.toContain('rg-clip')
  })
  it('todo componente de _chrome/medidas importa medidas.css', () => {
    const tsx = fs.readdirSync(DIR).filter(f => f.endsWith('.tsx'))
    expect(tsx.length).toBeGreaterThanOrEqual(4)
    for (const f of tsx) expect(fs.readFileSync(path.join(DIR, f), 'utf8'), f).toMatch(/import '\.\/medidas\.css'/)
  })
  it('medidas.css não tem color-mix nem z-index numérico', () => {
    const css = fs.readFileSync(path.join(DIR, 'medidas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/color-mix/); expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
  })
})
