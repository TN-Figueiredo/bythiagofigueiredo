// @vitest-environment node
/** Guarda de CSS da fase A0 (spec 19.1 item 2 e 19.2): escala de camadas num arquivo só, tokens novos, sem color-mix. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const cssFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? cssFiles(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : [])
const numericos = (f: string) => (semComentario(fs.readFileSync(f, 'utf8')).match(/z-index\s*:\s*-?\d+/g) ?? []).length

/** Arquivos que nasceram na fase A: nenhum z-index numérico. A lista cresce a cada fase. */
const NOVOS = ['_chrome/camadas.css', '_chrome/tokens-telas.css', '_chrome/flut/flut.css', '_chrome/kit.css']
/** z-index numéricos nos arquivos antigos em 10/10/2026, antes da A0 (34 declarações; a 35ª linha do grep é um comentário). Catraca EXATA: cada migração baixa o número e o teto baixa junto, na mesma mudança. */
const TETO_ANTIGOS = 22 // 34 → 31 na Tarefa 4 (Canais: .tt 40, :has 3, .menu 30 saíram) → 29 na Tarefa 5 (moldura: .obs-ch-pop 40, .fx-hint 30 saíram) → 28 na Tarefa 6 (Mudanças: .more-pop 20 saiu) → 26 na Tarefa 7 (Outliers: .obs-out-tip 20 e a dica do .obs-out-ib 10 saíram) → 22 na Tarefa 8 (Histórico: .tip 10, .gwrap.open 20 duas vezes e .gpop 21 saíram)

describe('Observatório · escala de camadas', () => {
  const camadas = semComentario(read('_chrome/camadas.css'))
  it('a escala tem os nove níveis do spec, com os valores do spec', () => {
    const esperado: Record<string, string> = { fundo: '0', conteudo: '1', marca: '2', 'marca-alta': '3', 'marca-topo': '4', grudado: '10', flutuante: '1000', aviso: '1100', modal: '2000' }
    for (const [k, v] of Object.entries(esperado)) expect(camadas, k).toMatch(new RegExp(`--z-${k}\\s*:\\s*${v}\\s*[;}]`))
  })
  it('#flut é fixo, cobre a janela, usa a variável e não captura clique', () => {
    const regra = camadas.match(/#flut\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(regra).toMatch(/position\s*:\s*fixed/)
    expect(regra).toMatch(/inset\s*:\s*0/)
    expect(regra).toMatch(/z-index\s*:\s*var\(--z-flutuante\)/)
    expect(regra).toMatch(/pointer-events\s*:\s*none/)
  })
  it('fora do :root, todo z-index de camadas.css vem de var(--z-*) (nunca número, calc ou outra forma)', () => {
    const foraDaRaiz = camadas.replace(/:root\s*\{[^}]*\}/, '')
    const valores = [...foraDaRaiz.matchAll(/z-index\s*:\s*([^;}]*)/g)].map(m => m[1].trim())
    expect(valores.length).toBeGreaterThan(0) // a regra de #flut existe: o teste não passa por não achar nada
    for (const v of valores) expect(v).toMatch(/^var\(--z-[a-z-]+\)$/)
  })
  it('a dica não captura clique: a regra mora só em camadas.css (flut.css não repete)', () => {
    expect(camadas).toMatch(/#flut>\.obs-fl-tip\s*\{[^}]*pointer-events\s*:\s*none/)
    expect(semComentario(read('_chrome/flut/flut.css'))).not.toMatch(/pointer-events/)
  })
  it('a base das flutuantes herda a tipografia da raiz da tela: #flut não é filho dela, então o suavizado de fonte vem na base', () => {
    expect(semComentario(read('_chrome/chrome.css'))).toMatch(/\.obs-ch-root\{[^}]*-webkit-font-smoothing\s*:\s*antialiased/)
    expect(semComentario(read('_chrome/flut/flut.css'))).toMatch(/#flut \.obs-fl-pop,#flut \.obs-fl-tip\{[^}]*-webkit-font-smoothing\s*:\s*antialiased/)
  })
  it('arquivo novo não tem z-index numérico', () => {
    for (const f of NOVOS) if (fs.existsSync(path.join(DIR, f))) expect(numericos(path.join(DIR, f)), f).toBe(0)
  })
  it('catraca: os z-index numéricos dos arquivos antigos são exatamente o teto (cada migração baixa os dois)', () => {
    const antigos = cssFiles(DIR).filter(f => !NOVOS.some(n => f.endsWith(n)))
    expect(antigos.reduce((n, f) => n + numericos(f), 0)).toBe(TETO_ANTIGOS)
  })
})

describe('Observatório · flutuantes de Canais não dependem da ordem de carga do CSS', () => {
  const canais = semComentario(read('_canais/canais.css'))
  it('a regra principal de cada uma tem duas classes (vence a base #flut .obs-fl-* de flut.css por especificidade, não por ordem)', () => {
    expect(canais).toMatch(/#flut \.obs-fl-tip\.cn-tt\s*\{/)
    expect(canais).toMatch(/#flut \.obs-fl-pop\.cn-menu\s*\{/)
    expect(canais).not.toMatch(/#flut \.cn-tt\s*\{/)
    expect(canais).not.toMatch(/#flut \.cn-menu\s*\{/)
  })
  it('--danger-text vem de [data-obs] (chrome.css), nos dois temas: o menu em #flut não o redefine', () => {
    const chrome = semComentario(read('_chrome/chrome.css'))
    expect(chrome).toMatch(/(^|\n)\[data-obs\]\{[^}]*--danger-text:#F26B6B/)
    expect(chrome).toMatch(/\[data-theme="light"\] \[data-obs\]\{[^}]*--danger-text:#B42318/)
    expect(canais).not.toMatch(/#flut[^{]*\{[^}]*--danger-text\s*:/)
  })
})

describe('Observatório · flutuantes do Histórico não dependem da ordem de carga do CSS', () => {
  const hist = semComentario(read('_historico/historico.css'))
  it('a regra principal de cada uma tem duas classes e as variáveis da tela, que não chegam a #flut, são definidas nos dois temas', () => {
    expect(hist).toMatch(/#flut \.obs-fl-tip\.hv-tip\s*\{/)
    expect(hist).toMatch(/#flut \.obs-fl-pop\.hv-gpop\s*\{/)
    expect(hist).not.toMatch(/(^|\n)#flut \.hv-tip\s*\{/)
    expect(hist).not.toMatch(/(^|\n)#flut \.hv-gpop\s*\{/)
    for (const v of ['--shadow-pop', '--well', '--del-fg', '--t-title', '--t-thumb', '--t-desc', '--f4-row']) expect(hist, v).toMatch(new RegExp('#flut \\.hv-tip,#flut \\.hv-gpop\\s*\\{[^}]*' + v + '\\s*:'))
    for (const v of ['--shadow-pop', '--well', '--del-fg', '--t-title', '--t-thumb', '--t-desc']) expect(hist, v + ' (claro)').toMatch(new RegExp('\\[data-theme="light"\\] #flut \\.hv-tip,\\[data-theme="light"\\] #flut \\.hv-gpop\\s*\\{[^}]*' + v + '\\s*:'))
  })
  it('nenhuma regra das caixas fica presa à tela: a dica e a lista não são filhas de [data-obs-screen]', () => {
    expect(hist).not.toMatch(/\[data-obs-screen="historico"\] \.(tip|gpop)\b/)
  })
})

describe('Observatório · tokens das telas novas', () => {
  const tokens = semComentario(read('_chrome/tokens-telas.css'))
  it('cada token do spec 19.2 existe com o valor do spec', () => {
    const esperado: Record<string, string> = { nm: '#E59CC0', 'nm-line': '#B0678F', 'nm-bg': '#3A2232', 'lado-o': '#FF8240', 'lado-b': '#7CC8F8', 'lado-n': '#D9C08F', 'terco-baixo': '#F2C14E', 'im-cl': '#38BDF8', 'im-zero': '#7A8FA6' }
    for (const [k, v] of Object.entries(esperado)) expect(tokens, k).toMatch(new RegExp(`--${k}\\s*:\\s*${v}\\s*[;}]`, 'i'))
  })
  it('"não medido" tem forma além da cor: hachura', () => {
    expect(tokens).toMatch(/\.obs-ch-nm\s*\{[^}]*repeating-linear-gradient/)
  })
  it('nenhum CSS do Observatório usa color-mix()', () => {
    for (const f of cssFiles(DIR)) expect(semComentario(fs.readFileSync(f, 'utf8')), f).not.toMatch(/color-mix\s*\(/)
  })
})
